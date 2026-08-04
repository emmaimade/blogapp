import { useParams, useSearchParams } from 'react-router-dom';
import { User, Shield, Building2, ShieldCheck, Loader2, MoreHorizontal } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/context/AuthContext';
import { useBlog } from '../../../app/providers/BlogProvider';
import api from '../../../shared/api/client';
import ProfileTab from '../components/ProfileTab';
import SecurityTab from '../components/SecurityTab';
import WorkspacesTab from '../components/WorkspacesTab';
import ContextualActivityLogTab from '../components/ContextualActivityLogTab';
import { useState } from 'react';

type TabId = 'profile' | 'security' | 'workspaces' | 'activity';

interface TabConfigProps {
  targetUser: any;
  targetUserId: number;
  targetUserEmail: string | null;
  isSuperadmin?: boolean;
  memberId?: number;
}

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  component: React.ComponentType<TabConfigProps>;
}

export default function UserInfoPage() {
  const { id } = useParams<{ id?: string }>();
  const { user: currentUser } = useAuth();
  const { activeBlog } = useBlog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showMore, setShowMore] = useState(false);

  const targetUserId = id ? parseInt(id, 10) : (currentUser?.id || 0);

  const { data: targetUser, isLoading, error } = useQuery<any>({
    queryKey: ['user-detail', targetUserId],
    queryFn: async () => {
      const response = await api.get(`/users/${targetUserId}`);
      return response.data;
    },
    enabled: !!targetUserId,
    staleTime: 5 * 60 * 1000,
  });

  const targetUserEmail = targetUser ? targetUser.email : null;
  const activeTab = (searchParams.get('tab') as TabId) || 'profile';

  const membershipInActiveBlog = targetUser?.blog_memberships?.find(
    (m: any) => m.blog_id === activeBlog?.id,
  );
  const memberId = membershipInActiveBlog?.id;

  const tabs: TabConfig[] = [
    { id: 'profile',    label: 'Profile',     icon: <User size={20} />,        component: ProfileTab as any },
    { id: 'security',   label: 'Security',    icon: <Shield size={20} />,      component: SecurityTab as any },
    { id: 'workspaces', label: 'Workspaces',  icon: <Building2 size={20} />,   component: WorkspacesTab as any },
    { id: 'activity',   label: 'Activity',    icon: <ShieldCheck size={20} />, component: ContextualActivityLogTab as any },
  ];

  const mainTabs = tabs.slice(0, 4);
  const moreTabs = tabs.slice(4);

  const activeTabConfig = tabs.find((t) => t.id === activeTab) || tabs[0];

  const handleTabChange = (tabId: TabId) => {
    setSearchParams({ tab: tabId }, { replace: true });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-violet-600" size={28} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[450px] w-full flex-col items-center justify-center text-center p-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-card">
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Profile Unavailable</h3>
        <p className="text-xs text-zinc-500 mt-1 max-w-md">
          You don't have authorization permissions to view this user profile or the target user account no longer exists.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col gap-1.5 border-r border-zinc-200 dark:border-zinc-800 pr-6 flex-shrink-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                isActive
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </aside>

      {/* Main Content */}
      <main className="flex-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-card text-card-foreground p-6 shadow-xs min-h-[450px]">
        <div className="space-y-6">
          <div className="border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {activeTabConfig.label}
            </h3>
          </div>
          <div className="mt-4 animate-in fade-in-50 duration-200">
            <activeTabConfig.component
              targetUser={targetUser}
              targetUserId={targetUserId}
              targetUserEmail={targetUserEmail}
              isSuperadmin={currentUser?.is_super_admin}
              memberId={memberId}
            />
          </div>
        </div>
      </main>

      {/* Mobile Bottom Tab Navigator */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/95 lg:hidden">
        <div className="flex items-center justify-around px-1 py-1">
          {mainTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex flex-col items-center justify-center flex-1 py-2 px-2 rounded-2xl transition-all ${
                  isActive ? 'text-violet-600' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {tab.icon}
                <span className="text-[10px] font-medium tracking-tight mt-0.5">{tab.label}</span>
              </button>
            );
          })}

          {moreTabs.length > 0 && (
            <button
              onClick={() => setShowMore(true)}
              className="flex flex-col items-center justify-center flex-1 py-2 px-2 rounded-2xl text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <MoreHorizontal size={22} className="mb-0.5" />
              <span className="text-[10px] font-medium tracking-tight">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* More Menu Bottom Sheet */}
      {showMore && moreTabs.length > 0 && (
        <>
          <div className="fixed inset-0 z-[60] lg:hidden" onClick={() => setShowMore(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[70] lg:hidden bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 rounded-t-3xl max-h-[70vh] overflow-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex justify-center flex-1">
                <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
              </div>
              <button 
                onClick={() => setShowMore(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-xs uppercase tracking-widest text-zinc-400 mb-4">More Options</p>
              <div className="space-y-1">
                {moreTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      handleTabChange(tab.id);
                      setShowMore(false);
                    }}
                    className="flex items-center gap-3 px-4 py-4 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 w-full text-left"
                  >
                    {tab.icon}
                    <span className="font-medium">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}