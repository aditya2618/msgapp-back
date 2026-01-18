import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Alert, Modal, TouchableWithoutFeedback, Platform } from 'react-native';
import apiService from '../services/APIService';
import webSocketService from '../services/WebSocketService';

export default function ChatListScreen({ navigation }) {
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState({}); // Track unread per chat
    const [currentUserId, setCurrentUserId] = useState(null); // Track current user
    const [menuVisible, setMenuVisible] = useState(false);

    // Logic to update state when a new message arrives
    const handleNewMessage = React.useCallback((message) => {
        const chatId = message.chat_id;
        const senderId = message.sender_id;

        console.log('📨 ChatList: New message received');

        // Check if we have this chat in our list
        const chatExists = chats.some(c => c.id === chatId);
        if (!chatExists && chats.length > 0) { // Only reload if we have loaded at least once
            console.log('🆕 Message for meaningful/new chat, reloading list...');
            loadChats();
        }

        // Only increment unread if message is from someone else
        const senderIdStr = String(senderId);
        const currentUserIdStr = String(currentUserId);

        if (currentUserId && senderIdStr !== currentUserIdStr) {
            console.log('📬 New message from OTHER user, incrementing unread count');
            setUnreadCounts(prev => ({
                ...prev,
                [chatId]: (prev[chatId] || 0) + 1
            }));
        }
    }, [currentUserId, chats]); // Added chats dependency

    // Reload chats when screen gains focus (e.g. coming back from New Chat)
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            console.log('👀 ChatList focused, refreshing...');
            loadChats();
        });
        return unsubscribe;
    }, [navigation]);

    useEffect(() => {
        // Get current user ID
        const getCurrentUser = async () => {
            try {
                const token = await apiService.getToken();
                if (token) {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    setCurrentUserId(payload.user_id);
                }
            } catch (error) {
                console.error('Failed to get user ID:', error);
            }
        };
        getCurrentUser();

        // Set header buttons
        navigation.setOptions({
            headerLeft: () => null, // Remove default back/logout button
            headerRight: () => (
                <TouchableOpacity
                    onPress={() => setMenuVisible(true)}
                    style={{ marginRight: 15 }}>
                    <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>⋮</Text>
                </TouchableOpacity>
            ),
        });

        loadChats(); // Initial load
    }, [navigation]);

    // WebSocket listener effect - depends on handleNewMessage which depends on currentUserId
    useEffect(() => {
        if (!currentUserId) return; // Wait for user ID

        const handleNewChat = (data) => {
            console.log('🆕 New chat event received, reloading list...');
            loadChats();
        };

        console.log('🔌 Setting up WebSocket listener with user ID:', currentUserId);
        webSocketService.on('message.new', handleNewMessage);
        webSocketService.on('chat.new', handleNewChat);

        return () => {
            webSocketService.off('message.new', handleNewMessage);
            webSocketService.off('chat.new', handleNewChat);
        };
    }, [handleNewMessage, currentUserId]);

    const handleLogout = () => {
        setMenuVisible(false);
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Disconnect WebSocket
                            webSocketService.disconnect();

                            // Clear tokens
                            await apiService.logout();

                            // Navigate to login
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        } catch (error) {
                            console.error('Logout error:', error);
                            Alert.alert('Error', 'Failed to logout properly');
                        }
                    }
                }
            ]
        );
    };

    const loadChats = async () => {
        try {
            console.log('🔄 Loading chats...');
            const data = await apiService.getChats();
            console.log('📥 Chats data received, count:', data.length);
            setChats(data);

            // Initialize unread counts from API data
            const initialUnread = {};
            data.forEach(chat => {
                // console.log(`Chat ${chat.id} unread_count from API:`, chat.unread_count);
                if (chat.unread_count > 0) {
                    initialUnread[chat.id] = chat.unread_count;
                }
            });
            console.log('🔢 Initial unread counts:', JSON.stringify(initialUnread));
            setUnreadCounts(initialUnread);
        } catch (error) {
            console.error('Failed to load chats:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadChats();
    };

    const renderChat = ({ item }) => {
        const chatName = item.chat_name || item.name || 'Chat';
        const lastMessage = 'Tap to start messaging';
        const unreadCount = unreadCounts[item.id] || 0;

        // Show online status only for private chats
        const isPrivateChat = item.type === 'private';
        const otherUserOnline = item.other_user_online || false; // Assuming backend provides this

        return (
            <TouchableOpacity
                style={styles.chatItem}
                onPress={() => {
                    // Clear unread count when opening chat
                    setUnreadCounts(prev => ({
                        ...prev,
                        [item.id]: 0
                    }));
                    navigation.navigate('Chat', { chatId: item.id, chatName });
                }}>
                <View style={styles.chatInfo}>
                    <View style={styles.chatNameRow}>
                        <Text style={styles.chatName}>{chatName}</Text>
                        {isPrivateChat && otherUserOnline && (
                            <View style={styles.onlineIndicator} />
                        )}
                    </View>
                    <Text style={styles.lastMessage}>{lastMessage}</Text>
                </View>
                <View style={styles.rightSection}>
                    <Text style={styles.time}>Now</Text>
                    {unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadCount}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={chats}
                renderItem={renderChat}
                keyExtractor={item => item.id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No chats yet</Text>
                        <Text style={styles.emptyHint}>Tap the + button to start a new chat!</Text>
                    </View>
                }
            />

            {/* Floating Action Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('NewChat')}>
                <Text style={styles.fabIcon}>+</Text>
            </TouchableOpacity>

            {/* Menu Modal */}
            <Modal
                transparent={true}
                visible={menuVisible}
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}>
                <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.menuContainer}>
                            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); Alert.alert('Profile', 'Profile feature coming soon!'); }}>
                                <Text style={styles.menuText}>Profile</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); Alert.alert('Settings', 'Settings feature coming soon!'); }}>
                                <Text style={styles.menuText}>Settings</Text>
                            </TouchableOpacity>
                            <View style={styles.menuDivider} />
                            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                                <Text style={[styles.menuText, { color: 'red' }]}>Logout</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    chatItem: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    chatInfo: {
        flex: 1,
    },
    chatNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    chatName: {
        fontSize: 18,
        fontWeight: '600',
        marginRight: 8,
    },
    onlineIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#4CAF50',
    },
    lastMessage: {
        fontSize: 14,
        color: '#666',
    },
    rightSection: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    time: {
        fontSize: 12,
        color: '#999',
        marginBottom: 4,
    },
    unreadBadge: {
        backgroundColor: '#007AFF',
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadCount: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    empty: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptyHint: {
        fontSize: 14,
        color: '#666',
    },
    // FAB Styles
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    fabIcon: {
        fontSize: 32,
        color: 'white',
        fontWeight: 'bold',
        marginTop: -2,
    },
    // Menu Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.1)', // Slight dim
        alignItems: 'flex-end',
    },
    menuContainer: {
        marginTop: Platform.OS === 'ios' ? 60 : 50, // Adjust based on header height
        marginRight: 10,
        backgroundColor: 'white',
        borderRadius: 8,
        paddingVertical: 4,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        minWidth: 150,
    },
    menuItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    menuText: {
        fontSize: 16,
        color: '#333',
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 4,
    },
});
