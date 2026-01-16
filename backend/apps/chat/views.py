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
        # Create chat and add current user as participant
        chat = serializer.save()
        ChatParticipant.objects.create(
            chat=chat,
            user=self.request.user,
            role='admin'
        )
    
    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """Get messages for a specific chat."""
        chat = self.get_object()
        messages = Message.objects.filter(chat=chat).order_by('created_at')
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)
