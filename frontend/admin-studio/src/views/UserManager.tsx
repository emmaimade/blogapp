import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  ShieldCheck, 
  User as UserIcon, 
  Mail, 
  Search, 
  UserPlus,
  ShieldAlert,
  Calendar,
  Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export const UserManager = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch current user context to prevent self-demotion
  // We assume your auth state provides the current logged-in user ID
  const { data: currentUser } = useQuery<User>({
    queryKey: ['currentUser'],
    queryFn: async () => (await api.get('/users/me')).data
  });

  // 2. Fetch all users for the directory
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['adminUsers'],
    queryFn: async () => (await api.get('/admin/users')).data
  });

  // 3. Update User Role Mutation
  const toggleRoleMutation = useMutation({
    mutationFn: ({ id, newRole }: { id: number; newRole: string }) => 
      api.patch(`/admin/${id}/role`, { role: newRole }),
    onSuccess: () => {
      // Invalidate the list to show fresh data from the server
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('Permissions updated successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to update role';
      toast.error(message);
    }
  });

  // Client-side search filtering
  const filteredUsers = users?.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <div className="p-20 text-center animate-pulse text-gray-400">Loading user directory...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header & Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="text-indigo-600" size={32} /> User Directory
          </h1>
          <p className="text-gray-500 mt-1">Manage user permissions and community status.</p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Search username or email..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500">Member</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500">Contact</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500">Status</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers?.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        user.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {user.role === 'admin' ? <ShieldCheck size={20} /> : <UserIcon size={20} />}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{user.username}</div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase tracking-tighter">
                          <Calendar size={10} /> Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail size={14} className="text-gray-400" />
                      {user.email}
                    </div>
                  </td>

                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                      user.role === 'admin' 
                        ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                        : 'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}>
                      {user.role === 'admin' ? 'ADMIN' : 'USER'}
                    </span>
                  </td>

                  <td className="p-4 text-right">
                    {/* Security: Don't allow an admin to demote themselves */}
                    {user.id !== currentUser?.id ? (
                      <button 
                        onClick={() => toggleRoleMutation.mutate({ 
                          id: user.id, 
                          newRole: user.role === 'admin' ? 'user' : 'admin' 
                        })}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                          user.role === 'admin'
                            ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            : 'text-indigo-600 hover:bg-indigo-50'
                        }`}
                      >
                        {user.role === 'admin' ? (
                          <><ShieldAlert size={16} /> Demote</>
                        ) : (
                          <><UserPlus size={16} /> Make Admin</>
                        )}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-400 bg-gray-50 rounded-lg italic">
                        <Lock size={12} /> You (Self)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers?.length === 0 && (
          <div className="p-20 text-center">
             <Users className="mx-auto text-gray-200 mb-4" size={48} />
             <p className="text-gray-400 font-medium">No members found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
};