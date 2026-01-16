from django.db import models
from django.conf import settings
import uuid

class File(models.Model):
    """
    Represents an uploaded file.
    """
    STATUS_CHOICES = [
        ('uploading', 'Uploading'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, 
                              related_name='uploaded_files')
    file_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100)
    size_bytes = models.BigIntegerField()
    checksum = models.CharField(max_length=64)  # SHA256 hash
    storage_url = models.URLField(max_length=500, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='uploading')
    chunks_uploaded = models.IntegerField(default=0)
    total_chunks = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'files'
        indexes = [
            models.Index(fields=['owner', 'status']),
            models.Index(fields=['checksum']),
        ]
    
    def __str__(self):
        return f"{self.file_name} ({self.status})"
