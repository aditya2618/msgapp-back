from django.contrib import admin
from .models import File

@admin.register(File)
class FileAdmin(admin.ModelAdmin):
    list_display = ['id', 'file_name', 'owner', 'size_bytes', 'status', 'created_at']
    list_filter = ['status', 'mime_type', 'created_at']
    search_fields = ['file_name', 'owner__username', 'checksum']
    readonly_fields = ['created_at', 'completed_at']
