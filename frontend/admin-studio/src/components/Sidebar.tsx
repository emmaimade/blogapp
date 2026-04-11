import { LayoutDashboard, Users, FileText, Tag, MessageSquare, Settings, LogOut, Moon, Sun, Menu, X } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useId } from 'react';

export const Sidebar = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'true') return true;
    if (saved === 'false') return false;

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return true;
    }
    return false;
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const isActive = (path: string) => location.pathname === path;
  
  // Check if any settings path is active
  const isSettingsActive = location.pathname.startsWith('/admin/settings');

  const linkClass = (path: string, isSettings = false) => `
    sidebar-nav-link flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200
    ${isActive(path) || (isSettings && isSettingsActive)
      ? 'active bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-900/70'
      : 'text-slate-600 dark:text-slate-300'
    }
  `;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 border-b border-[var(--admin-line)] bg-[color:var(--admin-panel)]/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between">
          <Link to="/admin/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 via-indigo-200 to-indigo-300 p-2 shadow-md">
              <InkoLogo size={30} />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">INKO</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Admin Studio</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {user && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-sm font-bold text-white shadow-md ring-2 ring-offset-1 ring-indigo-200 dark:ring-indigo-800 dark:ring-offset-slate-900 lg:hidden">
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsOpen((open) => !open)}
              className="admin-card flex h-11 w-11 items-center justify-center rounded-2xl text-slate-600 dark:text-slate-300"
              aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex h-screen w-[min(18rem,calc(100vw-1rem))] max-w-full flex-col overflow-hidden border-r border-[var(--admin-line)] bg-[color:var(--admin-panel-solid)] px-5 py-6 shadow-[var(--admin-shadow)] transition-transform duration-300 lg:w-72 lg:px-6',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        ].join(' ')}
      >
      {/* Logo */}
      <div className="mb-8 flex shrink-0 items-center gap-3">
        <InkoLogo size={32} className="drop-shadow-sm" />
        <div>
          <div className="text-3xl font-bold tracking-tighter text-slate-900 dark:text-white">INKO</div>
          <div className="text-xs font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400">Admin Studio</div>
        </div>
      </div>

      <nav className="admin-scrollbar flex-1 space-y-1 overflow-y-auto pr-1">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Core</div>
        
        <Link to="/admin/dashboard" className={linkClass('/admin/dashboard')}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </Link>
        <Link to="/admin/posts" className={linkClass('/admin/posts')}>
          <FileText size={20} />
          <span>Posts</span>
        </Link>
        <Link to="/admin/tags" className={linkClass('/admin/tags')}>
          <Tag size={20} />
          <span>Tags</span>
        </Link>
        <Link to="/admin/comments" className={linkClass('/admin/comments')}>
          <MessageSquare size={20} />
          <span>Comments</span>
        </Link>

        <div className="mt-8 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Management</div>
        <Link to="/admin/users" className={linkClass('/admin/users')}>
          <Users size={20} />
          <span>Users</span>
        </Link>

        <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
          <Link to="/admin/settings/general" className={linkClass('/admin/settings/general', true)}>
            <Settings size={20} />
            <span>Site Settings</span>
          </Link>
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="mt-6 shrink-0 border-t border-slate-100 pt-5 dark:border-slate-800">
        <div className="space-y-3">
        <button
          type="button"
          onClick={() => setDarkMode((mode) => !mode)}
          aria-pressed={darkMode}
          className="sidebar-toggle-btn inline-flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span className="inline-flex items-center gap-2">
            {darkMode ? <Sun className="text-yellow-400" size={20} /> : <Moon className="text-indigo-500" size={20} />}
            <span>{darkMode ? 'Dark mode enabled' : 'Light mode enabled'}</span>
          </span>
          <span className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-slate-300 transition-colors duration-200 ease-out dark:bg-slate-600">
            <span
              className={`absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${darkMode ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </span>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="sidebar-logout-btn flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-medium text-red-600 transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
        </div>
      </div>
      </aside>
    </>
  );
};

// Keep your InkoLogo component here
const InkoLogo: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => {
  const gradientId = useId();

  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-2 shadow-lg shadow-indigo-500/30 ${className || ''}`}>
      <svg
        role="img"
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#FFFFFF" opacity="0.8" />
          </linearGradient>
        </defs>

        <path
          d="M12 2C12 2 8 6 8 10C8 13.314 9.79 16 12 16C14.21 16 16 13.314 16 10C16 6 12 2 12 2Z"
          fill={`url(#${gradientId})`}
        />
        <circle
          cx="12"
          cy="19"
          r="2"
          fill={`url(#${gradientId})`}
          opacity="0.7"
        />
      </svg>
    </div>
  );
};
