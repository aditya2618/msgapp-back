// API Service for HTTP requests
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

// IMPORTANT: Replace with your computer's IP address
// Find it with: ipconfig (Windows) or ifconfig (Mac/Linux)
const BASE_URL = 'http://192.168.29.91:8003/api';

class APIService {
    constructor() {
        this.axios = axios.create({
            baseURL: BASE_URL,
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' },
        });

        this.axios.interceptors.request.use(async (config) => {
            const token = await SecureStore.getItemAsync('accessToken');
            if (token) config.headers.Authorization = `Bearer ${token}`;
            return config;
        });

        this.axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;
                    try {
                        const refreshToken = await SecureStore.getItemAsync('refreshToken');
                        const response = await axios.post(`${BASE_URL}/auth/token/refresh/`, {
                            refresh: refreshToken,
                        });
                        const { access } = response.data;
                        await SecureStore.setItemAsync('accessToken', access);
                        originalRequest.headers.Authorization = `Bearer ${access}`;
                        return this.axios(originalRequest);
                    } catch (refreshError) {
                        await this.logout();
                        throw refreshError;
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    async login(username, password) {
        const response = await this.axios.post('/auth/token/', { username, password });
        const { access, refresh } = response.data;
        await SecureStore.setItemAsync('accessToken', access);
        await SecureStore.setItemAsync('refreshToken', refresh);
        return response.data;
    }

    async register(username, email, phone, password) {
        const response = await this.axios.post('/auth/register/', {
            username,
            email,
            phone,
            password,
        });
        return response.data;
    }

    async forgotPassword(email) {
        const response = await this.axios.post('/auth/forgot-password/', { email });
        return response.data;
    }

    async resetPassword(email, otp, newPassword) {
        const response = await this.axios.post('/auth/reset-password/', {
            email,
            otp,
            new_password: newPassword,
        });
        return response.data;
    }

    async searchUsers(query) {
        const response = await this.axios.get('/auth/search/', {
            params: { q: query }
        });
        return response.data;
    }

    async logout() {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
    }

    async getToken() {
        return await SecureStore.getItemAsync('accessToken');
    }

    async initiateFileUpload(fileName, mimeType, sizeBytes, checksum) {
        const response = await this.axios.post('/files/init/', {
            file_name: fileName,
            mime_type: mimeType,
            size_bytes: sizeBytes,
            checksum,
        });
        return response.data;
    }

    async getChats() {
        const response = await this.axios.get('/chat/chats/');
        return response.data;
    }

    async getChatMessages(chatId) {
        const response = await this.axios.get(`/chat/chats/${chatId}/messages/`);
        return response.data;
    }

    async markChatRead(chatId) {
        const response = await this.axios.post(`/chat/chats/${chatId}/mark_read/`);
        return response.data;
    }

    async createChat(type, participantIds, name = null) {
        const response = await this.axios.post('/chat/chats/', {
            type: type,
            name,
            participant_ids: participantIds,
        });
        return response.data;
    }

    async updateChat(chatId, data) {
        const response = await this.axios.patch(`/chat/chats/${chatId}/`, data);
        return response.data;
    }

    async deleteChat(chatId) {
        await this.axios.delete(`/chat/chats/${chatId}/`);
    }

    async leaveChat(chatId) {
        const response = await this.axios.post(`/chat/chats/${chatId}/leave/`);
        return response.data;
    }

    async addParticipants(chatId, userIds) {
        const response = await this.axios.post(`/chat/chats/${chatId}/add_participants/`, { user_ids: userIds });
        return response.data;
    }

    async removeParticipant(chatId, userId) {
        const response = await this.axios.post(`/chat/chats/${chatId}/remove_participant/`, { user_id: userId });
        return response.data;
    }

    async getChatMessages(chatId) {
        const response = await this.axios.get(`/chat/chats/${chatId}/messages/`);
        return response.data;
    }
}

const apiService = new APIService();
export default apiService;
