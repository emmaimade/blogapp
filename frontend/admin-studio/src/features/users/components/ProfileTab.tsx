import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/client';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/context/AuthContext';

interface ProfileTabProps {
  targetUser?: any; 
}

export default function ProfileTab({ targetUser }: ProfileTabProps) {
  const { user: currentUser, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSelf = !targetUser || targetUser.id === currentUser?.id;
  const displayUser = targetUser || currentUser;

  useEffect(() => {
    if (displayUser) {
      setFirstName(displayUser.first_name || '');
      setLastName(displayUser.last_name || '');
    }
  }, [displayUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // If it's yourself, use standard route. If it's an administrative change, patch the user item
      const endpoint = isSelf ? '/users/me' : `/superadmin/users/${displayUser.id}`;
      await api.patch(endpoint, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });

      toast.success('Profile updated successfully');
      if (isSelf && refreshUser) {
        await refreshUser();
      }
    } catch (error) {
      toast.error('Failed to save profile changes');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!displayUser) return <div className="text-xs text-zinc-400">No profile data accessible.</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">First Name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Last Name</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Email Address</label>
        <input
          type="email"
          disabled
          value={displayUser.email || ''}
          className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-sm text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
        />
      </div>

      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-900 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-primary dark:bg-violet-800 text-white dark:text-zinc-950 text-xs font-medium rounded-xl disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}