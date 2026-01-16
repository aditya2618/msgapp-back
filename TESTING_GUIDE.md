# How to Test Messaging Between 2 Users

## Quick Steps

### 1. Create Two User Accounts

**Option A: Via Django Admin (Easiest)**
1. Go to `http://10.93.59.170:8000/admin`
2. Login with `admin` / `admin123`
3. Click on "Users" → "Add User"
4. Create user1:
   - Username: `user1`
   - Password: `user123`
   - Email: `user1@test.com`
   - Phone: `1234567890`
5. Create user2:
   - Username: `user2`
   - Password: `user123`
   - Email: `user2@test.com`
   - Phone: `0987654321`

**Option B: Via Mobile App (Registration)**
1. On device 1: Register as `user1`
2. On device 2: Register as `user2`

### 2. Create a Chat

**Via Django Admin:**
1. Go to admin panel → "Chats" → "Add Chat"
2. Set Chat type: `private`
3. Save the chat
4. Click on "Chat participants" → "Add Chat Participant"  
5. Add both `user1` and `user2` as participants (role: `member`)

**Via Django Shell (Alternative):**
```python
python manage.py shell

from apps.accounts.models import User
from apps.chat.models import Chat, ChatParticipant

# Get users
user1 = User.objects.get(username='user1')
user2 = User.objects.get(username='user2')

# Create chat
chat = Chat.objects.create(chat_type='private')

# Add participants
ChatParticipant.objects.create(chat=chat, user=user1, role='member')
ChatParticipant.objects.create(chat=chat, user=user2, role='member')

print(f"Chat created: {chat.id}")
```

### 3. Test Messaging

**Device 1:**
1. Login as `user1`
2. You should see the chat in the chat list
3. Open the chat
4. Send a message: "Hello from user1!"

**Device 2:**  
1. Login as `user2`
2. Open the same chat
3. You should see user1's message appear in real-time
4. Reply: "Hi from user2!"

**Device 1:**
- Should see user2's reply appear instantly

## Testing Checklist

- [ ] Both users can see the chat
- [ ] Messages appear in real-time
- [ ] Typing indicators work
- [ ] Message status updates (sent → delivered → read)
- [ ] Messages persist after app reload

## Troubleshooting

**Chat doesn't appear:**
- Pull down to refresh the chat list
- Check Django admin that both users are participants

**Messages don't send:**
- Check WebSocket connection (should see ✅ in logs)
- Verify backend server is running
- Check Django logs for errors

**Real-time not working:**
- Ensure both devices are connected to WebSocket
- Check network connectivity
- Verify JWT token is valid (try re-logging in)
