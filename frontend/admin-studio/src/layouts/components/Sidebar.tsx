import { LayoutDashboard, Users, FileText, Tag, MessageSquare, Settings, X, BarChart3, Building2, CreditCard, Check, ChevronDown, ScrollText, PanelLeft, Sun, Moon, Menu, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../../features/auth/context/AuthContext';
import { useBlog } from '../../app/providers/BlogProvider';
import { isSuperAdmin } from '../../features/auth/lib/accessControl';
import { InkoLogo } from '../../assets/inko';

type SidebarMode = 'expanded' | 'collapsed' | 'hover';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  renderUserActions: () => React.ReactNode;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export const Sidebar = ({ isOpen, setIsOpen, renderUserActions, darkMode, toggleDarkMode }: SidebarProps) => {
  const { user } = useAuth();
  const { blogs, activeBlog, activeRole, setActiveBlogId } = useBlog();
  const location = useLocation();
  
  const userIsSuperAdmin = isSuperAdmin(user);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    const saved = localStorage.getItem('sidebarMode');
    return saved === 'collapsed' || saved === 'hover' || saved === 'expanded' ? saved : 'expanded';
  });
  const [isHovering, setIsHovering] = useState(false);
  const [showSidebarControl, setShowSidebarControl] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);

  const sidebarControlRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const isExpanded = sidebarMode === 'expanded' || (sidebarMode === 'hover' && isHovering);

  useEffect(() => {
    localStorage.setItem('sidebarMode', sidebarMode);
  }, [sidebarMode]);

  useEffect(() => {
    if (window.innerWidth >= 1024) {
      document.documentElement.style.setProperty('--sidebar-width', isExpanded ? '248px' : '56px');
    } else {
      document.documentElement.style.setProperty('--sidebar-width', '0px');
    }
  }, [isExpanded]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarControlRef.current && !sidebarControlRef.current.contains(event.target as Node)) {
        setShowSidebarControl(false);
      }
    };
    if (showSidebarControl) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSidebarControl]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        setShowWorkspaceMenu(false);
      }
    };
    if (showWorkspaceMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showWorkspaceMenu]);

  const isActive = (path: string) => {
    if (path.startsWith('/admin/settings')) {
      return location.pathname.startsWith('/admin/settings');
    }
    return location.pathname === path;
  };

  const setMode = (mode: SidebarMode) => {
    setSidebarMode(mode);
    setShowSidebarControl(false);
    setIsHovering(false);
  };

  const NavLink = ({
    to,
    icon: Icon,
    label,
  }: {
    to: string;
    icon: React.ComponentType<{ size: number; className?: string }>;
    label: string;
  }) => {
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
    const [visible, setVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const iconRef = useRef<HTMLDivElement>(null);

    const showTooltip = useCallback(() => {
      if (isExpanded) return;
      if (iconRef.current) {
        const rect = iconRef.current.getBoundingClientRect();
        setTooltipStyle({
          position: "fixed",
          top: rect.top + rect.height / 2,
          left: rect.right + 12,
          transform: "translateY(-50%)",
          zIndex: 9999,
        });
      }
      timerRef.current = setTimeout(() => setVisible(true), 150);
    }, [isExpanded]);

    const hideTooltip = useCallback(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setVisible(false);
    }, []);

    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      }, []);

    return (
      <div ref={iconRef} className="relative" onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
        <Link
          to={to}
          className={`group flex items-center gap-3 rounded-xl transition-all duration-200 font-medium
          ${isExpanded || window.innerWidth < 1024 ? "px-3 py-2.5 text-[13px]" : "px-2.5 py-2.5 justify-center"}
          ${
            isActive(to)
              ? "bg-violet-50 text-violet-700 shadow-sm ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/50"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
          }`}
        >
          <Icon size={18} className="flex-shrink-0" />
          {(isExpanded || window.innerWidth < 1024) && <span>{label}</span>}
        </Link>

        {!isExpanded && window.innerWidth >= 1024 && visible &&
          ReactDOM.createPortal(
            <div style={tooltipStyle} className="pointer-events-none z-[9999]">
              <div className="text-xs font-medium px-4 py-2 rounded-xl whitespace-nowrap shadow-lg border bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700">
                {label}
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  };

  const sectionHeaderClass = 'px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400';

  return (
    <>
      {/* Mobile Header Bar - Relocated Workspace Name Context Trigger */}
      {/* Note: AdminLayout handles the full top bar on mobile now to control the global workflow context */}

      {/* Mobile Drawer Overlay Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Primary Sidebar Container */}
      {/* FIXED: Removed pt-14 on mobile viewports so layout starts flush at the top */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-zinc-200 bg-white dark:bg-[#141414] dark:border-zinc-800/50 shadow-xl lg:shadow-none transition-all duration-300 lg:translate-x-0 pt-4 lg:pt-0 ${
          isOpen ? 'translate-x-0 w-[248px]' : '-translate-x-full'
        } lg:flex ${isExpanded ? 'lg:w-[248px]' : 'lg:w-14'}`}
        onMouseEnter={() => sidebarMode === 'hover' && setIsHovering(true)}
        onMouseLeave={() => sidebarMode === 'hover' && setIsHovering(false)}
      >
        
        {/* Desktop Brand Header */}
        <div className={`hidden lg:flex shrink-0 items-center px-3 pt-6 transition-all duration-300 ${isExpanded ? 'mb-6' : 'mb-4 justify-center'}`}>
          <Link 
            to={userIsSuperAdmin ? '/admin/superadmin' : '/admin/dashboard'}
            className={`flex items-center gap-3 ${!isExpanded && 'justify-center w-10'}`}
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center">
              <InkoLogo color="purple" size={25} />
            </div>
            {isExpanded && (
              <div>
                <div className="text-xl font-bold tracking-tight text-purple-600">Inko</div>
                <div className="-mt-0.5 text-[10px] font-mono tracking-[0.22em] text-zinc-500 dark:text-zinc-400">ADMIN STUDIO</div>
              </div>
            )}
          </Link>
        </div>

        {/* Workspace Dropper Selector Menu - DESKTOP ONLY */}
        {blogs.length > 0 && !userIsSuperAdmin && (
          <div ref={workspaceMenuRef} className="hidden lg:block relative mx-2 mb-4 transition-all duration-300">
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className={`flex w-full items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 transition-all hover:bg-white hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 ${isExpanded ? 'px-3 py-2.5' : 'h-10 w-10 justify-center p-0'}`}
              aria-label="Switch workspace"
            >
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-violet-600 text-[10px] font-bold text-white">
                {activeBlog?.name?.charAt(0).toUpperCase() ?? 'W'}
              </div>
              {isExpanded && (
                <>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[13px] font-semibold text-zinc-900 dark:text-white">{activeBlog?.name ?? 'Select workspace'}</div>
                    {activeRole && (
                      <div className="text-[10px] font-medium capitalize text-zinc-500 dark:text-zinc-400">{activeRole}</div>
                    )}
                  </div>
                  <ChevronDown size={14} className={`flex-shrink-0 text-zinc-400 transition-transform duration-200 ${showWorkspaceMenu ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>

            {showWorkspaceMenu && (
              <div className={`absolute z-50 mt-1.5 rounded-xl border border-zinc-200 bg-white py-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 ${isExpanded ? 'left-0 right-0' : 'left-full ml-2 w-52'}`}>
                <div className="border-b border-zinc-100 px-3.5 pb-2 pt-1.5 dark:border-zinc-800">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Workspaces</div>
                </div>
                <div className="py-1 max-h-60 overflow-y-auto scrollbar-thin">
                  {blogs.map((blog) => (
                    <button
                      key={blog.id}
                      onClick={() => { setActiveBlogId(blog.id); setShowWorkspaceMenu(false); }}
                      className="flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-violet-600 text-[10px] font-bold text-white">
                        {blog.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-zinc-900 dark:text-white">{blog.name}</div>
                      </div>
                      {activeBlog?.id === blog.id && <Check size={14} className="flex-shrink-0 text-violet-600" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scrollable Navigation Area Links list */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden pb-6 transition-all duration-300 scrollbar-thin scrollbar-track-transparent [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-300/60 dark:[&::-webkit-scrollbar-thumb]:bg-[#444444] [&::-webkit-scrollbar-thumb]:rounded-full ${isExpanded || window.innerWidth < 1024 ? 'space-y-2 px-2.5' : 'space-y-0 px-1.5'}`}>
          {userIsSuperAdmin ? (
            <>
              <div>
                {(isExpanded || window.innerWidth < 1024) && <div className={sectionHeaderClass}>Overview</div>}
                <div className="space-y-1">
                  <NavLink to="/admin/superadmin" icon={LayoutDashboard} label="Dashboard" />
                  <NavLink to="/admin/analytics" icon={BarChart3} label="Analytics" />
                </div>
              </div>
              <div className="pt-4">
                {(isExpanded || window.innerWidth < 1024) && <div className={sectionHeaderClass}>Management</div>}
                <div className="space-y-1">
                  <NavLink to="/admin/blogs" icon={Building2} label="Blogs" />
                  <NavLink to="/admin/platform-users" icon={Users} label="Users" />
                  <NavLink to="/admin/subscriptions" icon={CreditCard} label="Subscriptions" />
                </div>
              </div>
              <div className="pt-4">
                {(isExpanded || window.innerWidth < 1024) && <div className={sectionHeaderClass}>Configuration</div>}
                <div className="space-y-1">
                  <NavLink to="/admin/moderation" icon={MessageSquare} label="Moderation" />
                  <NavLink to="/admin/audit-log" icon={ScrollText} label="Audit Log" />
                  <NavLink to="/admin/platform-settings" icon={Settings} label="Settings" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                {(isExpanded || window.innerWidth < 1024) && <div className={sectionHeaderClass}>Overview</div>}
                <div className="space-y-1">
                  <NavLink to="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" />
                </div>
              </div>
              <div className="pt-4">
                {(isExpanded || window.innerWidth < 1024) && <div className={sectionHeaderClass}>Content</div>}
                <div className="space-y-1">
                  <NavLink to="/admin/posts" icon={FileText} label="Posts" />
                  <NavLink to="/admin/tags" icon={Tag} label="Tags" />
                  <NavLink to="/admin/comments" icon={MessageSquare} label="Comments" />
                </div>
              </div>
              {(activeRole === 'owner' || activeRole === 'editor') && (
                <div className="pt-4">
                  {(isExpanded || window.innerWidth < 1024) && <div className={sectionHeaderClass}>Management</div>}
                  <div className="space-y-1">
                    {activeRole === 'owner' && (
                      <NavLink to="/admin/users" icon={Users} label="Team" />
                    )}
                    <NavLink
                      to={activeRole === 'editor' ? '/admin/settings/activity' : '/admin/settings/general'}
                      icon={Settings}
                      label="Settings"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Mobile-Only Personal Profile Navigation Link */}
          <div className="block lg:hidden pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800/60">
            <NavLink 
              to={`/admin/users/${user?.id}`} 
              icon={User} 
              label="My Profile" 
            />
          </div>
        </nav>

        {/* Combined Footer Deck */}
        <div className="border-t border-zinc-200 dark:border-[#2e2e2e] bg-white dark:bg-[#141414] p-2 shrink-0">
          {/* Mobile Theme Toggle Switch Row */}
          <div className="block lg:hidden w-full px-1 py-1">
            <button
              onClick={toggleDarkMode}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60 transition-all"
            >
              <div className="flex items-center gap-3">
                {darkMode ? <Moon size={18} className="text-violet-400" /> : <Sun size={18} className="text-amber-500" />}
                <span>Dark Mode</span>
              </div>
              <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${darkMode ? 'bg-violet-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>
          </div>

          {/* Desktop Expansion Controller */}
          <div className="hidden lg:block">
            <div className="relative" ref={sidebarControlRef}>
              <button
                onClick={() => setShowSidebarControl(!showSidebarControl)}
                className="flex items-center justify-center rounded-md transition-all duration-150 p-1.5 bg-transparent text-zinc-500 hover:bg-zinc-100 dark:text-[#888888] dark:hover:bg-[#222222] dark:hover:text-[#ededed]"
                aria-label="Sidebar control menu"
              >
                <PanelLeft size={16} />
              </button>

              {showSidebarControl && (
                <div className="absolute bottom-full left-0 mb-2 z-50 w-56 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-[#2e2e2e] dark:bg-[#1c1c1c]">
                  <div className="px-3 py-1.5 text-xs text-zinc-400 dark:text-[#888888] font-medium">Sidebar control</div>
                  <div className="my-1 border-t border-zinc-100 dark:border-[#2e2e2e]" />
                  <div className="space-y-0.5">
                    <button onClick={() => setMode('expanded')} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-zinc-700 dark:text-[#ededed] transition-colors hover:bg-zinc-50 dark:hover:bg-[#222222]">
                      <span className="w-4 flex items-center justify-center">
                        {sidebarMode === 'expanded' && <span className="h-1.5 w-1.5 rounded-full bg-zinc-700 dark:bg-[#ededed]" />}
                      </span>
                      <span>Expanded</span>
                    </button>
                    <button onClick={() => setMode('collapsed')} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-zinc-700 dark:text-[#ededed] transition-colors hover:bg-zinc-50 dark:hover:bg-[#222222]">
                      <span className="w-4 flex items-center justify-center">
                        {sidebarMode === 'collapsed' && <span className="h-1.5 w-1.5 rounded-full bg-zinc-700 dark:bg-[#ededed]" />}
                      </span>
                      <span>Collapsed</span>
                    </button>
                    <button onClick={() => setMode('hover')} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-zinc-700 dark:text-[#ededed] transition-colors hover:bg-zinc-50 dark:hover:bg-[#222222]">
                      <span className="w-4 flex items-center justify-center">
                        {sidebarMode === 'hover' && <span className="h-1.5 w-1.5 rounded-full bg-zinc-700 dark:bg-[#ededed]" />}
                      </span>
                      <span>Expand on hover</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};