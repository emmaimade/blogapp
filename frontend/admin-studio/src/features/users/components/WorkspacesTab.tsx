import { Shield, LayoutDashboard, Globe } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';

interface BlogMembership {
  id: number;
  role: string;
  blog?: {
    id: number;
    name: string;
    slug: string;
  };
}

interface WorkspacesTabProps {
  targetUser?: any;
}

export default function WorkspacesTab({ targetUser }: WorkspacesTabProps) {
  const { user: currentUser } = useAuth();
  
  // Choose target user metadata scope cleanly
  const displayUser = targetUser || currentUser;
  const memberships = (displayUser?.blog_memberships as BlogMembership[]) || [];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-xs text-zinc-400">
          Review the operational spaces and security role assignments allocated to this account profile across the tenant platform registry.
        </p>
      </div>

      {memberships.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 p-6 text-center">
          <LayoutDashboard className="h-6 w-6 text-zinc-400 mb-2" />
          <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">No active memberships</h4>
          <p className="text-xs text-zinc-400">This account currently operates as an isolated global entity without single tenancy attachments.</p>
        </div>
      ) : (
        <div className="border border-zinc-200 dark:border-zinc-800/80 rounded-xl overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/50 shadow-xs">
          {memberships.map((membership) => {
            const roleColor = membership.role === 'owner' 
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200/40' 
              : membership.role === 'editor'
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-blue-200/40'
              : 'bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 border-zinc-200';

            return (
              <div 
                key={membership.id} 
                className="flex items-center justify-between p-4 bg-white dark:bg-zinc-950 hover:bg-zinc-50/40 dark:hover:bg-zinc-900/10 transition-colors gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center text-zinc-400 flex-shrink-0">
                    <Globe size={14} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {membership.blog?.name || 'Unnamed Workspace'}
                    </h4>
                    <p className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate">
                      /{membership.blog?.slug || 'no-slug'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono tracking-wide capitalize ${roleColor}`}>
                    <Shield size={10} />
                    {membership.role}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}