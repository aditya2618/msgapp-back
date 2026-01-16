from django.urls import path
from .views import InitiateFileUploadView, ChunkUploadView, CompleteFileUploadView

app_name = 'files'

urlpatterns = [
    path('init/', InitiateFileUploadView.as_view(), name='init'),
    path('chunk/', ChunkUploadView.as_view(), name='chunk'),
    path('complete/', CompleteFileUploadView.as_view(), name='complete'),
]
