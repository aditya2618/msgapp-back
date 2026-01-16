import json
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from asgiref.sync import sync_to_async
from .models import Chat, Message, ChatParticipant
from apps.accounts.models import User


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time messaging.
    Implements the messaging protocol from the technical spec.
    """
    
    async def connect(self):
        """
        Handle WebSocket connection. Authenticate user via query params.
        """
        # Get token from query string
        query_string = self.scope.get('query_string', b'').decode()
        params = dict(param.split('=') for param in query_string.split('&') if '=' in param)
        token = params.get('token', '')
        
        # Authenticate user (simplified - in production use JWT validation)
        self.user = self.scope.get('user')
        
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return
        
        # Store user's channel name
        self.user_id = str(self.user.id)
        self.user_group_name = f"user_{self.user_id}"
        
        # Join user's personal group
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        
        # Mark user as online
        await self.set_user_online(True)
        
        await self.accept()
    
    async def disconnect(self, close_code):
        """
        Handle WebSocket disconnection.
        """
        # Only update status if we have an authenticated user
        if hasattr(self, 'user') and self.user and self.user.is_authenticated:
            # Mark user as offline
            await self.set_user_online(False)
            
            # Leave user's personal group
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        """
        Handle incoming WebSocket messages.
        """
        try:
            data = json.loads(text_data)
            event_type = data.get('type')
            request_id = data.get('request_id')
            payload = data.get('payload', {})
            
            # Route message based on type
            if event_type == 'message.send':
                await self.handle_message_send(payload, request_id)
            elif event_type == 'typing.start':
                await self.handle_typing_start(payload)
            elif event_type == 'typing.stop':
                await self.handle_typing_stop(payload)
            elif event_type == 'message.read':
                await self.handle_message_read(payload)
            elif event_type == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        
        except json.JSONDecodeError:
            await self.send_error("Invalid JSON")
        except Exception as e:
            await self.send_error(str(e))
    
    async def handle_message_send(self, payload, request_id):
        """
        Handle sending a new message.
        """
        chat_id = payload.get('chat_id')
        message_type = payload.get('message_type', 'text')
        
        # Verify user is participant
        is_participant = await self.is_chat_participant(chat_id, self.user_id)
        if not is_participant:
            await self.send_error("Not a participant in this chat")
            return
        
        # Create message in database
        message_data = {
            'chat_id': chat_id,
            'sender_id': self.user_id,
            'message_type': message_type,
        }
        
        if message_type == 'text':
            message_data['content'] = payload.get('content')
        else:  # file
            message_data['file_id'] = payload.get('file_id')
            message_data['file_name'] = payload.get('file_name')
            message_data['file_size'] = payload.get('file_size')
            message_data['mime_type'] = payload.get('mime_type')
        
        message = await self.create_message(message_data)
        
        # Get all participants
        participant_ids = await self.get_chat_participants(chat_id)
        
        # Broadcast to all participants
        message_payload = {
            'type': 'message.new',
            'payload': await self.serialize_message(message)
        }
        
        for participant_id in participant_ids:
            await self.channel_layer.group_send(
                f"user_{participant_id}",
                {
                    'type': 'chat_message',
                    'message': message_payload
                }
            )
    
    async def handle_typing_start(self, payload):
        """
        Handle typing indicator start.
        """
        chat_id = payload.get('chat_id')
        participant_ids = await self.get_chat_participants(chat_id)
        
        for participant_id in participant_ids:
            if participant_id != self.user_id:
                await self.channel_layer.group_send(
                    f"user_{participant_id}",
                    {
                        'type': 'typing_indicator',
                        'message': {
                            'type': 'typing.start',
                            'payload': {
                                'chat_id': chat_id,
                                'user_id': self.user_id
                            }
                        }
                    }
                )
    
    async def handle_typing_stop(self, payload):
        """
        Handle typing indicator stop.
        """
        chat_id = payload.get('chat_id')
        participant_ids = await self.get_chat_participants(chat_id)
        
        for participant_id in participant_ids:
            if participant_id != self.user_id:
                await self.channel_layer.group_send(
                    f"user_{participant_id}",
                    {
                        'type': 'typing_indicator',
                        'message': {
                            'type': 'typing.stop',
                            'payload': {
                                'chat_id': chat_id,
                                'user_id': self.user_id
                            }
                        }
                    }
                )
    
    async def handle_message_read(self, payload):
        """
        Handle message read receipt.
        """
        message_id = payload.get('message_id')
        chat_id = payload.get('chat_id')
        
        # Update message status
        await self.mark_message_as_read(message_id)
        
        # Get message sender
        sender_id = await self.get_message_sender(message_id)
        
        # Notify sender
        await self.channel_layer.group_send(
            f"user_{sender_id}",
            {
                'type': 'message_status',
                'message': {
                    'type': 'message.read',
                    'payload': {
                        'message_id': message_id,
                        'read_at': timezone.now().isoformat()
                    }
                }
            }
        )
    
    # Channel layer handlers
    async def chat_message(self, event):
        """Send message to WebSocket"""
        await self.send(text_data=json.dumps(event['message']))
    
    async def typing_indicator(self, event):
        """Send typing indicator to WebSocket"""
        await self.send(text_data=json.dumps(event['message']))
    
    async def message_status(self, event):
        """Send message status update to WebSocket"""
        await self.send(text_data=json.dumps(event['message']))
    
    async def send_error(self, error_message):
        """Send error to client"""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'payload': {'message': error_message}
        }))
    
    # Database operations
    @database_sync_to_async
    def set_user_online(self, is_online):
        """Set user online status"""
        self.user.is_online = is_online
        if not is_online:
            self.user.last_seen_at = timezone.now()
        self.user.save()
    
    @database_sync_to_async
    def is_chat_participant(self, chat_id, user_id):
        """Check if user is participant in chat"""
        return ChatParticipant.objects.filter(
            chat_id=chat_id, user_id=user_id
        ).exists()
    
    @database_sync_to_async
    def create_message(self, data):
        """Create a new message"""
        return Message.objects.create(**data)
    
    @database_sync_to_async
    def get_chat_participants(self, chat_id):
        """Get all participant IDs for a chat"""
        return list(
            ChatParticipant.objects.filter(chat_id=chat_id)
            .values_list('user_id', flat=True)
        )
    
    @database_sync_to_async
    def serialize_message(self, message):
        """Serialize message to dict"""
        return {
            'message_id': str(message.id),
            'chat_id': str(message.chat_id),
            'sender_id': str(message.sender_id),
            'message_type': message.message_type,
            'content': message.content,
            'file_id': str(message.file_id) if message.file_id else None,
            'file_name': message.file_name,
            'file_size': message.file_size,
            'mime_type': message.mime_type,
            'status': message.status,
            'timestamp': message.created_at.isoformat()
        }
    
    @database_sync_to_async
    def mark_message_as_read(self, message_id):
        """Mark message as read"""
        message = Message.objects.get(id=message_id)
        message.status = 'read'
        message.read_at = timezone.now()
        message.save()
        return message
    
    @database_sync_to_async
    def get_message_sender(self, message_id):
        """Get sender ID of a message"""
        return str(Message.objects.get(id=message_id).sender_id)
