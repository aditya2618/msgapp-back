import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
    TextInput,
    ActivityIndicator,
    Modal,
    ScrollView
} from 'react-native';
import apiService from '../services/APIService';

export default function ChatDetailsScreen({ route, navigation }) {
    const { chatId, chatName, isGroup } = route.params;
    const [chat, setChat] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState(chatName);
    const [isEditingName, setIsEditingName] = useState(false);

    // Add Member Modal State
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        loadDetails();
        getCurrentUser();
    }, []);

    const getCurrentUser = async () => {
        const token = await apiService.getToken();
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setCurrentUser(payload);
        }
    };

    const loadDetails = async () => {
        try {
            // Need a retrieve endpoint. ChatViewSet details=True returns chat object with participants.
            // Let's assume GET /chats/{id}/ returns participants.
            // Wait, does ChatSerializer include participants? Yes.
            const data = await apiService.axios.get(`/chat/chats/${chatId}/`);
            setChat(data.data);
            setParticipants(data.data.participants);
            setNewName(data.data.name || data.data.chat_name);
        } catch (error) {
            console.error('Failed to load details:', error);
            Alert.alert('Error', 'Failed to load chat details');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateName = async () => {
        if (!newName.trim()) return;
        try {
            await apiService.updateChat(chatId, { name: newName.trim() });
            setIsEditingName(false);
            Alert.alert('Success', 'Group name updated');
            loadDetails();
        } catch (error) {
            Alert.alert('Error', 'Failed to update name');
        }
    };

    const handleAddMember = async (userId) => {
        try {
            await apiService.addParticipants(chatId, [userId]);
            Alert.alert('Success', 'Member added');
            setIsAddModalVisible(false);
            loadDetails();
        } catch (error) {
            Alert.alert('Error', 'Failed to add member');
        }
    };

    const handleRemoveMember = async (userId) => {
        Alert.alert('Confirm', 'Remove this user?', [
            { text: 'Cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await apiService.removeParticipant(chatId, userId);
                        loadDetails();
                    } catch (error) {
                        Alert.alert('Error', 'Failed to remove member');
                    }
                }
            }
        ]);
    };

    const handleLeaveGroup = async () => {
        Alert.alert('Confirm', 'Leave this group?', [
            { text: 'Cancel' },
            {
                text: 'Leave',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await apiService.leaveChat(chatId);
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'ChatList' }],
                        });
                    } catch (error) {
                        Alert.alert('Error', 'Failed to leave group');
                    }
                }
            }
        ]);
    };

    const handleDeleteGroup = async () => {
        Alert.alert('Confirm', 'Delete this group permanently? This cannot be undone.', [
            { text: 'Cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await apiService.deleteChat(chatId);
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'ChatList' }],
                        });
                    } catch (error) {
                        Alert.alert('Error', 'Failed to delete group');
                    }
                }
            }
        ]);
    };

    const handleSearch = async () => {
        if (searchQuery.length < 2) return;
        setSearching(true);
        try {
            const results = await apiService.searchUsers(searchQuery);
            // Filter out existing participants
            // New structure: p.user.id
            const existingIds = participants.map(p => p.user.id);
            const filtered = results.filter(u => !existingIds.includes(u.id));
            setSearchResults(filtered);
        } catch (error) {
            console.error(error);
        } finally {
            setSearching(false);
        }
    };

    const isAdmin = () => {
        if (!currentUser || !participants) return false;
        // Check if current user is admin
        const me = participants.find(p => p.user.id === currentUser.user_id);
        return me?.role === 'admin';
    };

    const renderParticipant = ({ item }) => (
        <View style={styles.memberItem}>
            <View style={styles.memberInfo}>
                <View style={[styles.avatar, { backgroundColor: '#ddd' }]}>
                    <Text>{item.user.username[0].toUpperCase()}</Text>
                </View>
                <View>
                    <Text style={styles.memberName}>{item.user.username}</Text>
                    {item.role === 'admin' && <Text style={{ fontSize: 12, color: '#007AFF' }}>Admin</Text>}
                </View>
                {/* if item.user.id is me... */}
                {currentUser && item.user.id === currentUser.user_id && <Text style={styles.meTag}>(You)</Text>}
            </View>
            {/* Show remove button if I am admin and item is not me */}
            {isAdmin() && currentUser && item.user.id !== currentUser.user_id && (
                <TouchableOpacity onPress={() => handleRemoveMember(item.user.id)}>
                    <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                {isEditingName ? (
                    <View style={styles.editNameRow}>
                        <TextInput
                            style={styles.nameInput}
                            value={newName}
                            onChangeText={setNewName}
                        />
                        <TouchableOpacity onPress={handleUpdateName}><Text style={styles.saveBtn}>Save</Text></TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.nameRow}>
                        <Text style={styles.title}>{chat?.name || chat?.chat_name}</Text>
                        {/* Only show edit if group AND admin */}
                        {isGroup && isAdmin() && (
                            <TouchableOpacity onPress={() => setIsEditingName(true)}><Text style={styles.editBtn}>✎</Text></TouchableOpacity>
                        )}
                    </View>
                )}
                <Text style={styles.subtitle}>{isGroup ? 'Group' : 'Private Chat'} • {participants ? participants.length : 0} members</Text>
            </View>

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Members</Text>
                    {isGroup && isAdmin() && (
                        <TouchableOpacity onPress={() => setIsAddModalVisible(true)}>
                            <Text style={styles.addBtn}>+ Add Member</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <FlatList
                    data={participants}
                    renderItem={renderParticipant}
                    keyExtractor={item => item.user.id.toString()}
                    scrollEnabled={false}
                />
            </View>

            <View style={styles.actions}>
                {/* Leave is for members (not admin) */}
                {isGroup && !isAdmin() && (
                    <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveGroup}>
                        <Text style={styles.leaveText}>Exit Group</Text>
                    </TouchableOpacity>
                )}

                {/* Delete is Admin only */}
                {isGroup && isAdmin() && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteGroup}>
                        <Text style={styles.deleteText}>Delete Group</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Add Member Modal */}
            <Modal visible={isAddModalVisible} animationType="slide">
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Add Member</Text>
                        <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                            <Text style={styles.closeBtn}>Close</Text>
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search users..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                    />
                    <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                        <Text style={{ color: 'white' }}>Search</Text>
                    </TouchableOpacity>

                    <FlatList
                        data={searchResults}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.userItem} onPress={() => handleAddMember(item.id)}>
                                <Text style={styles.username}>{item.username}</Text>
                                <Text style={styles.addText}>Add</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#eee', alignItems: 'center' },
    title: { fontSize: 22, fontWeight: 'bold' },
    subtitle: { color: '#888', marginTop: 5 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    editNameRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
    nameInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 8, marginRight: 10 },
    saveBtn: { color: '#007AFF', fontWeight: 'bold' },
    editBtn: { fontSize: 20, marginLeft: 10, color: '#007AFF' },
    section: { marginTop: 20, backgroundColor: 'white', padding: 15 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold' },
    addBtn: { color: '#007AFF', fontWeight: 'bold' },
    memberItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f0f0f0' },
    avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    memberName: { fontSize: 16, flex: 1 },
    meTag: { color: '#888', fontSize: 14, marginRight: 10 },
    removeText: { color: 'red' },
    actions: { padding: 20 },
    leaveBtn: { backgroundColor: 'white', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
    leaveText: { color: 'orange', fontWeight: 'bold', fontSize: 16 },
    deleteBtn: { backgroundColor: 'white', padding: 15, borderRadius: 10, alignItems: 'center' },
    deleteText: { color: 'red', fontWeight: 'bold', fontSize: 16 },
    // Modal
    modalContainer: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#f5f5f5' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    closeBtn: { color: 'blue', fontSize: 16 },
    searchInput: { backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 10 },
    searchButton: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 20 },
    userItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, backgroundColor: 'white', marginBottom: 1, borderRadius: 8 },
    username: { fontSize: 16 },
    addText: { color: '#007AFF', fontWeight: 'bold' }
});
