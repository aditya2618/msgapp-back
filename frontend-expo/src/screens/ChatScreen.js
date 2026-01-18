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

export default function ChatScreen({ route, navigation }) {
    const { chatId, chatName } = route.params;
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [otherUserOnline, setOtherUserOnline] = useState(true); // Default to true for now
    const flatListRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Set up navigation header with online status
    useEffect(() => {
        console.log('📱 Updating header - otherUserOnline:', otherUserOnline);
        navigation.setOptions({
            headerTitle: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => navigation.navigate('ChatDetails', { chatId, chatName })}>
                        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
                            {chatName}
                        </Text>
                    </TouchableOpacity>
                    {otherUserOnline && (
                        <View style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: '#4CAF50',
                            marginLeft: 8,
                        }} />
                    )}
                </View>
            ),
            headerRight: () => (
                <TouchableOpacity onPress={() => navigation.navigate('ChatDetails', { chatId, chatName })} style={{ padding: 10 }}>
                    <Text style={{ color: '#fff', fontSize: 20 }}>ⓘ</Text>
                </TouchableOpacity>
            ),
        });
    }, [chatName, otherUserOnline, navigation]);

    useEffect(() => {
        // Get current user info from token
        const fetchUserInfo = async () => {
            try {
                const token = await apiService.getToken();
                if (token) {
                    // Decode JWT to get user ID (simple decode, not validation)
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    setCurrentUserId(payload.user_id);

                    // Ensure WebSocket is connected
                    if (!webSocketService.isConnected) {
                        console.log('🔄 WebSocket not connected, reconnecting...');
                        webSocketService.connect(token);
                    } else {
                        console.log('✅ WebSocket already connected');
                    }
                }
            } catch (error) {
                console.error('Failed to get user info:', error);
            }
        };
        fetchUserInfo();

        // Load existing messages
        const loadMessages = async () => {
            try {
                // 1. Fetch messages first (before marking read) to know which were unread
                const messageHistory = await apiService.getChatMessages(chatId);
                console.log('📜 Loaded message history, count:', messageHistory.length);

                // 2. Find the first unread message from OTHERS
                const firstUnreadIndex = messageHistory.findIndex(m => {
                    const isFromMe = m.sender_id === currentUserId || m.sender_id?.toString() === currentUserId?.toString();
                    return !isFromMe && m.status !== 'read';
                });

                console.log('📍 First unread index:', firstUnreadIndex);

                setMessages(messageHistory);

                // 3. Smart Scroll
                setTimeout(() => {
                    if (firstUnreadIndex !== -1) {
                        try {
                            flatListRef.current?.scrollToIndex({
                                index: firstUnreadIndex,
                                viewPosition: 0, // 0 = top of screen
                                animated: true
                            });
                        } catch (e) {
                            console.warn('Scroll failed, falling back to end', e);
                            flatListRef.current?.scrollToEnd({ animated: false });
                        }
                    } else {
                        flatListRef.current?.scrollToEnd({ animated: false });
                    }
                }, 500); // Give FlatList time to render

                // 4. NOW mark as read (backend will broadcast update)
                console.log('👀 Marking chat as read...');
                await apiService.markChatRead(chatId);

            } catch (error) {
                console.error('Failed to load messages:', error);
            }
        };
        loadMessages();

        // Listen for messages
        webSocketService.on('message.new', handleNewMessage);
        webSocketService.on('typing.start', handleTypingStart);
        webSocketService.on('typing.stop', handleTypingStop);
        webSocketService.on('message.read', handleMessageRead);

        return () => {
            webSocketService.off('message.new', handleNewMessage);
            webSocketService.off('typing.start', handleTypingStart);
            webSocketService.off('typing.stop', handleTypingStop);
            webSocketService.off('message.read', handleMessageRead);
        };
    }, [chatId]);

    const handleMessageRead = (payload) => {
        console.log('✅ Message read receipt received:', payload);
        const { message_id } = payload;

        setMessages(prev => prev.map(msg => {
            if (msg.message_id === message_id || msg.id === message_id) {
                return { ...msg, status: 'read' };
            }
            return msg;
        }));
    };

    const handleTypingStart = () => {
        setIsTyping(true);
        setOtherUserOnline(true); // If typing, they're online
    };

    const handleTypingStop = () => {
        setIsTyping(false);
    };

    const handleNewMessage = (message) => {
        console.log('📨 Received new message:', message);
        console.log('Current chatId:', chatId);
        console.log('Message chatId:', message.chat_id);

        // CRITICAL: Only accept messages for THIS chat
        if (message.chat_id !== chatId) {
            console.log('❌ Ignoring message from different chat');
            return; // Ignore messages from other chats
        }

        console.log('✅ Adding message to current chat');

        // If message is from someone else, they're online
        if (currentUserId && message.sender_id !== currentUserId.toString() && message.sender_id !== currentUserId) {
            console.log('🟢 Setting other user as ONLINE');
            setOtherUserOnline(true);
        } else {
            console.log('Current user sent this message, not updating online status');
        }

        setMessages(prev => {
            console.log('📝 Current message count:', prev.length);
            // First, replace any temporary message with the same content/sender
            const withoutTemp = prev.filter(msg => {
                // Remove temp message if we get the real one from server
                if (msg.message_id?.toString().startsWith('temp_')) {
                    const isSameMessage =
                        msg.content === message.content &&
                        msg.sender_id === message.sender_id &&
                        Math.abs(new Date(msg.timestamp) - new Date(message.timestamp)) < 5000;
                    return !isSameMessage;
                }
                return true;
            });

            // Check if message already exists by server ID
            const isDuplicate = withoutTemp.some(msg =>
                msg.message_id === message.message_id
            );

            if (isDuplicate) {
                console.log('⚠️ Duplicate message, ignoring');
                return withoutTemp;
            }

            console.log('➕ Adding new message');
            return [...withoutTemp, message];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    };

    const sendMessage = () => {
        if (inputText.trim() && currentUserId) {
            console.log('📤 Sending message:', inputText.trim());
            console.log('To chat:', chatId);
            console.log('From user:', currentUserId);

            const tempMessage = {
                message_id: `temp_${Date.now()}`,  // Prefix temp IDs
                content: inputText.trim(),
                sender_id: currentUserId,
                timestamp: new Date().toISOString(),
                status: 'sent',
            };

            setMessages(prev => [...prev, tempMessage]);
            console.log('✅ Added optimistic message');

            try {
                webSocketService.sendTextMessage(chatId, inputText.trim());
                console.log('✅ Message sent via WebSocket');
            } catch (error) {
                console.error('❌ Error sending message:', error);
            }

            setInputText('');
            webSocketService.sendTypingStop(chatId);
            setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        } else {
            console.log('⚠️ Cannot send message - missing input or user ID');
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

        // Get sender name for messages from others
        const senderName = item.sender_username || item.sender_name || 'User';

        return (
            <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.otherMessage]}>
                {!isMyMessage && (
                    <Text style={styles.senderName}>{senderName}</Text>
                )}
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
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item, index) => item.message_id?.toString() || index.toString()}
                contentContainerStyle={styles.messageList}
                onScrollToIndexFailed={info => {
                    const wait = new Promise(resolve => setTimeout(resolve, 500));
                    wait.then(() => {
                        flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                    });
                }}
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
    senderName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#007AFF',
        marginBottom: 4,
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
        paddingBottom: Platform.OS === 'android' ? 16 : 8,
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
