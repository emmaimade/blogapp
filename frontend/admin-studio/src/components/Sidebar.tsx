import { LayoutDashboard, User, FileText, Tag, MessageSquare, LogOut } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const linkClass = (path: string) => `
    flex items-center gap-3 p-2 rounded transition-colors
    ${isActive(path) 
      ? 'bg-indigo-600 text-white' 
      : 'hover:bg-gray-800 hover:text-indigo-400'
    }
  `;

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-6 flex flex-col">
      {/* Header */}
      <div className="mb-8">
        <div className="text-xl font-bold tracking-tight mb-2">Admin Studio</div>
        <div className="text-xs text-gray-400">v1.0</div>
      </div>

      {/* User Info */}
      {user && (
        <div className="mb-8 pb-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <p className="text-xs text-gray-400 capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="space-y-2 flex-1">
        <Link to="/admin/dashboard" className={linkClass('/admin/dashboard')}>
          <LayoutDashboard size={20}/>
          <span>Dashboard</span>
        </Link>
        <Link to="/admin/users" className={linkClass('/admin/users')}>
          <User size={20}/>
          <span>Users</span>
        </Link>
        <Link to="/admin/posts" className={linkClass('/admin/posts')}>
          <FileText size={20}/>
          <span>Posts</span>
        </Link>
        <Link to="/admin/tags" className={linkClass('/admin/tags')}>
          <Tag size={20}/>
          <span>Tags</span>
        </Link>
        <Link to="/admin/comments" className={linkClass('/admin/comments')}>
          <MessageSquare size={20}/>
          <span>Comments</span>
        </Link>
      </nav>

      {/* Logout Button */}
      <button 
        onClick={handleLogout}
        className="flex items-center gap-3 p-2 rounded text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors mt-auto"
      >
        <LogOut size={20}/>
        <span>Logout</span>
      </button>
    </aside>
  );
};