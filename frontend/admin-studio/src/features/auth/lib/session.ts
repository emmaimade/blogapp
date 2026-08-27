const TOKEN_STORAGE_KEY = 'token';
const REFRESH_TOKEN_STORAGE_KEY = 'refresh_token';

export const authSession = {
  getToken: () => localStorage.getItem(TOKEN_STORAGE_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_STORAGE_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_STORAGE_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY),
  setRefreshToken: (token: string) => localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token),
  clearRefreshToken: () => localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY),
};
