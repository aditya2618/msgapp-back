from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser
from django.core.files.storage import default_storage
from django.conf import settings
from django.utils import timezone
from .models import File
import os
import uuid
import hashlib


class InitiateFileUploadView(APIView):
    """
    Initialize a chunked file upload session.
    POST /api/files/init/
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        file_name = request.data.get('file_name')
        mime_type = request.data.get('mime_type')
        size_bytes = request.data.get('size_bytes')
        checksum = request.data.get('checksum')
        
        if not all([file_name, mime_type, size_bytes, checksum]):
            return Response(
                {'error': 'Missing required fields'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calculate total chunks (5MB per chunk)
        chunk_size = 5 * 1024 * 1024  # 5MB
        total_chunks = (int(size_bytes) + chunk_size - 1) // chunk_size
        
        # Create file record
        file_obj = File.objects.create(
            owner=request.user,
            file_name=file_name,
            mime_type=mime_type,
            size_bytes=size_bytes,
            checksum=checksum,
            status='uploading',
            total_chunks=total_chunks
        )
        
        return Response({
            'file_id': str(file_obj.id),
            'chunk_size': chunk_size,
            'total_chunks': total_chunks
        }, status=status.HTTP_201_CREATED)


class ChunkUploadView(APIView):
    """
    Upload a file chunk.
    POST /api/files/chunk/
    Headers:
        X-File-Id: UUID
        X-Chunk-Index: int
        Content-Range: bytes start-end/total
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]
    
    def post(self, request):
        file_id = request.headers.get('X-File-Id')
        chunk_index = request.headers.get('X-Chunk-Index')
        
        if not file_id or chunk_index is None:
            return Response(
                {'error': 'Missing file_id or chunk_index'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            file_obj = File.objects.get(id=file_id, owner=request.user)
        except File.DoesNotExist:
            return Response(
                {'error': 'File not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get chunk data
        chunk_data = request.FILES.get('chunk')
        if not chunk_data:
            return Response(
                {'error': 'No chunk data'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Save chunk to temporary directory
        chunk_dir = os.path.join(settings.MEDIA_ROOT, 'chunks', str(file_id))
        os.makedirs(chunk_dir, exist_ok=True)
        
        chunk_path = os.path.join(chunk_dir, f'chunk_{chunk_index}')
        with open(chunk_path, 'wb') as f:
            for chunk in chunk_data.chunks():
                f.write(chunk)
        
        # Update file record
        file_obj.chunks_uploaded += 1
        file_obj.save()
        
        return Response({
            'chunk_index': chunk_index,
            'chunks_uploaded': file_obj.chunks_uploaded,
            'total_chunks': file_obj.total_chunks
        }, status=status.HTTP_200_OK)


class CompleteFileUploadView(APIView):
    """
    Complete file upload and merge chunks.
    POST /api/files/complete/
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        file_id = request.data.get('file_id')
        
        if not file_id:
            return Response(
                {'error': 'Missing file_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            file_obj = File.objects.get(id=file_id, owner=request.user)
        except File.DoesNotExist:
            return Response(
                {'error': 'File not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify all chunks uploaded
        if file_obj.chunks_uploaded != file_obj.total_chunks:
            return Response(
                {'error': 'Not all chunks uploaded'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Merge chunks
        chunk_dir = os.path.join(settings.MEDIA_ROOT, 'chunks', str(file_id))
        final_dir = os.path.join(settings.MEDIA_ROOT, 'files', str(request.user.id))
        os.makedirs(final_dir, exist_ok=True)
        
        final_path = os.path.join(final_dir, file_obj.file_name)
        
        # Merge all chunks in order
        with open(final_path, 'wb') as final_file:
            for i in range(file_obj.total_chunks):
                chunk_path = os.path.join(chunk_dir, f'chunk_{i}')
                with open(chunk_path, 'rb') as chunk_file:
                    final_file.write(chunk_file.read())
        
        # Verify checksum
        sha256_hash = hashlib.sha256()
        with open(final_path, 'rb') as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        
        calculated_checksum = sha256_hash.hexdigest()
        
        if calculated_checksum != file_obj.checksum:
            # Cleanup and mark as failed
            os.remove(final_path)
            file_obj.status = 'failed'
            file_obj.save()
            return Response(
                {'error': 'Checksum mismatch'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update file record
        file_obj.storage_url = f'/media/files/{request.user.id}/{file_obj.file_name}'
        file_obj.status = 'completed'
        file_obj.completed_at = timezone.now()
        file_obj.save()
        
        # Cleanup chunk directory
        import shutil
        shutil.rmtree(chunk_dir)
        
        return Response({
            'file_id': str(file_obj.id),
            'storage_url': file_obj.storage_url,
            'status': 'completed'
        }, status=status.HTTP_200_OK)
