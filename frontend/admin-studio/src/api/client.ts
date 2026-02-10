import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')  // Changed from 'admin_token' to 'token'
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')  // Changed from 'admin_token' to 'token'
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api