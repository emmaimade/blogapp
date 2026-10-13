interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  /** Needed when no visible label points at the switch through aria-labelledby. */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

/** An on/off toggle. Use it for settings that take effect as a whole — show this, allow that. */
export const Switch = ({ checked, onChange, id, disabled, ...aria }: SwitchProps) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? 'bg-violet-600' : 'bg-zinc-300 dark:bg-zinc-700'
    }`}
    {...aria}
  >
    <span
      className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-[22px]' : 'translate-x-0.5'
      }`}
    />
  </button>
);
