# 🚀 Quick Start - Test Your Messaging App NOW!

## Step 1: Get Your Computer's IP Address

Open PowerShell and run:
```powershell
ipconfig
```

Look for **IPv4 Address** (something like `192.168.1.100`)

## Step 2: Update the App

Open these two files and replace `YOUR_COMPUTER_IP` with your actual IP:

1. `frontend-expo/src/services/APIService.js` - Line 6
2. `frontend-expo/src/services/WebSocketService.js` - Line 13

Example:
```javascript
const BASE_URL = 'http://192.168.1.100:8000/api';  // Your IP here
```

## Step 3: Start Backend (If Not Running)

```powershell
cd h:\aditya\messaging\backend
.\venv\Scripts\activate.ps1
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

## Step 4: Start Expo

```powershell
cd h:\aditya\messaging\frontend-expo
npx expo start
```

## Step 5: Test on Your Phone!

1. **Install Expo Go** on your phone:
   - Android: [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)

2. **Scan QR code** from terminal with Expo Go app

3. **Login** with `admin` / `admin123`

4. **Start messaging!** Tap "Test Chat" and send messages

---

## ✅ What You Can Test

- ✅ Login with JWT authentication
- ✅ Real-time WebSocket messaging
- ✅ Send/receive messages instantly
- ✅ Typing indicators
- ✅ Message status updates

## 🛠️ Troubleshooting

**App won't connect?**
- Make sure phone and computer are on **same WiFi**
- Check firewall isn't blocking port 8000
- Verify IP address is correct

**Backend not accessible?**
- Try `http://YOUR_IP:8000/admin` in phone browser
- Should see Django admin page

---

**That's it! Your full messaging app is ready to test! 🎉**
