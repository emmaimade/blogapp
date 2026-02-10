import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { useNavigate } from 'react-router-dom';

export const LoginView = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      // Step 1: Login and get token
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const loginResponse = await api.post('/users/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      // Extract access token from response
      const { access_token } = loginResponse.data;
      
      // Step 2: Store token
      localStorage.setItem('token', access_token);
      
      // Step 3: Get user data using /users/me endpoint
      const userResponse = await api.get('/users/me');
      const userData = userResponse.data;
      
      // Step 4: Update auth context
      login(access_token, userData);
      
      // Step 5: Navigate to dashboard
      navigate('/admin/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      
      if (err.response?.status === 401) {
        setError('Invalid username or password');
      } else if (err.response?.status === 422) {
        setError('Please enter both username and password');
      } else if (!err.response) {
        setError('Cannot connect to server. Make sure backend is running on port 8000.');
      } else {
        setError(err.response?.data?.detail || 'Login failed. Please try again.');
      }
      
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleLogin} className="p-8 bg-white shadow-lg rounded-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Admin Studio Login</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {error}
          </div>
        )}
        
        <input 
          type="text" 
          placeholder="Username" 
          className="w-full mb-4 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isLoading}
          required
        />
        <input 
          type="password" 
          placeholder="Password" 
          className="w-full mb-6 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          required
        />
        <button 
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};