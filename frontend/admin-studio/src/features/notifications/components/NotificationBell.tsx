import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Inbox } from "lucide-react";
import {
  useNotifications,
  type AppNotification,
} from "../hooks/useNotifications";

const formatRelative = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// Self-contained, same reasoning as UserMenu: the dropdown must be portaled
// to document.body (fixed-position children get trapped by any transformed
// ancestor - see the Sidebar/SupportModal fix), so position is tracked via
// getBoundingClientRect() off the trigger button rather than relying on
// normal CSS positioning.
export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    right: number;
    width: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const {
    unreadCount,
    notifications,
    refetch,
    markReadMutation,
    markAllReadMutation,
  } = useNotifications();

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const idealWidth = 320; // matches w-80
      const margin = 12;

      const right = window.innerWidth - rect.right; // exact anchor, never shifted
      const availableWidth = window.innerWidth - right - margin;
      const width = Math.min(idealWidth, availableWidth);

      setPosition({ top: rect.bottom + 8, right, width });
      refetch();
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.read_at) markReadMutation.mutate(notification.id);
    setOpen(false);
    navigate(notification.link);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && position && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: position.top, right: position.right, width: position.width }}
          className="z-[9999] max-h-[70vh] flex flex-col rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline"
                >
                  <Check size={12} /> Mark all read
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-300/60 dark:[&::-webkit-scrollbar-thumb]:bg-[#444444] [&::-webkit-scrollbar-thumb]:rounded-full">
              {!notifications?.length && (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-zinc-400">
                  <Inbox size={24} />
                  <p className="text-xs">No notifications yet</p>
                </div>
              )}
              {notifications?.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/60 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${
                    !notification.read_at
                      ? "bg-violet-50/50 dark:bg-violet-950/10"
                      : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!notification.read_at && (
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-600" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {notification.title}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                        {notification.body}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {formatRelative(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
