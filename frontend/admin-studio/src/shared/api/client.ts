import axios from 'axios';
import { authSession } from '../../features/auth/lib/session';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

import { blogSession } from '../lib/blogSession';

api.interceptors.request.use((config) => {
  const token = authSession.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const blogId = blogSession.getBlogId();
  if (blogId && config.url) {
    const isMultitenantEndpoint = 
      config.url.startsWith('/dashboard') ||
      config.url.startsWith('/posts') || 
      config.url.startsWith('/comments') || 
      config.url.startsWith('/tags') || 
      config.url.startsWith('/settings') ||
      config.url.startsWith('/members');
      
    if (isMultitenantEndpoint) {
      config.url = `/blogs/${blogId}${config.url}`;
    }
  }

  return config;
});

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = authSession.getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token available');

  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${api.defaults.baseURL}/auth/refresh`, { refresh_token: refreshToken })
      .then((res) => {
        authSession.setToken(res.data.access_token);
        authSession.setRefreshToken(res.data.refresh_token);
        return res.data.access_token as string;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isRefreshCall = originalRequest?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !isRefreshCall && !originalRequest?._retry) {
      originalRequest._retry = true;
      try {
        const newAccessToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch {
        authSession.clearToken();
        authSession.clearRefreshToken();
        window.location.href = '/admin/login';
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 401) {
      authSession.clearToken();
      authSession.clearRefreshToken();
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default api;
