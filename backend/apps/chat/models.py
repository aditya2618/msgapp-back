from django.db import models
from django.conf import settings
import uuid

class Chat(models.Model):
    """
    Represents a chat conversation (private or group).
    """
    CHAT_TYPE_CHOICES = [
        ('private', 'Private'),
        ('group', 'Group'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=10, choices=CHAT_TYPE_CHOICES, default='private')
    name = models.CharField(max_length=255, null=True, blank=True)  # For group chats
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, 
                                    null=True, related_name='created_chats')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'chats'
        indexes = [
            models.Index(fields=['type', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.type.capitalize()} Chat - {self.id}"


class ChatParticipant(models.Model):
    """
    Junction table for chat participants with roles.
    """
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('member', 'Member'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, 
                             related_name='chat_memberships')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'chat_participants'
        unique_together = ['chat', 'user']
        indexes = [
            models.Index(fields=['user', 'chat']),
        ]
    
    def __str__(self):
        return f"{self.user.username} in {self.chat.id} ({self.role})"


class Message(models.Model):
    """
    Represents a message in a chat.
    """
    MESSAGE_TYPE_CHOICES = [
        ('text', 'Text'),
        ('file', 'File'),
    ]
    
    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('read', 'Read'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, 
                               related_name='sent_messages')
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPE_CHOICES, default='text')
    content = models.TextField(null=True, blank=True)  # For text messages
    file_id = models.UUIDField(null=True, blank=True)  # Reference to File model
    file_name = models.CharField(max_length=255, null=True, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='sent')
    created_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'messages'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['chat', '-created_at']),
            models.Index(fields=['sender', 'status']),
        ]
    
    def __str__(self):
        return f"Message {self.id} by {self.sender.username}"
