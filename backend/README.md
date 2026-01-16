# Messaging App - Backend

Real-time messaging backend built with Django Channels and WebSockets.

## Features

- 🔐 JWT Authentication (registration, login, password reset)
- 💬 Real-time messaging via WebSockets
- 👥 Private and Group chats
- 📱 User presence (online/offline status)
- ✅ Message status (sent, delivered, read)
- 🔍 User search (username, email, phone)
- 📧 Email OTP for password reset

## Tech Stack

- **Django 4.2+** - Web framework
- **Django Channels** - WebSocket support
- **Django REST Framework** - API endpoints
- **Django Simple JWT** - Authentication
- **Daphne** - ASGI server
- **SQLite** - Database (dev)
- **In-Memory Channel Layer** - WebSocket routing (dev)

## Setup

1. **Create virtual environment:**
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Windows
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run migrations:**
   ```bash
   python manage.py migrate
   ```

4. **Create superuser:**
   ```bash
   python manage.py createsuperuser
   ```

5. **Run server:**
   ```bash
   daphne -b 0.0.0.0 -p 8000 config.asgi:application
   ```

## API Endpoints

### Authentication
- `POST /api/auth/token/` - Login (get JWT tokens)
- `POST /api/auth/token/refresh/` - Refresh access token
- `POST /api/auth/register/` - Register new user
- `POST /api/auth/forgot-password/` - Request OTP
- `POST /api/auth/reset-password/` - Reset password with OTP
- `GET /api/auth/search/?q=query` - Search users

### Chat
- `GET /api/chat/chats/` - List user's chats
- `POST /api/chat/chats/` - Create new chat
- `GET /api/chat/chats/{id}/messages/` - Get chat messages

### WebSocket
- `ws://localhost:8000/ws/chat/?token={jwt_token}` - WebSocket connection

## Configuration

Edit `config/settings.py`:
- **Email Backend**: Configure SMTP for password reset emails
- **Allowed Hosts**: Set for production deployment
- **Database**: Configure PostgreSQL for production
- **Channel Layers**: Set up Redis for production

## License

MIT
