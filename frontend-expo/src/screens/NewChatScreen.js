import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    Alert,
} from 'react-native';
import apiService from '../services/APIService';

export default function NewChatScreen({ navigation }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    const handleSearch = async () => {
        if (searchQuery.trim().length < 2) {
            Alert.alert('Error', 'Please enter at least 2 characters');
            return;
        }

        setLoading(true);
        try {
            const results = await apiService.searchUsers(searchQuery.trim());
            setSearchResults(results);
        } catch (error) {
            Alert.alert('Error', 'Failed to search users');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateChat = async (user) => {
        setCreating(true);
        try {
            const chat = await apiService.createChat([user.id], 'private');
            Alert.alert('Success', `Chat created with ${user.username}`);
            navigation.navigate('Chat', {
                chatId: chat.id,
                chatName: user.username
            });
        } catch (error) {
            if (error.response?.status === 400) {
                Alert.alert('Info', 'Chat might already exist. Check your chat list.');
            } else {
                Alert.alert('Error', 'Failed to create chat');
            }
            console.error(error);
        } finally {
            setCreating(false);
        }
    };

    const renderUser = ({ item }) => (
        <TouchableOpacity
            style={styles.userItem}
            onPress={() => handleCreateChat(item)}
            disabled={creating}>
            <View style={styles.userAvatar}>
                <Text style={styles.avatarText}>{item.username[0].toUpperCase()}</Text>
            </View>
            <View style={styles.userInfo}>
                <Text style={styles.username}>{item.username}</Text>
                <Text style={styles.userEmail}>{item.email}</Text>
            </View>
            <Text style={styles.chatButton}>Chat</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Options Section */}
            <View style={styles.optionsContainer}>
                <Text style={styles.optionsTitle}>New Chat</Text>
                <TouchableOpacity
                    style={styles.groupButton}
                    onPress={() => navigation.navigate('CreateGroup')}>
                    <Text style={styles.groupButtonText}>➕ Create Group</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name, email, or phone..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleSearch}
                    autoCapitalize="none"
                />
                <TouchableOpacity
                    style={styles.searchButton}
                    onPress={handleSearch}
                    disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.searchButtonText}>Search</Text>
                    )}
                </TouchableOpacity>
            </View>

            {creating && (
                <View style={styles.creatingContainer}>
                    <ActivityIndicator color="#007AFF" />
                    <Text style={styles.creatingText}>Creating chat...</Text>
                </View>
            )}

            <FlatList
                data={searchResults}
                renderItem={renderUser}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            {searchQuery ? 'No users found' : 'Search for users to start a private chat'}
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    optionsContainer: {
        backgroundColor: '#fff',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    optionsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    groupButton: {
        backgroundColor: '#34C759',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    groupButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    searchContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    searchInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        marginRight: 8,
        fontSize: 16,
    },
    searchButton: {
        backgroundColor: '#007AFF',
        borderRadius: 8,
        paddingHorizontal: 20,
        justifyContent: 'center',
        minWidth: 80,
    },
    searchButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    creatingContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#e3f2fd',
    },
    creatingText: {
        marginLeft: 10,
        color: '#007AFF',
        fontSize: 16,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    userAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
    },
    username: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    userEmail: {
        fontSize: 14,
        color: '#666',
    },
    chatButton: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '600',
    },
    empty: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
    },
});
