import { useEffect } from 'react';

const DARK_MODE_KEY = 'darkMode';

/** The admin theme the user picked, else the OS preference. */
export const getStoredDarkMode = (): boolean => {
  try {
    const saved = localStorage.getItem(DARK_MODE_KEY);
    if (saved !== null) return saved === 'true';
  } catch {
    // Storage unavailable — fall through to the OS preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};

export const storeDarkMode = (dark: boolean) => {
  try {
    localStorage.setItem(DARK_MODE_KEY, String(dark));
  } catch {
    // Not persisted; the toggle still applies for this page load.
  }
};

/**
 * Applies the stored admin theme. AdminLayout owns the toggle; full-screen
 * admin states rendered outside it (not found, access denied) call this so
 * a fresh load on them doesn't flash to light.
 */
export const useStoredTheme = () => {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', getStoredDarkMode());
  }, []);
};
