"""
Quick setup script to create admin user and test data
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

# Create or update admin user
admin, created = User.objects.get_or_create(
    username='admin',
    defaults={
        'email': 'admin@example.com',
        'phone': '+1234567890',
        'is_staff': True,
        'is_superuser': True,
        'is_active': True,
    }
)

admin.set_password('admin123')
admin.phone = '+1234567890'
admin.is_staff = True
admin.is_superuser = True
admin.save()

if created:
    print("✅ Superuser 'admin' created successfully!")
else:
    print("✅ Superuser 'admin' updated successfully!")

print("\nCredentials:")
print("   Username: admin")
print("   Password: admin123")
print("   Phone: +1234567890")
print("\nAccess points:")
print("1. Admin panel: http://localhost:8000/admin")
print("2. Get JWT token: POST http://localhost:8000/api/auth/token/")
print('   Body: {"username": "admin", "password": "admin123"}')
