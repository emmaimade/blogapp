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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authSession.clearToken();
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default api;
