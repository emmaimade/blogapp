import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

export const AdminLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Get page title from pathname
  const getPageTitle = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    
    // Remove numeric IDs from the path segments for title generation
    const titleSegments = pathSegments.filter(segment => isNaN(Number(segment)));
    
    if (titleSegments.length === 0) return 'Dashboard';
    
    // Get the main section (e.g., 'posts', 'users', 'tags')
    const mainSection = titleSegments[0];
    return mainSection.charAt(0).toUpperCase() + mainSection.slice(1);
  };

  const getBreadcrumb = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const titleSegments = pathSegments.filter(segment => isNaN(Number(segment)));
    
    if (titleSegments.length <= 1) return 'Admin Studio';
    
    // Show "Admin Studio / Section / Action" (e.g., "Admin Studio / Posts / Edit")
    return ['Admin Studio', ...titleSegments.map(s => s.charAt(0).toUpperCase() + s.slice(1))].join(' / ');
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 p-8">
        {/* Header */}
        <header className="mb-8 flex justify-between items-center">
          <div>
            <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {getBreadcrumb()}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">
              {getPageTitle()}
            </h1>
          </div>
          
          {/* User Info */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {user.username}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {user.role}
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium">
                {user.username.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
        </header>

        {/* Page Content */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};