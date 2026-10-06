import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const getInitialTheme = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
};

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    // Track the OS preference only while the visitor hasn't made an explicit
    // choice — once they have, localStorage is the source of truth and this
    // listener should leave it alone.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem('theme')) return;
      const next = e.matches ? 'dark' : 'light';
      applyTheme(next);
      setTheme(next);
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
};
