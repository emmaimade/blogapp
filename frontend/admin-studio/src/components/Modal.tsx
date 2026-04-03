import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  isDanger?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", isDanger = true 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="admin-card w-full max-w-md overflow-hidden rounded-[1.8rem]">
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className={`rounded-2xl p-3 ${isDanger ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'}`}>
              <AlertTriangle size={24} />
            </div>
            <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
              <X size={20} />
            </button>
          </div>
          
          <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">{message}</p>
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--admin-line)] bg-[color:var(--admin-bg)]/80 p-4">
          <button 
            onClick={onClose}
            className="admin-btn admin-btn-secondary px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className={`admin-btn px-4 py-2 text-sm ${
              isDanger ? 'bg-red-600 text-white hover:bg-red-700' : 'admin-btn-primary'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
