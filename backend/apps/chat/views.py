from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from .models import Chat, ChatParticipant, Message
from .serializers import ChatSerializer, MessageSerializer

class ChatViewSet(viewsets.ModelViewSet):
    """
    API for managing chats.
    """
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Get chats where current user is a participant
        return Chat.objects.filter(
            participants__user=self.request.user
        ).distinct().order_by('-created_at')
    
    def create(self, request, *args, **kwargs):
        """
        Create a chat. For private chats, check if one already exists.
        """
        chat_type = request.data.get('type', 'private')
        participant_ids = request.data.get('participant_ids', [])
        
        # For private chats, check if chat already exists
        if chat_type == 'private' and participant_ids:
            # Private chat should have exactly 2 participants (current user + 1 other)
            if len(participant_ids) != 1:
                return Response(
                    {"error": "Private chat must have exactly one other participant"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            other_user_id = participant_ids[0]
            
            # Check if a private chat already exists between these two users
            existing_chat = Chat.objects.filter(
                type='private',
                participants__user=request.user
            ).filter(
                participants__user_id=other_user_id
            ).distinct().first()
            
            if existing_chat:
                # Return existing chat
                serializer = self.get_serializer(existing_chat)
                return Response(serializer.data, status=status.HTTP_200_OK)
        
        # Create new chat
        return super().create(request, *args, **kwargs)
    
    def perform_create(self, serializer):
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        # Create chat and add current user as participant and creator
        # Added created_by=self.request.user
        chat = serializer.save(created_by=self.request.user)
        ChatParticipant.objects.create(
            chat=chat,
            user=self.request.user,
            role='admin'
        )
        
        # Broadcast chat.new
        channel_layer = get_channel_layer()
        participant_ids = chat.participants.values_list('user_id', flat=True)
        
        for p_id in participant_ids:
            if str(p_id) == str(self.request.user.id): continue
            
            async_to_sync(channel_layer.group_send)(
                f"user_{p_id}",
                {
                    'type': 'chat_message',
                    'message': {
                        'type': 'chat.new',
                        'payload': {
                            'chat_id': str(chat.id),
                            'name': chat.name,
                            'type': chat.type
                        }
                    }
                }
            )

    def perform_update(self, serializer):
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        chat = self.get_object()
        
        # Check permissions: Only admin can update group info
        if chat.type == 'group':
            participant = ChatParticipant.objects.filter(chat=chat, user=self.request.user).first()
            if not participant or participant.role != 'admin':
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Only admins can update group details.")
        
        updated_chat = serializer.save()
        
        # Broadcast update
        channel_layer = get_channel_layer()
        participant_ids = chat.participants.values_list('user_id', flat=True)
        
        for p_id in participant_ids:
            async_to_sync(channel_layer.group_send)(
                f"user_{p_id}",
                {
                    'type': 'chat_message',
                    'message': {
                        'type': 'chat.updated',
                        'payload': {
                            'chat_id': str(updated_chat.id),
                            'name': updated_chat.name
                        }
                    }
                }
            )

    def destroy(self, request, *args, **kwargs):
        """
        Delete a chat.
        - Private: Any participant can delete (for everyone - simplified).
        - Group: Only admin can delete.
        """
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        instance = self.get_object()
        
        # Check permissions
        participant = ChatParticipant.objects.filter(chat=instance, user=request.user).first()
        if not participant:
             return Response(status=status.HTTP_403_FORBIDDEN)
             
        if instance.type == 'group':
            if participant.role != 'admin':
                return Response(
                    {'error': 'Only admins can delete groups. Use "leave" to exit.'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Get participants to notify BEFORE deletion
        participant_ids = list(instance.participants.values_list('user_id', flat=True))
        chat_id = str(instance.id)
        
        self.perform_destroy(instance)
        
        # Broadcast deleted event
        channel_layer = get_channel_layer()
        for p_id in participant_ids:
            async_to_sync(channel_layer.group_send)(
                f"user_{p_id}",
                {
                    'type': 'chat_message',
                    'message': {
                        'type': 'chat.deleted',
                        'payload': { 'chat_id': chat_id }
                    }
                }
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """Get messages for a specific chat."""
        chat = self.get_object()
        messages = Message.objects.filter(chat=chat).order_by('created_at')
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark all messages in chat as read."""
        from django.utils import timezone
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        chat = self.get_object()
        
        # Get messages that will be updated to notify senders
        # Filter messages from others that are not read
        messages_to_update = Message.objects.filter(
            chat=chat
        ).exclude(
            sender=request.user
        ).exclude(
            status='read'
        )
        
        # We need the IDs and senders before updating
        updates = list(messages_to_update.values('id', 'sender_id'))
        
        # Mark messages from others as read
        updated_count = messages_to_update.update(
            status='read',
            read_at=timezone.now()
        )
        
        # Broadcast read status to senders via WebSocket
        channel_layer = get_channel_layer()
        current_time_iso = timezone.now().isoformat()
        
        for msg in updates:
            sender_group = f"user_{msg['sender_id']}"
            async_to_sync(channel_layer.group_send)(
                sender_group,
                {
                    'type': 'message_status',
                    'message': {
                        'type': 'message.read',
                        'payload': {
                            'message_id': str(msg['id']),
                            'chat_id': str(chat.id),
                            'read_at': current_time_iso
                        }
                    }
                }
            )
        
        return Response({
            'status': 'success',
            'updated_count': updated_count
        })

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        """Leave a group chat."""
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        chat = self.get_object()
        if chat.type == 'private':
            return Response({'error': 'Cannot leave private chat'}, status=status.HTTP_400_BAD_REQUEST)
            
        participant = ChatParticipant.objects.filter(chat=chat, user=request.user).first()
        if not participant:
            return Response({'error': 'Not a participant'}, status=status.HTTP_400_BAD_REQUEST)
            
        if participant.role == 'admin':
            # Check if last admin? Simple logic: allow leaving, if no admins left, chaos? 
            # Or just warn? For now strict: Admin must transfer or delete?
            # User request: "only he can delete the group other they can exit".
            # If Admin exits, let's just let them exit.
            pass

        participant.delete()
        
        # Broadcast
        channel_layer = get_channel_layer()
        other_participants = chat.participants.values_list('user_id', flat=True)
        for p_id in other_participants:
            async_to_sync(channel_layer.group_send)(
                f"user_{p_id}",
                {
                    'type': 'chat_message',
                    'message': {
                        'type': 'participant.left',
                        'payload': { 'chat_id': str(chat.id), 'user_id': str(request.user.id) }
                    }
                }
            )
        return Response({'status': 'left'})

    @action(detail=True, methods=['post'])
    def add_participants(self, request, pk=None):
        """Add users to group (Admin only)."""
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        chat = self.get_object()
        if chat.type != 'group':
            return Response({'error': 'Not a group chat'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Check admin
        if not ChatParticipant.objects.filter(chat=chat, user=request.user, role='admin').exists():
            return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
            
        user_ids = request.data.get('user_ids', [])
        added_users = []
        
        for uid in user_ids:
            # Check if already in
            if not ChatParticipant.objects.filter(chat=chat, user_id=uid).exists():
                ChatParticipant.objects.create(chat=chat, user_id=uid, role='member')
                added_users.append(uid)
        
        # Broadcast to ALL (including new) - New users need chat.new equivalent?
        # Ideally new user gets "chat.new". Old users get "participant.added".
        
        channel_layer = get_channel_layer()
        all_participants = chat.participants.values_list('user_id', flat=True)
        
        for p_id in all_participants:
            msg_type = 'chat.new' if str(p_id) in map(str, added_users) else 'participant.added'
            payload = { 'chat_id': str(chat.id) }
            
            if msg_type == 'chat.new':
                payload.update({'name': chat.name, 'type': chat.type})
            else:
                payload.update({'added_user_ids': added_users})
            
            async_to_sync(channel_layer.group_send)(
                f"user_{p_id}",
                {
                    'type': 'chat_message',
                    'message': {
                        'type': msg_type,
                        'payload': payload
                    }
                }
            )
            
        return Response({'status': 'added', 'count': len(added_users)})

    @action(detail=True, methods=['post'])
    def remove_participant(self, request, pk=None):
        """Remove user from group (Admin only)."""
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        chat = self.get_object()
        if chat.type != 'group':
             return Response({'error': 'Not a group chat'}, status=status.HTTP_400_BAD_REQUEST)
             
        # Check admin
        if not ChatParticipant.objects.filter(chat=chat, user=request.user, role='admin').exists():
            return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
            
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'user_id required'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Cannot remove self here (use leave), preventing accidental admin lockout?
        if str(user_id) == str(request.user.id):
             return Response({'error': 'Use leave endpoint to exit'}, status=status.HTTP_400_BAD_REQUEST)

        participant = ChatParticipant.objects.filter(chat=chat, user_id=user_id).first()
        if participant:
            participant.delete()
            
            # Broadcast to removed user (chat.deleted/removed) and others (participant.removed)
            channel_layer = get_channel_layer()
            
            # Notify removed user
            async_to_sync(channel_layer.group_send)(
                f"user_{user_id}",
                {
                    'type': 'chat_message',
                    'message': {
                        'type': 'chat.deleted', # Effectively deleted for them
                        'payload': { 'chat_id': str(chat.id) }
                    }
                }
            )
            
            # Notify remaining
            remaining = chat.participants.values_list('user_id', flat=True)
            for p_id in remaining:
                async_to_sync(channel_layer.group_send)(
                    f"user_{p_id}",
                    {
                        'type': 'chat_message',
                        'message': {
                            'type': 'participant.removed',
                            'payload': { 'chat_id': str(chat.id), 'user_id': user_id }
                        }
                    }
                )

        return Response({'status': 'removed'})
