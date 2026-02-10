import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if no user is found
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Debug: Log user data to console
  console.log('ProtectedRoute - User data:', user);
  console.log('ProtectedRoute - User role:', user.role);
  console.log('ProtectedRoute - Role type:', typeof user.role);

  // Check for Admin Role (case-insensitive)
  const isAdmin = user.role?.toLowerCase() === 'admin';
  
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">You need admin privileges to access this area.</p>
          
          {/* Debug Info */}
          <div className="bg-gray-100 p-4 rounded text-left mb-4 text-xs">
            <p className="font-mono"><strong>Debug Info:</strong></p>
            <p className="font-mono">Username: {user.username}</p>
            <p className="font-mono">Email: {user.email}</p>
            <p className="font-mono">Role: "{user.role}"</p>
            <p className="font-mono">Role Type: {typeof user.role}</p>
            <p className="font-mono">Is Admin: {isAdmin ? 'true' : 'false'}</p>
          </div>
          
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }}
            className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 mr-2"
          >
            Logout & Re-login
          </button>
          <button 
            onClick={() => window.location.href = '/'}
            className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
};