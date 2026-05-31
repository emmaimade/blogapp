import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const blogId = localStorage.getItem('public_blog_id');
  if (blogId && config.url) {
    const isMultitenantEndpoint = 
      config.url.startsWith('/posts') || 
      config.url.startsWith('/tags') || 
      config.url.startsWith('/settings') ||
      config.url.startsWith('/comments');
      
    if (isMultitenantEndpoint) {
      config.url = `/blogs/${blogId}${config.url}`;
    }
  }

  return config;
});

export default api;