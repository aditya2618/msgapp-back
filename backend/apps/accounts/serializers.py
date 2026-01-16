from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.mail import send_mail
from django.conf import settings
from django.utils.crypto import get_random_string

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'phone', 'avatar_url', 'is_online', 'last_seen_at')
        read_only_fields = ('id', 'is_online', 'last_seen_at')

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'phone', 'password')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            phone=validated_data['phone'],
            password=validated_data['password']
        )
        return user

class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email does not exist.")
        return value

    def save(self):
        email = self.validated_data['email']
        otp = get_random_string(length=6, allowed_chars='0123456789')
        # Cache OTP for 10 minutes (600 seconds)
        cache.set(f'password_reset_otp_{email}', otp, timeout=600)
        
        # Send email
        send_mail(
            'Password Reset OTP - Messaging App',
            f'Your OTP for password reset is: {otp}',
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
        return otp

class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)
    new_password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data['email']
        otp = data['otp']
        cached_otp = cache.get(f'password_reset_otp_{email}')

        if not cached_otp or cached_otp != otp:
            raise serializers.ValidationError({"otp": "Invalid or expired OTP."})
        
        return data

    def save(self):
        email = self.validated_data['email']
        new_password = self.validated_data['new_password']
        
        user = User.objects.get(email=email)
        user.set_password(new_password)
        user.save()
        
        # Clear OTP
        cache.delete(f'password_reset_otp_{email}')
        return user
