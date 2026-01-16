# Real-Time Messaging App

A full-stack real-time messaging application with Django backend and React Native Expo frontend.

## Features

- 🔐 **Authentication** - JWT-based auth with email OTP password reset
- 💬 **Real-time Messaging** - WebSocket-powered instant messaging
- 👥 **Chats** - Private and group chat support
- 🔍 **User Search** - Search by username, email, or phone
- 📱 **Mobile App** - Cross-platform iOS/Android with Expo
- ✅ **Message Status** - Sent, delivered, and read receipts
- 🟢 **Presence** - Online/offline user status
- ⌨️ **Typing Indicators** - See when others are typing
- 💾 **Persistent Login** - Stay logged in across app restarts

## Project Structure

```
messaging/
├── backend/          # Django + Channels backend
└── frontend-expo/    # React Native Expo app
```

## Quick Start

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### Frontend Setup

```bash
cd frontend-expo
npm install
# Update API URL in src/services/APIService.js
npx expo start
```

Scan QR code with Expo Go app to run on your device!

## Tech Stack

**Backend:**
- Django 4.2+ with Django Channels
- Django REST Framework + Simple JWT
- WebSockets for real-time communication
- SQLite (dev) / PostgreSQL (prod)

**Frontend:**
- React Native with Expo
- React Navigation
- Axios for HTTP requests
- WebSocket for real-time updates
- Expo SecureStore for token storage

## Documentation

- [Backend README](backend/README.md)
- [Frontend README](frontend-expo/README.md)
- [Testing Guide](TESTING_GUIDE.md)

## License

MIT
