from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'phone', 'email', 'is_online', 'last_seen_at']
    list_filter = ['is_online', 'is_staff', 'is_active']
    search_fields = ['username', 'phone', 'email']
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Messaging Info', {
            'fields': ('phone', 'avatar_url', 'is_online', 'last_seen_at')
        }),
    )
