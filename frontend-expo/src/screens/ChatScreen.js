import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import webSocketService from '../services/WebSocketService';
import apiService from '../services/APIService';

export default function ChatScreen({ route }) {
    const { chatId, chatName } = route.params;
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);
    const flatListRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    useEffect(() => {
        // Get current user info from token
        const fetchUserInfo = async () => {
            try {
                const token = await apiService.getToken();
                if (token) {
                    // Decode JWT to get user ID (simple decode, not validation)
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    setCurrentUserId(payload.user_id);
                }
            } catch (error) {
                console.error('Failed to get user info:', error);
            }
        };
        fetchUserInfo();

        // Load existing messages
        const loadMessages = async () => {
            try {
                const messageHistory = await apiService.getChatMessages(chatId);
                setMessages(messageHistory);
                setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
            } catch (error) {
                console.error('Failed to load messages:', error);
            }
        };
        loadMessages();

        // Listen for messages
        webSocketService.on('message.new', handleNewMessage);
        webSocketService.on('typing.start', () => setIsTyping(true));
        webSocketService.on('typing.stop', () => setIsTyping(false));

        return () => {
            webSocketService.off('message.new', handleNewMessage);
        };
    }, [chatId]);

    const handleNewMessage = (message) => {
        // Check if message already exists (avoid duplicates from WebSocket echo)
        setMessages(prev => {
            // Check if we already have this message (by ID or by matching recent content)
            const isDuplicate = prev.some(msg =>
                msg.message_id === message.message_id ||
                (msg.content === message.content &&
                    msg.sender_id === message.sender_id &&
                    Math.abs(new Date(msg.timestamp) - new Date(message.timestamp)) < 2000)
            );

            if (isDuplicate) {
                return prev;
            }

            return [...prev, message];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    };

    const sendMessage = () => {
        if (inputText.trim() && currentUserId) {
            const tempMessage = {
                message_id: Date.now(),
                content: inputText.trim(),
                sender_id: currentUserId, // Use actual user ID
                timestamp: new Date().toISOString(),
                status: 'sent',
            };

            setMessages(prev => [...prev, tempMessage]);
            webSocketService.sendTextMessage(chatId, inputText.trim());
            setInputText('');
            webSocketService.sendTypingStop(chatId);
            setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        }
    };

    const handleTextChange = (text) => {
        setInputText(text);
        if (text.length > 0) webSocketService.sendTypingStart(chatId);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            webSocketService.sendTypingStop(chatId);
        }, 2000);
    };

    const renderMessage = ({ item }) => {
        // Handle both string and object sender_id, and ensure comparison works
        const messageSenderId = typeof item.sender_id === 'string'
            ? item.sender_id
            : item.sender_id?.toString() || item.sender?.toString();

        const isMyMessage = currentUserId && messageSenderId === currentUserId.toString();

        // Get timestamp - fallback to created_at if timestamp is not available
        const messageTime = item.timestamp || item.created_at;
        const displayTime = messageTime
            ? new Date(messageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';

        return (
            <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.otherMessage]}>
                <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>
                    {item.content}
                </Text>
                <View style={styles.messageFooter}>
                    <Text style={[styles.messageTime, isMyMessage && styles.myMessageTime]}>
                        {displayTime}
                    </Text>
                    {isMyMessage && (
                        <Text style={styles.messageStatus}>
                            {item.status === 'read' && '✓✓'}
                            {item.status === 'delivered' && '✓✓'}
                            {item.status === 'sent' && '✓'}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={90}>
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item, index) => item.message_id?.toString() || index.toString()}
                contentContainerStyle={styles.messageList}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>Start a conversation!</Text>
                        <Text style={styles.emptyHint}>Send a message to test the WebSocket connection</Text>
                    </View>
                }
            />

            {isTyping && (
                <View style={styles.typingIndicator}>
                    <Text style={styles.typingText}>Typing...</Text>
                </View>
            )}

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    value={inputText}
                    onChangeText={handleTextChange}
                    placeholder="Type a message..."
                    multiline
                    maxHeight={100}
                />
                <TouchableOpacity
                    style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                    onPress={sendMessage}
                    disabled={!inputText.trim()}>
                    <Text style={styles.sendButtonText}>Send</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    messageList: {
        padding: 16,
        flexGrow: 1,
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptyHint: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
        marginVertical: 4,
    },
    myMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#007AFF',
    },
    otherMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#fff',
    },
    messageText: {
        fontSize: 16,
        color: '#000',
    },
    myMessageText: {
        color: '#fff',
    },
    messageFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 4,
    },
    messageTime: {
        fontSize: 11,
        color: '#666',
        marginRight: 4,
    },
    myMessageTime: {
        color: 'rgba(255,255,255,0.7)',
    },
    messageStatus: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.7)',
    },
    typingIndicator: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    typingText: {
        fontStyle: 'italic',
        color: '#888',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 8,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#ddd',
    },
    input: {
        flex: 1,
        minHeight: 40,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
    },
    sendButton: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#007AFF',
        borderRadius: 20,
        paddingHorizontal: 20,
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
    sendButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
