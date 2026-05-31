import { LayoutDashboard, Users, FileText, Tag, MessageSquare, Settings, Menu, X, BarChart3, Building2, CreditCard, MoreVertical, Check, ChevronDown, ScrollText } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../features/auth/context/AuthContext';
import { useBlog } from '../../app/providers/BlogProvider';
import { isSuperAdmin } from '../../features/auth/lib/accessControl';
import { InkoLogo } from '../../assets/inko';

type SidebarMode = 'expanded' | 'collapsed' | 'hover';

export const Sidebar = () => {
  const { user } = useAuth();
  const { blogs, activeBlog, activeRole, setActiveBlogId } = useBlog();
  const location = useLocation();
  
  const userIsSuperAdmin = isSuperAdmin(user);
  const [isOpen, setIsOpen] = useState(false);
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

  useEffect(() => setIsOpen(false), [location.pathname]);

  useEffect(() => {
    localStorage.setItem('sidebarMode', sidebarMode);
  }, [sidebarMode]);

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', isExpanded ? '248px' : '56px');
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

  const isActive = (path: string) => location.pathname === path;

  const linkClass = (path: string) => `
    group relative flex items-center gap-3 rounded-xl transition-all duration-200 font-medium
    ${isExpanded ? 'px-3 py-2.5 text-[13px]' : 'px-2.5 py-2.5 justify-center'}
    ${isActive(path)
      ? 'bg-violet-50 text-violet-700 shadow-sm ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/50'
      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60'
    }
  `;

  const sectionHeaderClass = 'px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400';

  const setMode = (mode: SidebarMode) => {
    setSidebarMode(mode);
    setShowSidebarControl(false);
    setIsHovering(false);
  };

  const NavLink = ({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ size: number; className?: string }>; label: string }) => (
    <div className="relative group/item">
      <Link to={to} className={linkClass(to)}>
        <Icon size={18} className="flex-shrink-0" />
        {isExpanded && <span>{label}</span>}
      </Link>
      {!isExpanded && (
        <div className="absolute left-full ml-2 px-3 py-1.5 bg-zinc-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover/item:opacity-100 pointer-events-none transition-opacity duration-200 dark:bg-zinc-700 z-50">
          {label}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="fixed inset-x-0 top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-lg dark:bg-zinc-950/95 px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between">
          <Link to={userIsSuperAdmin ? '/admin/superadmin' : '/admin/dashboard'} className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center">
              <InkoLogo size={18} />
            </div>
            <div className="text-sm font-bold tracking-tight">INKO</div>
          </Link>

          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex-col border-r border-zinc-200 bg-white dark:bg-zinc-950 shadow-xl transition-all duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:flex ${isExpanded ? 'w-[248px]' : 'w-14'}`}
        onMouseEnter={() => sidebarMode === 'hover' && setIsHovering(true)}
        onMouseLeave={() => sidebarMode === 'hover' && setIsHovering(false)}
      >
        
        {/* Logo */}
        <div className={`flex shrink-0 items-center px-3 pt-6 transition-all duration-300 ${isExpanded ? 'mb-6' : 'mb-4 justify-center'}`}>
          <Link 
            to={userIsSuperAdmin ? '/admin/superadmin' : '/admin/dashboard'}
            className={`flex items-center gap-3 ${!isExpanded && 'justify-center w-10'}`}
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center">
              <InkoLogo color="purple" size={25} />
            </div>
            {isExpanded && (
              <div>
                <div className="text-xl font-bold tracking-tight text-purple-600">INKO</div>
                <div className="-mt-0.5 text-[10px] font-mono tracking-[0.22em] text-zinc-500 dark:text-zinc-400">ADMIN STUDIO</div>
              </div>
            )}
          </Link>
        </div>

        {/* Workspace Switcher */}
        {blogs.length > 0 && !userIsSuperAdmin && (
          <div ref={workspaceMenuRef} className={`relative mx-2 mb-4 transition-all duration-300 ${isExpanded ? '' : 'flex justify-center'}`}>
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className={`flex w-full items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 transition-all hover:bg-white hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 ${isExpanded ? 'px-3 py-2.5' : 'h-10 w-10 justify-center p-0'}`}
              aria-label="Switch workspace"
            >
              {/* Workspace avatar */}
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

            {/* Dropdown */}
            {showWorkspaceMenu && (
              <div className={`absolute z-50 mt-1.5 rounded-xl border border-zinc-200 bg-white py-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 ${isExpanded ? 'left-0 right-0' : 'left-full ml-2 w-52'}`}>
                <div className="border-b border-zinc-100 px-3.5 pb-2 pt-1.5 dark:border-zinc-800">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Workspaces</div>
                </div>
                <div className="py-1">
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

        <nav className={`flex-1 overflow-y-auto overflow-x-hidden pb-6 transition-all duration-300 ${isExpanded ? 'space-y-2 px-2.5' : 'space-y-0 px-1.5'}`}>
          {userIsSuperAdmin ? (
            <>
              {/* Overview Section */}
              <div className={`${isExpanded ? 'pt-2' : 'pt-1'}`}>
                {isExpanded && <div className={sectionHeaderClass}>Overview</div>}
                <div className={`${isExpanded ? 'space-y-1' : 'space-y-1'}`}>
                  <NavLink to="/admin/superadmin" icon={LayoutDashboard} label="Dashboard" />
                  <NavLink to="/admin/analytics" icon={BarChart3} label="Analytics" />
                </div>
              </div>

              {/* Management Section */}
              <div className={`${isExpanded ? 'pt-4' : 'pt-2'}`}>
                {isExpanded && <div className={sectionHeaderClass}>Management</div>}
                <div className={`${isExpanded ? 'space-y-1' : 'space-y-1'}`}>
                  <NavLink to="/admin/blogs" icon={Building2} label="Blogs" />
                  <NavLink to="/admin/platform-users" icon={Users} label="Users" />
                  <NavLink to="/admin/subscriptions" icon={CreditCard} label="Subscriptions" />
                </div>
              </div>

              {/* Configuration Section */}
              <div className={`${isExpanded ? 'pt-4' : 'pt-2'}`}>
                {isExpanded && <div className={sectionHeaderClass}>Configuration</div>}
                <div className={`${isExpanded ? 'space-y-1' : 'space-y-1'}`}>
                  <NavLink to="/admin/moderation" icon={MessageSquare} label="Moderation" />
                  <NavLink to="/admin/audit-log" icon={ScrollText} label="Audit Log" />
                  <NavLink to="/admin/platform-settings" icon={Settings} label="Settings" />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Overview Section */}
              <div className={`${isExpanded ? 'pt-2' : 'pt-1'}`}>
                {isExpanded && <div className={sectionHeaderClass}>Overview</div>}
                <div className={`${isExpanded ? 'space-y-1' : 'space-y-1'}`}>
                  <NavLink to="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" />
                </div>
              </div>

              {/* Content Section */}
              <div className={`${isExpanded ? 'pt-4' : 'pt-2'}`}>
                {isExpanded && <div className={sectionHeaderClass}>Content</div>}
                <div className={`${isExpanded ? 'space-y-1' : 'space-y-1'}`}>
                  <NavLink to="/admin/posts" icon={FileText} label="Posts" />
                  <NavLink to="/admin/tags" icon={Tag} label="Tags" />
                  <NavLink to="/admin/comments" icon={MessageSquare} label="Comments" />
                </div>
              </div>

              {/* Management Section */}
              <div className={`${isExpanded ? 'pt-4' : 'pt-2'}`}>
                {isExpanded && <div className={sectionHeaderClass}>Management</div>}
                <div className={`${isExpanded ? 'space-y-1' : 'space-y-1'}`}>
                  <NavLink to="/admin/users" icon={Users} label="Team" />
                  <NavLink to="/admin/settings/general" icon={Settings} label="Settings" />
                </div>
              </div>
            </>
          )}
        </nav>

        {/* Bottom Sidebar Control */}
        <div className="border-t border-zinc-200 bg-zinc-50/50 px-2 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="relative" ref={sidebarControlRef}>
            <button
              onClick={() => setShowSidebarControl(!showSidebarControl)}
              className={`w-full flex items-center gap-3 rounded-lg transition-all duration-200 ${
                isExpanded ? 'px-3 py-2' : 'justify-center px-2 py-2'
              } hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60`}
              aria-label="Sidebar control"
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                <MoreVertical size={14} />
              </div>
              {isExpanded && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                      Sidebar control
                    </div>
                    <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {sidebarMode === 'hover' ? 'Expand on hover' : sidebarMode.charAt(0).toUpperCase() + sidebarMode.slice(1)}
                    </div>
                  </div>
                  <MoreVertical size={16} className="text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                </>
              )}
            </button>

            {showSidebarControl && (
              <div className={`absolute bottom-full mb-1 z-50 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 ${isExpanded ? 'left-0 w-48' : 'left-full ml-1.5 w-44'}`}>
                <div className="border-b border-zinc-100 px-3.5 py-2.5 dark:border-zinc-700">
                  <div className="text-sm font-medium text-zinc-900 dark:text-white">Sidebar control</div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => setMode('expanded')}
                    className="flex w-full items-center justify-between px-3.5 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700/60"
                  >
                    <span>Expanded</span>
                    {sidebarMode === 'expanded' && <Check size={16} className="text-zinc-500 dark:text-zinc-400" />}
                  </button>
                  <button
                    onClick={() => setMode('collapsed')}
                    className="flex w-full items-center justify-between px-3.5 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700/60"
                  >
                    <span>Collapsed</span>
                    {sidebarMode === 'collapsed' && <Check size={16} className="text-zinc-500 dark:text-zinc-400" />}
                  </button>
                  <button
                    onClick={() => setMode('hover')}
                    className="flex w-full items-center justify-between px-3.5 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700/60"
                  >
                    <span>Expand on hover</span>
                    {sidebarMode === 'hover' && <Check size={16} className="text-zinc-500 dark:text-zinc-400" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
