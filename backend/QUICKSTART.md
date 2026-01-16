# Quick Start Guide

## Backend is Running! 🚀

Your messaging backend is live at `http://localhost:8000`

### Admin Access
- **URL**: http://localhost:8000/admin
- **Username**: `admin`
- **Password**: `admin123`

### API Testing

#### 1. Get JWT Token
```bash
curl -X POST http://localhost:8000/api/auth/token/ ^
  -H "Content-Type: application/json" ^
  -d "{\"username\": \"admin\", \"password\": \"admin123\"}"
```

**Response:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

#### 2. Test File Upload Init
```bash
curl -X POST http://localhost:8000/api/files/init/ ^
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"file_name\": \"test.txt\", \"mime_type\": \"text/plain\", \"size_bytes\": 1024, \"checksum\": \"abc123\"}"
```

#### 3. WebSocket Connection
Connect to: `ws://localhost:8000/ws/chat/?token=YOUR_ACCESS_TOKEN`

Send message:
```json
{
  "type": "message.send",
  "request_id": "test-123",
  "payload": {
    "chat_id": "CHAT_UUID",
    "message_type": "text",
    "content": "Hello!"
  }
}
```

## Development Configuration

✅ **Database**: SQLite (h:\aditya\messaging\backend\db.sqlite3)  
✅ **Channel Layer**: In-Memory (single server)  
✅ **Static Files**: Collected to staticfiles/  

## Production Configuration (When Ready)

To switch to production-ready setup:

1. **PostgreSQL**: Uncomment PostgreSQL config in `config/settings.py`
2. **Redis**: Uncomment Redis channel layer in `config/settings.py`
3. **Environment Variables**: Use python-dotenv for secrets

## Next Steps

### Option 1: Build React Native App (Phase 2)
Start building the mobile frontend to connect to this backend.

### Option 2: Test with Tools
- Use Postman/Insomnia for API testing
- Use a WebSocket client (e.g., websocat, wscat) for WebSocket testing
- Create test chats and messages via admin panel

### Option 3: Add More Features
- User registration endpoint
- Chat creation API
- Message history endpoint
- Typing indicators
- Read receipts

## Files Created

```
backend/
├── config/           # Django settings & routing
├── apps/
│   ├── accounts/    # User model
│   ├── chat/        # WebSocket consumer & models
│   └── files/       # File upload API
├── db.sqlite3       # SQLite database
├── staticfiles/     # Collected static files
└── setup_admin.py   # Admin setup script
```

## Server Management

**Stop server**: Press Ctrl+C in the terminal running daphne

**Restart server**:
```bash
cd h:\aditya\messaging\backend
.\venv\Scripts\activate.ps1
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```
