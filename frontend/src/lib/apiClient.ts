/// <reference types="vite/client" />
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { mockRouter } from './mock';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  if (DEMO_MODE) {
    config.adapter = async (cfg) => {
      const data = await mockRouter(cfg);
      return {
        data,
        status: 200,
        statusText: 'OK',
        headers: cfg.headers,
        config: cfg,
      };
    };
  }

  const { token, tenantId } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (tenantId) config.headers['X-Tenant-ID'] = tenantId;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const { refreshToken, setTokens, logout } = useAuthStore.getState();
      if (refreshToken) {
        try {
          const response = await axios.post('/api/v1/auth/refresh', { refreshToken });
          const { accessToken } = response.data;
          setTokens(accessToken, refreshToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        } catch {
          logout();
        }
      } else {
        logout();
      }
    }
    return Promise.reject(error);
  }
);

