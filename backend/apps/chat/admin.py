from django.contrib import admin
from .models import Chat, ChatParticipant, Message

@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    list_display = ['id', 'type', 'name', 'created_by', 'created_at']
    list_filter = ['type', 'created_at']
    search_fields = ['name', 'id']


@admin.register(ChatParticipant)
class ChatParticipantAdmin(admin.ModelAdmin):
    list_display = ['chat', 'user', 'role', 'joined_at']
    list_filter = ['role', 'joined_at']
    search_fields = ['user__username', 'chat__id']


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'chat', 'sender', 'message_type', 'status', 'created_at']
    list_filter = ['message_type', 'status', 'created_at']
    search_fields = ['sender__username', 'content']
    readonly_fields = ['created_at', 'delivered_at', 'read_at']
