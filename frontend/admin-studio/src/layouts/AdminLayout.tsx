import {
    CheckCircle2,
    ChevronRight,
    HelpCircle,
    Lock,
    LogOut,
    Menu,
    Moon,
    Rocket,
    Search,
    Settings,
    Sun,
    User,
    X,
    PauseCircle,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useBlog } from "../app/providers/BlogProvider";
import { useWorkspacePath } from "../app/providers/useWorkspacePath";
import { getStoredDarkMode, storeDarkMode } from "../shared/lib/theme";
import { useAuth } from "../features/auth/context/AuthContext";
import {
    isSuperAdmin
} from "../features/auth/lib/accessControl";
import { Sidebar } from "./components/Sidebar";
import { SupportModal } from "../features/support/components/SupportModal";
import { NotificationBell } from "../features/notifications/components/NotificationBell";
import { QuickJumpPalette } from "../features/superadmin/components/QuickJumpPalette";
import { WorkspaceSwitcher } from "../features/workspaces/components/WorkspaceSwitcher";
import { NEW_WORKSPACE_PATH } from "../shared/lib/workspacePaths";

interface UserMenuProps {
  user: ReturnType<typeof useAuth>["user"];
  logout: ReturnType<typeof useAuth>["logout"];
  darkMode: boolean;
  toggleDarkMode: () => void;
  accountMeta: string;
  showSettingsLink: boolean;
}

// Self-contained user avatar + dropdown menu. Deliberately its own component
// (not a helper function reusing outer state) because it's rendered from
// several places that can be mounted simultaneously (mobile topbar, desktop
// header, sidebar). Each mount needs its own open/close state and its own
// ref - sharing a single ref across multiple mounted copies meant the
// mousedown outside-click listener could check the wrong DOM node and close
// the dropdown before a tap's click event ever reached the Profile/Settings/
// Logout targets. The support modal toggle follows the same rule for the
// same reason - each mounted UserMenu owns its own showSupportModal state.
const UserMenu: React.FC<UserMenuProps> = ({
  user,
  logout,
  darkMode,
  toggleDarkMode,
  accountMeta,
  showSettingsLink,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const toWorkspace = useWorkspacePath();
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showUserDropdown]);

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={toggleDarkMode}
        className="hidden lg:flex rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        aria-label="Toggle theme mode"
      >
        {darkMode ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <NotificationBell />

      <button
        onClick={() => setShowSupportModal(true)}
        className="hidden lg:block rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        aria-label="Contact support"
      >
        <HelpCircle size={18} />
      </button>

      <div className="relative" ref={userDropdownRef}>
        <button
          onClick={() => setShowUserDropdown(!showUserDropdown)}
          className="flex items-center gap-2 rounded-lg border border-transparent py-1.5 pl-1.5 pr-2 transition hover:border-violet-200 hover:bg-zinc-50 dark:hover:border-violet-800/50 dark:hover:bg-zinc-900"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-base font-semibold text-white shadow-md ring-2 ring-white/80 dark:ring-zinc-900">
            {user?.first_name?.charAt(0).toUpperCase()}
            {user?.last_name?.charAt(0).toUpperCase()}
          </div>
        </button>

        {showUserDropdown && (
          <div className="fixed right-4 top-16 lg:absolute lg:right-0 lg:top-auto lg:mt-2 z-50 w-60 rounded-xl border border-zinc-200 bg-white py-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 pointer-events-auto">
            <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-700">
              <div className="font-medium text-zinc-900 dark:text-white">
                {user?.first_name} {user?.last_name}
              </div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {user?.email}
              </div>
              <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                {accountMeta}
              </div>
            </div>

            <div className="py-1">
              <Link
                to="/admin/profile"
                className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                onClick={() => setShowUserDropdown(false)}
              >
                <User size={18} /> Profile
              </Link>
              {showSettingsLink && (
                <Link
                  to={toWorkspace("/settings/general")}
                  className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  onClick={() => setShowUserDropdown(false)}
                >
                  <Settings size={18} /> Settings
                </Link>
              )}
            </div>

            <div className="mt-1 border-t border-zinc-100 pt-1 dark:border-zinc-700">
              <button
                onClick={() => {
                  logout();
                  setShowUserDropdown(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <LogOut size={18} /> Logout
              </button>
            </div>
          </div>
        )}
      </div>

      <SupportModal open={showSupportModal} onClose={() => setShowSupportModal(false)} />
    </div>
  );
};

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { activeBlog, activeRole, requiresOnboarding, routeSlug } = useBlog();
  const toWorkspace = useWorkspacePath();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showQuickJump, setShowQuickJump] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const userIsSuperAdmin = isSuperAdmin(user);

  // Sync state with HTML class list for theme customization
  const [darkMode, setDarkMode] = useState<boolean>(getStoredDarkMode);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    storeDarkMode(newMode);
  };

useEffect(() => {
  if (user?.must_change_password && location.pathname !== "/admin/force-password-change") {
    navigate("/admin/force-password-change", { replace: true });
    return;
  }
  // Onboarding lives outside this layout, so being here means it isn't open.
  // An unfinished workspace doesn't stop the user creating another one.
  const onNewWorkspace = location.pathname === NEW_WORKSPACE_PATH;
  const needsGate =
    ((requiresOnboarding && !onNewWorkspace) || !user?.email_verified) && !userIsSuperAdmin && !!activeBlog;
  if (needsGate) {
    navigate(toWorkspace("/onboarding"), { replace: true });
  }
}, [requiresOnboarding, user, activeBlog, location.pathname, navigate, userIsSuperAdmin, toWorkspace]);

  // Close menus on page navigation changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Global "/" shortcut — jumps into the topbar search for blog admins, or
  // opens the quick-jump palette for superadmins (who have no search input
  // to focus). Ignored while the user is already typing elsewhere.
  useEffect(() => {
    const handleSlashShortcut = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      const isTypingElsewhere =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isTypingElsewhere) return;
      event.preventDefault();
      if (userIsSuperAdmin) {
        setShowQuickJump(true);
      } else {
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleSlashShortcut);
    return () => document.removeEventListener("keydown", handleSlashShortcut);
  }, [userIsSuperAdmin]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    navigate(`/admin/search?q=${encodeURIComponent(trimmed)}`);
    setShowMobileSearch(false);
  };

  // Autofocus the mobile search input the moment it expands into view.
  useEffect(() => {
    if (showMobileSearch) {
      mobileSearchInputRef.current?.focus();
    }
  }, [showMobileSearch]);

  const roleLabel = userIsSuperAdmin
    ? "Super admin"
    : activeRole
      ? activeRole.charAt(0).toUpperCase() + activeRole.slice(1).toLowerCase()
      : user?.platform_role
        ? user.platform_role.charAt(0).toUpperCase() + user.platform_role.slice(1).toLowerCase()
        : "User";

  // Titles and breadcrumbs read the path as if the workspace weren't in it:
  // /admin/w/acme/posts/new → /admin/posts/new.
  const sectionPath = routeSlug
    ? location.pathname.replace(`/admin/w/${routeSlug}`, "/admin")
    : location.pathname;
  const sectionHref = (path: string) =>
    routeSlug ? toWorkspace(path.replace(/^\/admin/, "")) : path;

  const getPageTitle = () => {
    if (sectionPath === "/admin/users") return "Team";
    if (sectionPath === "/admin/platform-users") return "Users";
    if (sectionPath === "/admin/platform-settings") return "Platform Settings";
    if (sectionPath === NEW_WORKSPACE_PATH) return "New workspace";

    const pathSegments = sectionPath.split("/").filter(Boolean);
    const titleSegments = pathSegments.filter((segment) =>
      isNaN(Number(segment)),
    );
    if (titleSegments.length === 0) return "Dashboard";

    if (
      titleSegments[0] === "admin" &&
      titleSegments[1] === "settings" &&
      titleSegments[2]
    ) {
      const settingType = titleSegments[2];
      // The branding page covers layout too, so it's shown as "Appearance"
      // (its URL stays /settings/branding so existing links keep working).
      const settingLabels: Record<string, string> = { branding: "Appearance" };
      const settingLabel =
        settingLabels[settingType] ??
        settingType.charAt(0).toUpperCase() + settingType.slice(1);
      return settingLabel + " Settings";
    }

    const mainSection = titleSegments[titleSegments.length - 1];
    return mainSection.charAt(0).toUpperCase() + mainSection.slice(1);
  };

  const pageTitle = getPageTitle();
  const accountMeta = userIsSuperAdmin
    ? "Super Admin"
    : activeBlog?.name
      ? `${roleLabel} - ${activeBlog.name}`
      : roleLabel;

  const routeLabels: Record<string, string> = {
    dashboard: "Dashboard",
    analytics: "Analytics",
    blogs: "Blogs",
    users: "Users",
    "platform-users": "Users",
    subscriptions: "Subscriptions",
    moderation: "Moderation",
    "platform-settings": "Platform Settings",
    superadmin: "Super Admin",
    posts: "Posts",
    tags: "Tags",
    comments: "Comments",
    settings: "Settings",
    onboarding: "Onboarding",
    profile: "Profile",
  };

  const pathSegments = sectionPath.split("/").filter(Boolean);
  const adminSegments = pathSegments.slice(1).filter((segment) => isNaN(Number(segment)));
  const rootLabel = "Dashboard";
  const sectionKey = adminSegments[0];
  const sectionLabel = sectionKey ? routeLabels[sectionKey] ?? pageTitle : rootLabel;
  const pageBreadcrumbs: { label: string; href: string }[] = [
    { label: rootLabel, href: userIsSuperAdmin ? "/admin/superadmin" : toWorkspace() },
  ];
  const isDashboardRoot =
    sectionPath === "/admin/dashboard" ||
    sectionPath === "/admin/superadmin";
  // Suspended by a superadmin: readable, but the backend refuses changes.
  const isSuspended = !!routeSlug && !!activeBlog && activeBlog.is_active === false;
  const showOnboardingLock =
    ((requiresOnboarding && location.pathname !== NEW_WORKSPACE_PATH) || !user?.email_verified) &&
    !userIsSuperAdmin;
  const onboardingStepOrder = ["about", "profile", "publication", "team", "plan"];
  const onboardingStepsTotal = 5;
  const onboardingCompleted =
    activeBlog?.onboarding_status === "completed"
      ? 5
      : Math.max(0, onboardingStepOrder.indexOf(activeBlog?.onboarding_step ?? "about"));

  if (!isDashboardRoot && sectionLabel && sectionLabel !== rootLabel) {
    pageBreadcrumbs.push({ label: sectionLabel, href: sectionHref(`/admin/${sectionKey}`) });
  }

  if (!isDashboardRoot && pageTitle !== sectionLabel && pageTitle !== rootLabel) {
    pageBreadcrumbs.push({ label: pageTitle, href: location.pathname });
  }

  // Shared User Action Stack UI markup block.
  // NOTE: this is called from multiple places (mobile topbar, desktop header,
  // and passed down to Sidebar) which can be mounted at the same time. UserMenu
  // owns its own open/close state and ref internally so each call site is a fully
  // independent instance - no shared ref/state collisions between mounted copies.
  const renderUserActions = () => (
    <UserMenu
      user={user}
      logout={logout}
      darkMode={darkMode}
      toggleDarkMode={toggleDarkMode}
      accountMeta={accountMeta}
      showSettingsLink={userIsSuperAdmin || activeRole === "owner"}
    />
  );

  return (
    <div className="min-h-screen bg-[var(--admin-bg)]">
      
      {/* NEW: Integrated Mobile Topbar Sticky Navigation Header */}
      {/* Changes implemented: Explicitly added pointer-events-auto to ensure the sticky header handles clicks cleanly above overlays */}
      <div className="fixed inset-x-0 top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur-lg dark:bg-zinc-950/95 dark:border-zinc-800 px-4 h-14 flex items-center justify-between lg:hidden pointer-events-auto">
        {showMobileSearch ? (
          <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2">
            <Search size={16} className="flex-shrink-0 text-zinc-400" />
            <input
              ref={mobileSearchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts, comments, tags..."
              aria-label="Search posts, comments and tags"
              className="flex-1 min-w-0 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 outline-none dark:text-white"
            />
            <button
              type="button"
              onClick={() => {
                setShowMobileSearch(false);
                setSearchQuery("");
              }}
              aria-label="Close search"
              className="flex-shrink-0 rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <X size={20} />
            </button>
          </form>
        ) : (
          <>
        <div className="flex items-center min-w-0 gap-1.5">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="-ml-1.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-300"
            aria-label="Toggle navigation drawer"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Workspace contextual switcher display block */}
          {activeBlog?.name && !userIsSuperAdmin ? (
            <WorkspaceSwitcher variant="header" className="flex min-w-0 items-center" />
          ) : (
            <div className="text-[15px] font-bold tracking-tight text-zinc-900 dark:text-white ml-1">Inko</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => (userIsSuperAdmin ? setShowQuickJump(true) : setShowMobileSearch(true))}
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-300"
            aria-label="Search"
          >
            <Search size={20} />
          </button>
          {user && renderUserActions()}
        </div>
          </>
        )}
      </div>

      <Sidebar
        isOpen={isMobileMenuOpen} 
        setIsOpen={setIsMobileMenuOpen} 
        renderUserActions={renderUserActions}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />

      <main className="min-h-screen pt-14 lg:pt-0 lg:pl-[var(--sidebar-width,248px)] transition-[padding] duration-300">
        {/* Desktop Top Header Layout view */}
        <header className="hidden lg:block sticky top-0 z-40 border-b border-zinc-200/80 bg-white/92 px-5 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/92">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {!userIsSuperAdmin && (
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex h-9 min-w-[250px] items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-left text-sm text-zinc-500 transition focus-within:border-violet-300 focus-within:bg-white hover:bg-white hover:text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:focus-within:border-violet-800 dark:hover:bg-zinc-950 dark:hover:text-zinc-200"
                >
                  <Search size={14} className="flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search posts, comments, tags..."
                    aria-label="Search posts, comments and tags"
                    className="flex-1 min-w-0 truncate bg-transparent text-sm text-zinc-700 placeholder:text-zinc-500 outline-none dark:text-zinc-200 dark:placeholder:text-zinc-400"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        searchInputRef.current?.focus();
                      }}
                      aria-label="Clear search"
                      className="flex-shrink-0 rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      <X size={12} />
                    </button>
                  ) : (
                    <span className="flex-shrink-0 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950">
                      /
                    </span>
                  )}
                </form>
              )}
              {userIsSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setShowQuickJump(true)}
                  className="flex h-9 min-w-[250px] items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-left text-sm text-zinc-500 transition hover:bg-white hover:text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-950 dark:hover:text-zinc-200"
                >
                  <Search size={14} className="flex-shrink-0" />
                  <span className="flex-1 truncate">Jump to a platform section...</span>
                  <span className="flex-shrink-0 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950">
                    /
                  </span>
                </button>
              )}
            </div>
            {user && renderUserActions()}
          </div>
        </header>

        {showQuickJump && <QuickJumpPalette onClose={() => setShowQuickJump(false)} />}

        <div className="mx-auto max-w-6xl px-5 pb-6 pt-6">
          {isSuspended && (
            <div
              role="status"
              className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
                  <PauseCircle size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold">This workspace is suspended</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200/80">
                    Inko support has suspended {activeBlog?.name}. You can view it, but changes are turned off
                    and the public blog is offline. Contact support to restore it.
                  </p>
                </div>
              </div>
              <Link
                to="/admin/support-tickets"
                className="inline-flex flex-shrink-0 items-center justify-center rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-950 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
              >
                Contact support
              </Link>
            </div>
          )}
          {showOnboardingLock && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
                    <Rocket size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">
                      Complete workspace setup to unlock actions
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200/80">
                      Your admin pages are available for review, but publishing,
                      team changes, and advanced settings stay locked until
                      onboarding is complete.
                    </p>
                  </div>
                </div>
                <Link
                  to={toWorkspace("/onboarding")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-950 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
                >
                  <CheckCircle2 size={16} />
                  Continue setup
                </Link>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-200/80 dark:bg-amber-900">
                <div
                  className="h-full rounded-full bg-amber-600 dark:bg-amber-300"
                  style={{
                    width: `${(onboardingCompleted / onboardingStepsTotal) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {!isDashboardRoot && (
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {pageBreadcrumbs.map((crumb, index) => {
                  const isCurrent = index === pageBreadcrumbs.length - 1;
                  return (
                    <React.Fragment key={`${crumb.label}-${index}`}>
                      {index > 0 && (
                        <ChevronRight
                          size={14}
                          className="text-zinc-400 dark:text-zinc-500"
                        />
                      )}
                      {isCurrent ? (
                        <span className="text-zinc-900 dark:text-white">
                          {crumb.label}
                        </span>
                      ) : (
                        <Link
                          to={crumb.href}
                          className="hover:text-zinc-900 dark:hover:text-white hover:underline"
                        >
                          {crumb.label}
                        </Link>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
          <div className="relative">
            <div
              className={
                showOnboardingLock
                  ? "pointer-events-none select-none blur-[1.5px]"
                  : ""
              }
            >
              <Outlet />
            </div>
            {showOnboardingLock && (
              <div className="absolute inset-0 z-30 flex min-h-[320px] items-start justify-center rounded-2xl bg-white/55 pt-16 backdrop-blur-[1px] dark:bg-zinc-950/55">
                <div className="mx-4 max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
                    <Lock size={18} />
                  </div>
                  <h2 className="mt-4 text-lg font-bold text-zinc-950 dark:text-white">
                    Workspace setup is still in progress
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                    Finish onboarding once, then this page becomes fully
                    interactive.
                  </p>
                  <Link
                    to={toWorkspace("/onboarding")}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
                  >
                    <Rocket size={16} />
                    Continue onboarding
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};