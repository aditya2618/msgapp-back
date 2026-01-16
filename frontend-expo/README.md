# Messaging App - Frontend (Expo)

Real-time messaging mobile app built with React Native and Expo.

## Features

- 🔐 User authentication with persistent login
- 💬 Real-time messaging via WebSockets
- 👥 Private and Group chat creation
- 🔍 User search (name, email, phone)
- 📝 Message history
- ✅ Message status indicators
- ⌨️ Typing indicators
- 🟢 Online/offline presence
- 📧 Password reset via email OTP

## Tech Stack

- **React Native (Expo)** - Mobile framework
- **React Navigation** - Navigation
- **Axios** - HTTP client
- **Expo SecureStore** - Secure token storage
- **WebSocket** - Real-time communication

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API endpoint:**
   - Edit `src/services/APIService.js`
   - Update `BASE_URL` to your backend IP/domain

3. **Run development server:**
   ```bash
   npx expo start
   ```

4. **Run on device:**
   - Scan QR code with Expo Go app
   - Or press `a` for Android emulator
   - Or press `i` for iOS simulator

## Project Structure

```
src/
├── screens/
│   ├── LoginScreen.js
│   ├── RegisterScreen.js
│   ├── ForgotPasswordScreen.js
│   ├── ChatListScreen.js
│   ├── NewChatScreen.js
│   ├── CreateGroupScreen.js
│   └── ChatScreen.js
├── services/
│   ├── APIService.js
│   └── WebSocketService.js
└── App.js
```

## Configuration

### Backend URL
Update `src/services/APIService.js`:
```javascript
const BASE_URL = 'http://YOUR_IP:8000/api';
```

Update `src/services/WebSocketService.js`:
```javascript
const defaultServerUrl = 'YOUR_IP:8000';
```

## Building for Production

### Android
```bash
eas build --platform android
```

### iOS
```bash
eas build --platform ios
```

## License

MIT
