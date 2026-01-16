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

export default function CreateGroupScreen({ navigation }) {
    const [groupName, setGroupName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
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

    const toggleUserSelection = (user) => {
        const isSelected = selectedUsers.find(u => u.id === user.id);
        if (isSelected) {
            setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
        } else {
            setSelectedUsers([...selectedUsers, user]);
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            Alert.alert('Error', 'Please enter a group name');
            return;
        }

        if (selectedUsers.length < 1) {
            Alert.alert('Error', 'Please select at least one member');
            return;
        }

        setCreating(true);
        try {
            const participantIds = selectedUsers.map(u => u.id);
            const chat = await apiService.createChat(participantIds, 'group', groupName.trim());

            navigation.navigate('Chat', {
                chatId: chat.id,
                chatName: chat.chat_name || groupName.trim()
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to create group');
            console.error(error);
        } finally {
            setCreating(false);
        }
    };

    const renderUser = ({ item }) => {
        const isSelected = selectedUsers.find(u => u.id === item.id);

        return (
            <TouchableOpacity
                style={[styles.userItem, isSelected && styles.userItemSelected]}
                onPress={() => toggleUserSelection(item)}>
                <View style={styles.userAvatar}>
                    <Text style={styles.avatarText}>{item.username[0].toUpperCase()}</Text>
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.username}>{item.username}</Text>
                    <Text style={styles.userEmail}>{item.email || item.phone}</Text>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
            </TouchableOpacity>
        );
    };

    const renderSelectedUser = ({ item }) => (
        <View style={styles.selectedChip}>
            <Text style={styles.chipText}>{item.username}</Text>
            <TouchableOpacity onPress={() => toggleUserSelection(item)}>
                <Text style={styles.chipRemove}>×</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Group Name Input */}
            <View style={styles.groupNameSection}>
                <TextInput
                    style={styles.groupNameInput}
                    placeholder="Group Name"
                    value={groupName}
                    onChangeText={setGroupName}
                    maxLength={50}
                />
            </View>

            {/* Selected Users */}
            {selectedUsers.length > 0 && (
                <View style={styles.selectedSection}>
                    <Text style={styles.selectedTitle}>
                        Selected ({selectedUsers.length})
                    </Text>
                    <FlatList
                        horizontal
                        data={selectedUsers}
                        renderItem={renderSelectedUser}
                        keyExtractor={(item) => item.id}
                        style={styles.selectedList}
                        showsHorizontalScrollIndicator={false}
                    />
                </View>
            )}

            {/* Search Section */}
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

            {/* Search Results */}
            <FlatList
                data={searchResults}
                renderItem={renderUser}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            {searchQuery ? 'No users found' : 'Search for users to add to group'}
                        </Text>
                    </View>
                }
            />

            {/* Create Button */}
            {selectedUsers.length > 0 && (
                <TouchableOpacity
                    style={styles.createButton}
                    onPress={handleCreateGroup}
                    disabled={creating}>
                    {creating ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.createButtonText}>
                            Create Group ({selectedUsers.length + 1} members)
                        </Text>
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    groupNameSection: {
        backgroundColor: '#fff',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    groupNameInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    selectedSection: {
        backgroundColor: '#fff',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    selectedTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    selectedList: {
        flexGrow: 0,
    },
    selectedChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#007AFF',
        borderRadius: 16,
        paddingVertical: 6,
        paddingHorizontal: 12,
        marginRight: 8,
    },
    chipText: {
        color: '#fff',
        fontSize: 14,
        marginRight: 4,
    },
    chipRemove: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
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
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    userItemSelected: {
        backgroundColor: '#e3f2fd',
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
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxSelected: {
        backgroundColor: '#007AFF',
    },
    checkmark: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
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
    createButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        margin: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    createButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
