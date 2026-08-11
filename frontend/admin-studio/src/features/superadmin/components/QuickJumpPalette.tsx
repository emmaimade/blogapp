import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  Clock,
  CreditCard,
  HelpCircle,
  LayoutDashboard,
  Search,
  Settings,
  ShieldAlert,
  Users,
} from "lucide-react";

interface QuickJumpPaletteProps {
  onClose: () => void;
}

interface QuickJumpItem {
  label: string;
  description: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const ITEMS: QuickJumpItem[] = [
  { label: "Dashboard", description: "Platform overview", path: "/admin/superadmin", icon: LayoutDashboard },
  { label: "Analytics", description: "Platform-wide analytics", path: "/admin/analytics", icon: BarChart3 },
  { label: "Blogs", description: "All tenant workspaces", path: "/admin/blogs", icon: Building2 },
  { label: "Users", description: "Platform users", path: "/admin/platform-users", icon: Users },
  { label: "Subscriptions", description: "Billing and plans", path: "/admin/subscriptions", icon: CreditCard },
  { label: "Moderation", description: "Flagged content queue", path: "/admin/moderation", icon: ShieldAlert },
  { label: "Audit log", description: "Platform activity history", path: "/admin/audit-log", icon: Clock },
  { label: "Platform settings", description: "Global configuration", path: "/admin/platform-settings", icon: Settings },
  { label: "Support", description: "Tenant support tickets", path: "/admin/support", icon: HelpCircle },
];

// Mounted by the parent only while open, so `useState` initializers already
// give us a clean slate each time — no reset-on-open effect required.
export const QuickJumpPalette: React.FC<QuickJumpPaletteProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return ITEMS;
    return ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(trimmed) ||
        item.description.toLowerCase().includes(trimmed),
    );
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  };

  const go = (item: QuickJumpItem) => {
    navigate(item.path);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = results[selectedIndex];
      if (item) go(item);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/45 p-4 pt-24 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="admin-card w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 dark:border-zinc-800">
          <Search size={16} className="flex-shrink-0 text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Jump to a platform section..."
            aria-label="Jump to a platform section"
            className="h-12 w-full min-w-0 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 outline-none dark:text-white dark:placeholder:text-zinc-500"
          />
          <span className="flex-shrink-0 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950">
            Esc
          </span>
        </div>

        <div className="max-h-80 overflow-y-auto py-1.5">
          {results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">No matching section.</p>
          )}
          {results.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => go(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  index === selectedIndex
                    ? "bg-violet-50 dark:bg-violet-900/20"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                }`}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white">{item.label}</div>
                  <div className="truncate text-xs text-zinc-500">{item.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
