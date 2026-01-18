from rest_framework import serializers
from .models import Chat, ChatParticipant, Message
from apps.accounts.serializers import UserSerializer

class ChatParticipantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = ChatParticipant
        fields = ['user', 'role']

class ChatSerializer(serializers.ModelSerializer):
    participants = ChatParticipantSerializer(many=True, read_only=True)
    participant_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )
    chat_name = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    other_user_online = serializers.SerializerMethodField()
    
    class Meta:
        model = Chat
        fields = ['id', 'type', 'name', 'chat_name', 'participants', 'participant_ids', 'created_at', 'unread_count', 'other_user_online']
        read_only_fields = ['id', 'created_at']
    
    def get_unread_count(self, obj):
        """Count unread messages for the current user"""
        request = self.context.get('request')
        if not request:
            return 0
        
        # Count messages where sender is NOT the current user and status is NOT 'read'
        # Note: This is a simple implementation. For group chats, accurate read receipts need a separate model.
        # But this works for 1-to-1 and basic group logic.
        return obj.messages.exclude(sender=request.user).exclude(status='read').count()

    def get_other_user_online(self, obj):
        """Check if other participant is online (for private chats)"""
        request = self.context.get('request')
        if not request or obj.type != 'private':
            return False
            
        other_participant = obj.participants.exclude(user=request.user).first()
        if other_participant:
            return other_participant.user.is_online
        return False

    def get_chat_name(self, obj):
        """
        For private chats: return the other participant's username
        For group chats: return the group name or 'Group Chat'
        """
        request = self.context.get('request')
        if not request:
            return obj.name or 'Chat'
        
        if obj.type == 'private':
            # Get the other participant
            other_participant = obj.participants.exclude(user=request.user).first()
            if other_participant:
                return other_participant.user.username
            return 'Chat'
        else:
            # Group chat
            return obj.name or 'Group Chat'
    
    def create(self, validated_data):
        participant_ids = validated_data.pop('participant_ids', [])
        chat = Chat.objects.create(**validated_data)
        
        # Add participants
        for user_id in participant_ids:
            ChatParticipant.objects.create(
                chat=chat,
                user_id=user_id,
                role='member'
            )
        
        return chat

class MessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.UUIDField(source='sender.id', read_only=True)
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    message_id = serializers.UUIDField(source='id', read_only=True)
    timestamp = serializers.DateTimeField(source='created_at', read_only=True)
    
    class Meta:
        model = Message
        fields = ['message_id', 'id', 'chat', 'sender', 'sender_id', 'sender_username', 'message_type', 'content', 'status', 'timestamp', 'created_at']
        read_only_fields = ['id', 'sender', 'status', 'created_at']
