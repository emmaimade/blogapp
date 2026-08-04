import React, { useState } from 'react';
import { KeyRound, RefreshCw, Mail, ShieldAlert, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { useBlog } from '../../../app/providers/BlogProvider';
import api from '../../../shared/api/client';
import toast from 'react-hot-toast';

const PasswordInput = ({
  value,
  onChange,
  required,
  minLength,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  minLength?: number;
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        className="w-full px-3 py-2 pr-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-900 dark:text-zinc-100"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

interface SecurityTabProps {
  targetUser?: any;
  isSuperadmin?: boolean;
  memberId?: number; // BlogMember.id — required for the workspace-owner Tier 1 call
}

export default function SecurityTab({ targetUser, isSuperadmin, memberId }: SecurityTabProps) {
  const { user: currentUser } = useAuth();
  const { activeBlog, activeRole } = useBlog();

  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [generatedPass, setGeneratedPass] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const isSelf = !targetUser || targetUser.id === currentUser?.id;
  const isWorkspaceOwner = !isSuperadmin && !isSelf && activeRole === 'owner' && !!activeBlog;

  const handleSelfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password credentials updated successfully.');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tier 1 — branches by viewer scope, since a superadmin and a workspace
  // owner hit two different endpoints for what looks like the same action.
  const handleSendResetEmail = async () => {
    if (!targetUser) return;
    setIsSubmitting(true);
    try {
      if (isSuperadmin) {
        await api.post(`/superadmin/users/${targetUser.id}/trigger-reset-email`);
      } else if (isWorkspaceOwner && activeBlog && memberId) {
        await api.post(`/blogs/${activeBlog.id}/members/${memberId}/trigger-reset-email`);
      } else {
        toast.error('Unable to determine the correct action for this account.');
        return;
      }
      toast.success(`A password recovery link has been sent to ${targetUser.email}`);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Could not send the recovery email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tier 2 — superadmin-only, never reachable via the workspace-owner path.
  const handleGenerateTempPassword = async () => {
    setIsSubmitting(true);
    setGeneratedPass(null);
    try {
      const res = await api.patch(`/superadmin/users/${targetUser.id}/force-temporary-password`);
      setGeneratedPass(res.data.temporary_password);
      toast.success('Temporary operational passphrase generated.');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update credentials via administrative override.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedPass) return;
    navigator.clipboard.writeText(generatedPass);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (isSelf) {
    return (
      <form onSubmit={handleSelfSubmit} className="space-y-6 max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Current Password</label>
            <PasswordInput value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>

          <div className="h-px bg-zinc-100 dark:bg-zinc-900 my-2" />

          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">New Password</label>
            <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Confirm New Password</label>
            <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-violet-700 dark:bg-violet-800 text-white dark:text-zinc-950 text-xs font-medium rounded-xl disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {isSubmitting ? <RefreshCw size={12} className="animate-spin" /> : <KeyRound size={12} />}
            Update Password
          </button>
        </div>
      </form>
    );
  }

  // Neither superadmin nor a legitimate workspace owner — shouldn't normally
  // be reachable (ProtectedRoute + backend both enforce this), but rendering
  // a clear message here rather than a broken button is cheap insurance.
  if (!isSuperadmin && !isWorkspaceOwner) {
    return (
      <div className="max-w-xl p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500">
        You don't have permission to manage this account's security settings.
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/40 text-xs text-amber-800 dark:text-amber-400 flex gap-3 items-start">
        <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <span className="font-semibold">
            {isSuperadmin ? 'Administrative Access Matrix:' : 'Team Account Recovery:'}
          </span>
          <p className="text-zinc-500 dark:text-zinc-400">
            You are managing safety configurations for{' '}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">@{targetUser?.username}</strong>.{' '}
            {isSuperadmin
              ? "Choose the recovery path that fits the user's current situation."
              : 'You can send them a password reset link to their own inbox.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Mail size={13} className="text-blue-500" />
              {isSuperadmin ? 'Tier 1: Send Password Reset Link' : 'Send Password Reset Link'}
            </h4>
            <p className="text-[11px] text-zinc-400 leading-normal">
              Dispatches an encrypted email token link directly to their mailbox. Recommended to prevent handling user cleartext.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSendResetEmail}
            disabled={isSubmitting}
            className="w-full sm:w-auto self-end px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
          >
            {isSubmitting ? 'Processing...' : 'Send Recovery Email'}
          </button>
        </div>

        {isSuperadmin && (
          <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <KeyRound size={13} className="text-emerald-500" />
                Tier 2: Force Generate Temporary Credentials
              </h4>
              <p className="text-[11px] text-zinc-400 leading-normal">
                Generates a temporary string immediately on screen. The system flag will automatically force the user to set a private password on their next login session.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerateTempPassword}
              disabled={isSubmitting}
              className="w-full sm:w-auto self-end px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
            >
              Generate Temporary Password
            </button>
          </div>
        )}
      </div>

      {generatedPass && (
        <div className="p-4 border border-emerald-200/50 bg-emerald-50/20 dark:bg-emerald-950/10 rounded-xl space-y-2 animate-in slide-in-from-top-2 duration-200">
          <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
            Temporary Credential String Generated Successfully
          </div>
          <div className="flex items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
            <code className="text-xs font-mono font-bold select-all tracking-wider text-zinc-800 dark:text-zinc-200">
              {generatedPass}
            </code>
            <button
              onClick={copyToClipboard}
              className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-[10px] text-zinc-400 italic leading-snug">
            Security Rule: This plaintext credential won't be shown again. Copy and share it with the user via a secure channel now.
          </p>
        </div>
      )}
    </div>
  );
}