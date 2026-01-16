// WebSocket Service for Expo
class WebSocketService {
    constructor() {
        this.ws = null;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.messageQueue = [];
        this.isConnected = false;
    }

    connect(token, serverUrl = '10.93.59.170:8000') {
        // For Expo Go, use your computer's actual IP address
        // Find it with: ipconfig (Windows) or ifconfig (Mac/Linux)
        const wsUrl = `ws://${serverUrl}/ws/chat/?token=${token}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('✅ WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.flushMessageQueue();
            this.emit('connected', {});
            this.startHeartbeat();
        };

        this.ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            this.isConnected = false;
            this.emit('disconnected', {});
            this.attemptReconnect(token, serverUrl);
        };

        this.ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error.message);
            this.emit('error', error);
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Failed to parse message:', error);
            }
        };
    }

    disconnect() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }

    send(type, payload, requestId = null) {
        const message = {
            type,
            payload,
            request_id: requestId || `req-${Date.now()}`,
        };

        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            this.messageQueue.push(message);
        }
    }

    sendTextMessage(chatId, content) {
        this.send('message.send', {
            chat_id: chatId,
            message_type: 'text',
            content,
        });
    }

    sendTypingStart(chatId) {
        this.send('typing.start', { chat_id: chatId });
    }

    sendTypingStop(chatId) {
        this.send('typing.stop', { chat_id: chatId });
    }

    markAsRead(chatId, messageId) {
        this.send('message.read', { chat_id: chatId, message_id: messageId });
    }

    handleMessage(data) {
        const { type, payload } = data;
        this.emit(type, payload);
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) this.send('ping', {});
        }, 30000);
    }

    attemptReconnect(token, serverUrl) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`🔄 Reconnecting in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect(token, serverUrl), delay);
        } else {
            console.error('❌ Max reconnection attempts reached');
            this.emit('max_reconnect_reached', {});
        }
    }

    flushMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.ws.send(JSON.stringify(message));
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }
}

const webSocketService = new WebSocketService();
export default webSocketService;
