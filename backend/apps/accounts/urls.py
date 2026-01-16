from django.urls import path
from .views import RegisterView, ForgotPasswordView, ResetPasswordView, search_users

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('search/', search_users, name='search-users'),
]
