import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AdminLayout } from './layouts/AdminLayout';
import { LoginView } from './views/LoginView';
import { Dashboard } from './views/Dashboard';
import { UserManager } from './views/UserManager';
import { PostList } from './views/PostList';
import { PostEditor } from './views/PostEditor';
import { PostView } from './views/PostView';
import { TagManager } from './views/TagManager';
import { CommentManager } from './views/CommentManager';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/admin/login" element={<LoginView />} />

          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              {/* Redirect /admin to dashboard */}
              <Route
                path="/admin"
                element={<Navigate to="/admin/dashboard" replace />}
              />

              <Route path="/admin/dashboard" element={<Dashboard />} />
              <Route path="/admin/users" element={<UserManager />} />
              <Route path="/admin/posts" element={<PostList />} />
              <Route path="/admin/posts/new" element={<PostEditor />} />
              <Route path="/admin/posts/edit/:id" element={<PostEditor />} />
              <Route path="/admin/posts/view/:id" element={<PostView />} />
              <Route path="/admin/tags" element={<TagManager />} />
              <Route path="/admin/comments" element={<CommentManager />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/admin/login" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;