import React, { useState, useRef, useEffect } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { useAuth } from "../features/auth/context/AuthContext";
import { useBlog } from "../app/providers/BlogProvider";
import {
  hasBlogAccess,
  isSuperAdmin,
} from "../features/auth/lib/accessControl";
import { Sidebar } from "./components/Sidebar";
import {
  Bell,
  HelpCircle,
  Sun,
  Moon,
  LogOut,
  User,
  Settings,
  Search,
  ChevronRight,
  CheckCircle2,
  Lock,
  Rocket,
} from "lucide-react";

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { memberships, activeRole, activeBlog, requiresOnboarding } = useBlog();
  const location = useLocation();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("darkMode");
    return saved !== null
      ? saved === "true"
      : window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

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

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("darkMode", "true");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("darkMode", "false");
    }
  };

  const roleLabel = isSuperAdmin(user)
    ? "Super admin"
    : activeRole
      ? activeRole.charAt(0).toUpperCase() + activeRole.slice(1).toLowerCase()
      : hasBlogAccess(memberships)
        ? "Workspace member"
        : user?.platform_role
          ? user.platform_role.charAt(0).toUpperCase() +
            user.platform_role.slice(1).toLowerCase()
          : "User";

  const getPageTitle = () => {
    if (location.pathname === "/admin/users") return "Team";
    if (location.pathname === "/admin/platform-users") return "Users";

    const pathSegments = location.pathname.split("/").filter(Boolean);
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
      return (
        settingType.charAt(0).toUpperCase() + settingType.slice(1) + " Settings"
      );
    }

    const mainSection = titleSegments[titleSegments.length - 1];
    return mainSection.charAt(0).toUpperCase() + mainSection.slice(1);
  };

  const pageTitle = getPageTitle();
  const accountMeta = isSuperAdmin(user)
    ? "Super admin"
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
  };
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const adminSegments = pathSegments.slice(1).filter((segment) => isNaN(Number(segment)));
  const rootLabel = "Dashboard";
  const sectionKey = adminSegments[0];
  const sectionLabel = sectionKey ? routeLabels[sectionKey] ?? pageTitle : rootLabel;
  const pageBreadcrumbs = [rootLabel];
  const isDashboardRoot =
    location.pathname === "/admin/dashboard" ||
    location.pathname === "/admin/superadmin";
  const showOnboardingLock =
    requiresOnboarding &&
    !isSuperAdmin(user) &&
    location.pathname !== "/admin/onboarding";
  const onboardingStepOrder = ["about", "profile", "publication", "team", "plan"];
  const onboardingStepsTotal = 5;
  const onboardingCompleted =
    activeBlog?.onboarding_status === "completed"
      ? 5
      : Math.max(0, onboardingStepOrder.indexOf(activeBlog?.onboarding_step ?? "about"));

  if (!isDashboardRoot && sectionLabel && sectionLabel !== rootLabel) {
    pageBreadcrumbs.push(sectionLabel);
  }

  if (!isDashboardRoot && pageTitle !== sectionLabel && pageTitle !== rootLabel) {
    pageBreadcrumbs.push(pageTitle);
  }

  return (
    <div className="min-h-screen bg-[var(--admin-bg)]">
      <Sidebar />

      <main
        className="min-h-screen lg:transition-[padding-left] lg:duration-300"
        style={{ paddingLeft: "var(--sidebar-width, 248px)" }}
      >
        <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/92 px-5 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/92">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="hidden h-9 min-w-[250px] items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-left text-sm text-zinc-500 transition hover:bg-white hover:text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-950 dark:hover:text-zinc-200 lg:flex"
              >
                <Search size={14} />
                <span className="flex-1 truncate">
                  Search posts, comments, settings...
                </span>
                <span className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950">
                  /
                </span>
              </button>
            </div>

            {user && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleDarkMode}
                  className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                <button className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                  <Bell size={18} />
                </button>

                <button className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                  <HelpCircle size={18} />
                </button>

                <div className="relative" ref={userDropdownRef}>
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-2 rounded-lg border border-transparent py-1.5 pl-1.5 pr-2 transition hover:border-violet-200 hover:bg-zinc-50 dark:hover:border-violet-800/50 dark:hover:bg-zinc-900"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-violet-500 bg-zinc-100 text-sm font-semibold text-zinc-700 ring-2 ring-violet-100/70 dark:border-violet-400 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-violet-500/20">
                      {user.username?.charAt(0).toUpperCase()}
                    </div>
                  </button>

                  {showUserDropdown && (
                    <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-zinc-200 bg-white py-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-700">
                        <div className="font-medium text-zinc-900 dark:text-white">
                          {user.username}
                        </div>
                        <div className="text-sm text-zinc-500 dark:text-zinc-400">
                          {user.email}
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                          {accountMeta}
                        </div>
                      </div>

                      <div className="py-1">
                        <Link
                          to="/admin/settings"
                          className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <User size={18} /> Profile
                        </Link>
                        <Link
                          to="/admin/settings/general"
                          className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <Settings size={18} /> Settings
                        </Link>
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
              </div>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-5 pb-6 pt-6">
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
                  to="/admin/onboarding"
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
                {pageBreadcrumbs.map((crumb, index) => (
                  <React.Fragment key={`${crumb}-${index}`}>
                    {index > 0 && (
                      <ChevronRight
                        size={14}
                        className="text-zinc-400 dark:text-zinc-500"
                      />
                    )}
                    <span
                      className={
                        index === pageBreadcrumbs.length - 1
                          ? "text-zinc-900 dark:text-white"
                          : ""
                      }
                    >
                      {crumb}
                    </span>
                  </React.Fragment>
                ))}
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
                    to="/admin/onboarding"
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
