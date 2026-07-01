import { useParams, useSearchParams } from 'react-router-dom';
import { User, Shield, Building2, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/context/AuthContext';
import ProfileTab from '../components/ProfileTab';
import SecurityTab from '../components/SecurityTab';
import WorkspacesTab from '../components/WorkspacesTab';
import ContextualActivityLogTab from '../components/ContextualActivityLogTab';

type TabId = 'profile' | 'security' | 'workspaces' | 'activity';

interface TabConfigProps {
  targetUserId: number;
  targetUserEmail: string | null;
  targetUser?: any;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Resolve numerical identifier context parameter
  const targetUserId = id ? parseInt(id, 10) : (currentUser?.id || 0);

  // Retrieve data directly from active query cache safely
  const superadminUsersList = queryClient.getQueryData<any[]>(['superadmin-users']) || [];
  const targetUser = superadminUsersList.find((u) => u.id === targetUserId);

  const targetUserEmail = targetUser ? targetUser.email : (currentUser?.email || null);
  const activeTab = (searchParams.get('tab') as TabId) || 'profile';

  const tabs: TabConfig[] = [
    { id: 'profile',    label: 'Profile Settings',   icon: <User size={14} />,        component: ProfileTab as any },
    { id: 'security',   label: 'Security & Auth',    icon: <Shield size={14} />,      component: SecurityTab as any },
    { id: 'workspaces', label: 'Assigned Spaces',    icon: <Building2 size={14} />,   component: WorkspacesTab as any },
    { id: 'activity',   label: 'Activity Logs',      icon: <ShieldCheck size={14} />, component: ContextualActivityLogTab as any },
  ];

  const activeTabConfig = tabs.find((t) => t.id === activeTab) || tabs[0];

  const handleTabChange = (tabId: TabId) => {
    // CRITICAL FIX: Passing { replace: true } overwrites the current browser history entry.
    // This stops tab switches from building a stack, so the browser back button returns to the User List.
    setSearchParams({ tab: tabId }, { replace: true });
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-7xl mx-auto p-6 bg-transparent">
      {/* Sidebar Navigation Panel with Scrollbar Hiding Utilities */}
      <aside className="w-full md:w-64 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-3 md:pb-0 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 pr-0 md:pr-4 flex-shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-3 px-4 py-2.5 text-xs font-medium rounded-xl whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-white shadow-sm font-semibold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50'
              }`}
            >
              <span className={isActive ? 'text-primary-foreground' : 'text-white-400 dark:text-zinc-500'}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </aside>

      {/* Main Tab View Card Panel with Theme Application Colors */}
      <main className="flex-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-card text-card-foreground p-6 shadow-xs min-h-[450px]">
        <div className="space-y-6">
          <div className="border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {activeTabConfig.label}
            </h3>
          </div>
          <div className="mt-4 animate-in fade-in-50 duration-200">
            <activeTabConfig.component 
              targetUserId={targetUserId} 
              targetUserEmail={targetUserEmail} 
              targetUser={targetUser} 
            />
          </div>
        </div>
      </main>
    </div>
  );
}