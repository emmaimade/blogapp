import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import type { BlogRole, BlogMember } from "../hooks/useUserManager";
import { Spinner } from "../../../shared/ui/Spinner";

export const ROLES: BlogRole[] = ["owner", "editor", "author"];

export const ROLE_META: Record<BlogRole, { label: string; color: string }> = {
  owner: { label: "Owner", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/50 shadow-2xs" },
  editor: { label: "Editor", color: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200/60 dark:border-violet-800/50 shadow-2xs" },
  author: { label: "Author", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/50 shadow-2xs" },
};

export const Avatar = ({ firstName, lastName, size = "md" }: { firstName: string; lastName: string; size?: "sm" | "md" }) => {
  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();

  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/50 shadow-2xs ${dim}`}>
      {initials}
    </div>
  );
};

export const RoleBadge = ({ role }: { role: BlogRole }) => {
  const { label, color } = ROLE_META[role];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium border shadow-2xs capitalize ${color}`}>
      {label}
    </span>
  );
};

interface RoleDropdownProps {
  member: BlogMember;
  currentUserId?: number;
  onRoleChange: (memberId: number, role: BlogRole) => void;
  isPending: boolean;
  direction?: "up" | "down"; // Added dynamic direction prop
}

export const RoleDropdown = ({ member, currentUserId, onRoleChange, isPending, direction = "up" }: RoleDropdownProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const isLocked = member.role === "owner" || member.user_id === currentUserId;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (open && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (isLocked) return <RoleBadge role={member.role} />;

  // Dynamic positioning classes based on row location
  const dropdownClasses = direction === "down" 
    ? "top-full mt-1 origin-top-left" 
    : "bottom-full mb-2 origin-bottom-left";

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:outline-none"
      >
        <RoleBadge role={member.role} />
        {isPending ? (
          <Spinner size={12} className="text-zinc-400" />
        ) : (
          <ChevronDown size={12} className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && (
        <div className={`absolute left-0 z-50 w-40 rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 ${dropdownClasses}`}>
          {ROLES.filter((r) => r !== "owner").map((r) => {
            const { label, color } = ROLE_META[r];
            return (
              <button
                key={r}
                onClick={() => {
                  onRoleChange(member.id, r);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${member.role === r ? "text-violet-700 dark:text-violet-400" : "text-zinc-700 dark:text-zinc-300"}`}
              >
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${color}`}>
                  <span className="text-3xs font-bold uppercase">{label.charAt(0)}</span>
                </span>
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};