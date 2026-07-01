import React, { useState } from 'react';
import { KeyRound, RefreshCw, Mail, ShieldAlert, Copy, Check } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import api from '../../../shared/api/client';
import toast from 'react-hot-toast';

interface SecurityTabProps {
  targetUser?: any;
}

export default function SecurityTab({ targetUser }: SecurityTabProps) {
  const { user: currentUser } = useAuth();
  
  // Self Password States explicitly typed
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  
  // Administrative Loading/Output States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [generatedPass, setGeneratedPass] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const isSelf = !targetUser || targetUser.id === currentUser?.id;

  // Personal account change track handler
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
      toast.error(error.response?.data?.message || 'Failed to update credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tier 1: Send outbound system trigger recovery mail
  const handleSendResetEmail = async () => {
    setIsSubmitting(true);
    try {
      await api.post(`/superadmin/users/${targetUser.id}/trigger-reset-email`);
      toast.success(`A password recovery token link has been dispatched to ${targetUser.email}`);
    } catch (error: any) {
      toast.error('Could not execute system outbound email pipeline.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tier 2: Generate unique high-entropy forced password block
  const handleGenerateTempPassword = async () => {
    setIsSubmitting(true);
    setGeneratedPass(null);
    try {
      const res = await api.patch(`/superadmin/users/${targetUser.id}/force-temporary-password`);
      setGeneratedPass(res.data.temporary_password);
      toast.success('Temporary operational passphrase generated.');
    } catch (error: any) {
      toast.error('Failed to update credentials via administrative override.');
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

  // --- RENDER PERSONAL PROFILE FORM ---
  if (isSelf) {
    return (
      <form onSubmit={handleSelfSubmit} className="space-y-6 max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="h-px bg-zinc-100 dark:bg-zinc-900 my-2" />

          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-medium rounded-xl disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {isSubmitting ? <RefreshCw size={12} className="animate-spin" /> : <KeyRound size={12} />}
            Update Password
          </button>
        </div>
      </form>
    );
  }

  // --- RENDER SUPERADMIN OPTIONS MATRIX TIER 1 & 2 ---
  return (
    <div className="max-w-xl space-y-6">
      <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/40 text-xs text-amber-800 dark:text-amber-400 flex gap-3 items-start">
        <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <span className="font-semibold">Administrative Access Matrix:</span>
          <p className="text-zinc-500 dark:text-zinc-400">
            You are managing safety configurations for <strong className="font-semibold text-zinc-800 dark:text-zinc-200">@{targetUser?.username}</strong>. Choose the recovery path that fits the user's current situation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Tier 1 Box Container */}
        <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Mail size={13} className="text-blue-500" />
              Tier 1: Send Password Reset Link
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

        {/* Tier 2 Box Container */}
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
      </div>

      {/* Temp Password Reveal Notification Output Box */}
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