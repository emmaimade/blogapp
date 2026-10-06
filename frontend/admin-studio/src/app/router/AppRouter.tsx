import { Navigate, Route, createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom';
import { ProtectedRoute } from '../../features/auth/components/ProtectedRoute';
import { useAuth } from '../../features/auth/context/AuthContext';
import { getPostLoginPath } from '../../features/auth/lib/accessControl';
import { LoginView } from '../../features/auth/pages/LoginPage';
import { SignupPage } from '../../features/auth/pages/SignupPage';
import { ForgotPasswordPage } from '../../features/auth/pages/ForgotPasswordPage';
import { AuthCallbackPage } from '../../features/auth/pages/AuthCallbackPage';
import { OnboardingPage } from '../../features/onboarding/pages/OnboardingPage';
import { CommentManager } from '../../features/comments/pages/CommentManagerPage';
import { Dashboard } from '../../features/dashboard/pages/Dashboard';
import { PostEditor } from '../../features/posts/pages/PostEditorPage';
import { PostList } from '../../features/posts/pages/PostListPage';
import { PostView } from '../../features/posts/pages/PostViewPage';
import { SettingsLayout } from '../../features/settings/components/SettingsLayout';
import { AboutPageSettings } from '../../features/settings/pages/AboutPageSettingsPage';
import { BrandingSettings } from '../../features/settings/pages/BrandingSettingsPage';
import { ContactSettings } from '../../features/settings/pages/ContactSettingsPage';
import { FooterSettings } from '../../features/settings/pages/FooterSettingsPage';
import { GeneralSettings } from '../../features/settings/pages/GeneralSettingsPage';
import { SEOSettings } from '../../features/settings/pages/SeoSettingsPage';
import { ActivityLogPage } from '../../features/audit-log/pages/ActivityLogPage';
import { TagManager } from '../../features/tags/pages/TagManagerPage';
import { UserManager } from '../../features/users/pages/UserManagerPage';
import { SuperAdminDashboardPage } from '../../features/superadmin/pages/SuperAdminDashboardPage';
import { AdminLayout } from '../../layouts/AdminLayout';
import { AuthLayout } from '../../layouts/AuthLayout';
import { SuperAdminAnalyticsPage } from '../../features/superadmin/pages/SuperAdminAnalyticsPage';
import { SuperAdminBlogsPage } from '../../features/superadmin/pages/SuperAdminBlogsPage';
import { SuperAdminUsersPage } from '../../features/superadmin/pages/SuperAdminUsersPage';
import { SuperAdminSubscriptionsPage } from '../../features/superadmin/pages/SuperAdminSubscriptionsPage';
import { SuperAdminModerationPage } from '../../features/superadmin/pages/SuperAdminModerationPage';
import { SuperAdminAuditLogPage } from '../../features/superadmin/pages/SuperAdminAuditLogPage';
import { SuperAdminPlatformSettingsPage } from '../../features/superadmin/pages/SuperAdminPlatformSettingsPage';
import UserInfoPage from '../../features/users/pages/UserInfoPage';
import { ResetPasswordPage } from '../../features/auth/pages/ResetPasswordPage';
import { ForcePasswordChangePage } from '../../features/auth/pages/ForcePasswordChangePage';
import { MyTicketsPage } from '../../features/support/pages/MyTicketsPage';
import { SuperAdminSupportPage } from '../../features/superadmin/pages/SuperAdminSupportPage';
import { SuperAdminBlogDetailPage } from '../../features/superadmin/pages/SuperAdminBlogDetailPage';
import { JoinInvitationPage } from '../../features/users/pages/JoinInvitationPage';
import { SearchResultsPage } from '../../features/search/pages/SearchResultsPage';

const DefaultAdminRedirect = () => {
  const { user } = useAuth();
  if (!user) return null;
  return <Navigate to={getPostLoginPath(user)} replace />;
};

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
    {/* ── Public routes ── */}
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<AuthLayout />}>
        <Route path="/admin/login" element={<LoginView />} />
        <Route
          path="/admin/forgot-password"
          element={<ForgotPasswordPage />}
        />
        <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/join/:token" element={<JoinInvitationPage />} />

      <Route element={<ProtectedRoute />}>
        <Route
          path="/admin/force-password-change"
          element={<ForcePasswordChangePage />}
        />
        <Route path="/admin/onboarding" element={<OnboardingPage />} />

        {/* ── All other admin routes — inside AdminLayout ── */}
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<DefaultAdminRedirect />} />

          <Route
            element={<ProtectedRoute requiredCapability="view_dashboard" />}
          >
            <Route path="/admin/dashboard" element={<Dashboard />} />
          </Route>

          <Route path="/admin/profile" element={<UserInfoPage />} />

          <Route path="/admin/search" element={<SearchResultsPage />} />

          {/* ======================== */}

          <Route
            element={
              <ProtectedRoute requiredCapability="view_platform_stats" />
            }
          >
            <Route
              path="/admin/superadmin"
              element={<SuperAdminDashboardPage />}
            />
            <Route
              path="/admin/analytics"
              element={<SuperAdminAnalyticsPage />}
            />
            <Route path="/admin/blogs" element={<SuperAdminBlogsPage />} />
            <Route path="/admin/blogs/:blogId" element={<SuperAdminBlogDetailPage />} />
            <Route
              path="/admin/platform-users"
              element={<SuperAdminUsersPage />}
            />
            <Route
              path="/admin/subscriptions"
              element={<SuperAdminSubscriptionsPage />}
            />
            <Route
              path="/admin/moderation"
              element={<SuperAdminModerationPage />}
            />
            <Route
              path="/admin/audit-log"
              element={<SuperAdminAuditLogPage />}
            />
            <Route
              path="/admin/platform-settings"
              element={<SuperAdminPlatformSettingsPage />}
            />
            <Route
              path="/admin/support"
              element={<SuperAdminSupportPage />}
            />
          </Route>

          <Route
            element={<ProtectedRoute requiredCapability="manage_users" />}
          >
            <Route path="/admin/users" element={<UserManager />} />
            <Route path="/admin/users/:id" element={<UserInfoPage />} />
          </Route>

          <Route
            element={<ProtectedRoute requiredCapability="manage_posts" />}
          >
            <Route path="/admin/posts" element={<PostList />} />
            <Route path="/admin/posts/new" element={<PostEditor />} />
            <Route path="/admin/posts/edit/:id" element={<PostEditor />} />
            <Route path="/admin/posts/view/:id" element={<PostView />} />
          </Route>

          <Route
            element={<ProtectedRoute requiredCapability="manage_tags" />}
          >
            <Route path="/admin/tags" element={<TagManager />} />
          </Route>

          <Route
            element={<ProtectedRoute requiredCapability="manage_comments" />}
          >
            <Route path="/admin/comments" element={<CommentManager />} />
          </Route>

          <Route
            element={<ProtectedRoute requiredCapability="view_audit_logs" />}
          >
            <Route path="/admin/activity" element={<ActivityLogPage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute requiredCapability="access_admin_studio" />
            }
          >
            <Route path="/admin/support-tickets" element={<MyTicketsPage />} />
            <Route path="/admin/settings" element={<SettingsLayout />}>
              <Route
                element={
                  <ProtectedRoute requiredCapability="manage_settings" />
                }
              >
                <Route path="general" element={<GeneralSettings />} />
                <Route path="about" element={<AboutPageSettings />} />
                <Route path="footer" element={<FooterSettings />} />
                <Route path="branding" element={<BrandingSettings />} />
                <Route path="seo" element={<SEOSettings />} />
                <Route path="contact" element={<ContactSettings />} />
              </Route>
              <Route index element={<Navigate to="general" replace />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </>
  )
);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};