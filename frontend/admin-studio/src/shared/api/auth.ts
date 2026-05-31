import api from './client';

const isNotFound = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'response' in error &&
  (error as { response?: { status?: number } }).response?.status === 404;

export const loginRequest = async (payload: URLSearchParams) => {
  try {
    return await api.post('/auth/login', payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }

    return api.post('/users/login', payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }
};

export const getCurrentUserRequest = async () => {
  try {
    return await api.get('/auth/me');
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }

    return api.get('/users/me');
  }
};
