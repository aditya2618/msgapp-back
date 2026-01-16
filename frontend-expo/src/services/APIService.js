// API Service for HTTP requests
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

// IMPORTANT: Replace with your computer's IP address
// Find it with: ipconfig (Windows) or ifconfig (Mac/Linux)
const BASE_URL = 'http://10.93.59.170:8000/api';

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

    async createChat(participantIds, chatType = 'private', name = null) {
        const response = await this.axios.post('/chat/chats/', {
            type: chatType,
            name,
            participant_ids: participantIds,
        });
        return response.data;
    }

    async getChatMessages(chatId) {
        const response = await this.axios.get(`/chat/chats/${chatId}/messages/`);
        return response.data;
    }
}

const apiService = new APIService();
export default apiService;
