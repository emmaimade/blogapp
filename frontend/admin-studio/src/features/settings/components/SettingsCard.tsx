import { useId, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Switch } from '../../../shared/ui/Switch';

interface SettingsCardProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  /** Right side of the header, e.g. a button. */
  action?: ReactNode;
  /** A show/hide switch for the whole section, in the header. */
  toggle?: { checked: boolean; onChange: (checked: boolean) => void; label: string };
  /** Omit (or pass nothing) to show only the header, e.g. while the section is switched off. */
  children?: ReactNode;
}

/** One section of a settings page. */
export const SettingsCard = ({ title, description, icon: Icon, action, toggle, children }: SettingsCardProps) => {
  const id = useId();

  return (
    <section aria-labelledby={`${id}-title`} className="admin-card overflow-hidden rounded-[1.5rem]">
      <div
        className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-3 bg-zinc-50/50 px-5 py-4 dark:bg-zinc-900/50 sm:px-6 ${
          children ? 'border-b border-zinc-200 dark:border-zinc-800' : ''
        }`}
      >
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-white">
            {Icon && <Icon size={18} className="shrink-0 text-violet-500" aria-hidden="true" />}
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
        </div>
        {action}
        {toggle && (
          <div className="flex items-center gap-2.5">
            <label htmlFor={`${id}-toggle`} className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              {toggle.label}
            </label>
            <Switch id={`${id}-toggle`} checked={toggle.checked} onChange={toggle.onChange} />
          </div>
        )}
      </div>
      {children && <div className="space-y-6 p-5 sm:p-6">{children}</div>}
    </section>
  );
};
