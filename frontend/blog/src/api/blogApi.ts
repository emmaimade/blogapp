import axios from 'axios';
import { getCsrfToken } from './csrf';

// In production this points at this app's own /api/* path, which Vercel
// rewrites server-side to the real backend (see vercel.json) — that's what
// makes the backend's auth cookies ordinary same-origin, first-party cookies
// instead of needing SameSite=None (which third-party-cookie blocking would
// then eat). Local dev talks to the backend directly; localhost on any port
// is already same-site for cookie purposes, so no proxy is needed there.
const api = axios.create({
  baseURL: import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || 'http://localhost:8000'),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const STATE_CHANGING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

api.interceptors.request.use((config) => {
  if (config.method && STATE_CHANGING_METHODS.has(config.method.toLowerCase())) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const blogId = localStorage.getItem('public_blog_id');
  if (blogId && config.url) {
    const isMultitenantEndpoint =
      config.url.startsWith('/posts') ||
      config.url.startsWith('/tags') ||
      config.url.startsWith('/settings');

    if (isMultitenantEndpoint) {
      config.url = `/blogs/${blogId}${config.url}`;
    }
  }

  return config;
});

let refreshInFlight: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true })
      .then(() => undefined)
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
        await refreshAccessToken();
        return api(originalRequest);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
