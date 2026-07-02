import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  isDanger?: boolean;
  validationMatch?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", isDanger = true, validationMatch 
}) => {
  const [inputValue, setInputValue] = React.useState('');
  
  if (!isOpen) return null;

  // Fix: Force both to lowercase so case differences don't break the match
  const isLocked = validationMatch 
    ? inputValue.trim().toLowerCase() !== validationMatch.trim().toLowerCase() 
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm">
      <div className="admin-card w-full max-w-md overflow-hidden rounded-[1.8rem] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl">
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div
              className={`rounded-2xl p-3 ${isDanger ? "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300" : "bg-zinc-100 text-zinc-950 dark:bg-zinc-800"}`}
            >
              <AlertTriangle size={24} />
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800"
            >
              <X size={20} />
            </button>
          </div>

          <h3 className="mb-2 text-xl font-bold text-zinc-900 dark:text-white">
            {title}
          </h3>
          <p className="whitespace-pre-line text-sm leading-6 text-zinc-600 dark:text-zinc-300 mb-4">
            {message}
          </p>

          {/* Validation Input inside the modal body */}
          {validationMatch && (
            <div className="mt-4 space-y-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-3 border border-zinc-200 dark:border-zinc-800">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Type subdomain{" "}
                <span className="font-mono text-red-600 font-black bg-red-50 dark:bg-red-950/40 px-1 rounded select-all JSON.parse(lowercase) lowercase">
                  {validationMatch}
                </span>{" "}
                to unlock:
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Verify validation slug matching..."
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 p-4">
          <button
            onClick={onClose}
            className="admin-btn admin-btn-secondary px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!isLocked) {
                onConfirm();
                onClose();
              }
            }}
            disabled={isLocked}
            className={`admin-btn px-5 py-2.5 text-sm font-semibold rounded-xl transition-all shadow-sm ${
              isLocked
                ? "bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed opacity-60"
                : isDanger
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};