// features/auth/pages/ForcePasswordChangePage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, RefreshCw, Eye, EyeOff, ShieldAlert, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useAuth } from '../context/AuthContext';
import { SupportModal } from '../../support/components/SupportModal';

const PasswordField = ({
  label,
  value,
  onChange,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  minLength?: number;
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required
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
    </div>
  );
};

export const ForcePasswordChangePage = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
      toast.success('Password updated. Welcome back!');
      await refreshUser();
      navigate('/admin', { replace: true });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
        <div className="flex items-start gap-3 mb-6 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/40 text-amber-800 dark:text-amber-400">
          <ShieldAlert size={18} className="mt-0.5 flex-shrink-0" />
          <p className="text-xs leading-relaxed">
            An administrator issued you a temporary password. For security, you must set your own password before continuing.
          </p>
        </div>

        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6">Set a new password</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField label="Temporary Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2" />
          <PasswordField label="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} />
          <PasswordField label="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <KeyRound size={14} />}
            Set New Password
          </button>
        </form>

        <button
          onClick={() => setShowSupportModal(true)}
          className="mt-5 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
        >
          <HelpCircle size={13} />
          Need help? Contact support
        </button>
      </div>

      <SupportModal open={showSupportModal} onClose={() => setShowSupportModal(false)} />
    </div>
  );
};