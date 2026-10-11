import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, MoreHorizontal, Trash2, User, Crown } from "lucide-react";
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

interface MemberActionsMenuProps {
  profileHref: string;
  canRemove: boolean;
  onRemoveClick: () => void;
  /** Shown only to the owner, on other members' rows. */
  onMakeOwnerClick?: () => void;
  direction?: "up" | "down";
}

// The "..." member-actions menu, rendered once per row for both the mobile
// card list and the desktop table (which are both mounted at once - Tailwind's
// block/hidden classes only toggle CSS display, not mounting). It owns its
// own open state and ref rather than taking one from a shared parent: an
// earlier version used a single ref shared across every row and both
// breakpoints, so on mobile the outside-click check ended up comparing
// against the hidden desktop row's node instead of the visible mobile one,
// closing the menu on mousedown before the tap's click ever reached "View
// Profile" / "Remove Member". Same fix as UserMenu in AdminLayout.tsx.
export const MemberActionsMenu = ({ profileHref, canRemove, onRemoveClick, onMakeOwnerClick, direction = "down" }: MemberActionsMenuProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (open && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const positionClasses = direction === "up"
    ? "bottom-full mb-1 origin-bottom-right"
    : "top-full mt-2 origin-top-right";

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label="Member actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <div role="menu" className={`absolute right-0 z-50 w-44 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden py-1 text-sm font-medium ${positionClasses}`}>
          <Link
            to={profileHref}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <User size={14} /> View Profile
          </Link>
          {onMakeOwnerClick && (
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onMakeOwnerClick();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left"
            >
              <Crown size={14} /> Make owner
            </button>
          )}
          {canRemove && (
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onRemoveClick();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-left"
            >
              <Trash2 size={14} /> Remove member
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface MemberActionSheetProps {
  member: BlogMember | null;
  profileHref: string;
  onClose: () => void;
  onRoleSelect: (role: BlogRole) => void;
  onMakeOwnerClick: () => void;
  onRemoveClick: () => void;
}

// Mobile counterpart to RoleDropdown + MemberActionsMenu: one bottom sheet
// with thumb-sized rows, so nothing has to be positioned against a narrow
// screen edge. Only opened for members the owner can actually manage.
export const MemberActionSheet = ({ member, profileHref, onClose, onRoleSelect, onMakeOwnerClick, onRemoveClick }: MemberActionSheetProps) => {
  useEffect(() => {
    if (!member) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [member, onClose]);

  if (!member) return null;

  const rowClass = "flex w-full min-h-12 items-center gap-3 px-5 text-left text-[15px] font-medium transition-colors active:bg-zinc-100 dark:active:bg-zinc-800";

  return (
    // z-60 matches Modal: above the studio's fixed mobile header (z-50).
    <div className="fixed inset-0 z-60 flex items-end bg-zinc-950/45 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Manage ${member.user.first_name} ${member.user.last_name}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-2xl border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-xl"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />

        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          <Avatar firstName={member.user.first_name} lastName={member.user.last_name} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
              {member.user.first_name} {member.user.last_name}
            </p>
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{member.user.email}</p>
          </div>
        </div>

        <p className="px-5 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Role</p>
        <div role="radiogroup" aria-label="Role">
          {ROLES.filter((r) => r !== "owner").map((r) => {
            const selected = member.role === r;
            return (
              <button
                key={r}
                role="radio"
                aria-checked={selected}
                onClick={() => onRoleSelect(r)}
                className={`${rowClass} ${selected ? "text-violet-700 dark:text-violet-400" : "text-zinc-800 dark:text-zinc-200"}`}
              >
                <span className="flex-1">{ROLE_META[r].label}</span>
                {selected && <Check size={18} />}
              </button>
            );
          })}
        </div>

        <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          <Link to={profileHref} onClick={onClose} className={`${rowClass} text-zinc-800 dark:text-zinc-200`}>
            <User size={18} className="text-zinc-400" /> View profile
          </Link>
          <button onClick={onMakeOwnerClick} className={`${rowClass} text-zinc-800 dark:text-zinc-200`}>
            <Crown size={18} className="text-zinc-400" /> Make owner
          </button>
          <button onClick={onRemoveClick} className={`${rowClass} text-red-600 dark:text-red-400`}>
            <Trash2 size={18} /> Remove from workspace
          </button>
        </div>

        <div className="px-4 pt-2">
          <button
            onClick={onClose}
            className="h-12 w-full rounded-xl bg-zinc-100 text-[15px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};