import {
  Activity,
  CreditCard,
  FilePlus2,
  LogIn,
  MessageSquare,
  MessageSquareX,
  Palette,
  Pencil,
  Send,
  Settings,
  ShieldCheck,
  Tag,
  Trash2,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

export interface ActionStyle {
  Icon: LucideIcon;
  /** Background + icon colour for the badge. */
  tone: string;
}

const TONES = {
  create: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
  update: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
  destroy: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400',
  access: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400',
  comment: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400',
  neutral: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
} as const;

/**
 * What kind of thing happened, at a glance: created/published (green),
 * edited (amber), deleted/removed (red), roles and access (violet),
 * comments (blue), settings and everything else (neutral).
 */
export const getActionStyle = (action: string): ActionStyle => {
  const act = action.toLowerCase();

  if (act.startsWith('comment.')) {
    return act.includes('delete')
      ? { Icon: MessageSquareX, tone: TONES.destroy }
      : { Icon: MessageSquare, tone: TONES.comment };
  }
  if (act.includes('member_permissions') || act.includes('role')) return { Icon: ShieldCheck, tone: TONES.access };
  if (act.includes('member_add') || act.includes('register')) return { Icon: UserPlus, tone: TONES.create };
  if (act.includes('member_remove')) return { Icon: UserMinus, tone: TONES.destroy };
  if (act.includes('login') || act.includes('password') || act.includes('auth')) return { Icon: LogIn, tone: TONES.access };
  if (act.startsWith('billing.')) return { Icon: CreditCard, tone: TONES.neutral };
  if (act.startsWith('branding.')) return { Icon: Palette, tone: TONES.neutral };
  if (act.startsWith('settings.') || act === 'blog.update') return { Icon: Settings, tone: TONES.neutral };
  if (act.includes('delete') || act.includes('remove')) return { Icon: Trash2, tone: TONES.destroy };
  if (act.includes('publish')) return { Icon: Send, tone: TONES.create };
  if (act.startsWith('tag.')) return { Icon: Tag, tone: act.includes('create') ? TONES.create : TONES.update };
  if (act.includes('create')) return { Icon: FilePlus2, tone: TONES.create };
  if (act.includes('update') || act.includes('edit') || act.includes('draft') || act.includes('schedul')) {
    return { Icon: Pencil, tone: TONES.update };
  }
  return { Icon: Activity, tone: TONES.neutral };
};
