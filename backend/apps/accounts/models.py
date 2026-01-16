from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid

class User(AbstractUser):
    """
    Custom User model with additional fields for messaging.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone = models.CharField(max_length=20, unique=True)
    email = models.EmailField(unique=True, db_index=True)
    avatar_url = models.URLField(max_length=500, null=True, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    is_online = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['phone']),
            models.Index(fields=['is_online']),
        ]
    
    def __str__(self):
        return f"{self.username} ({self.phone})"
