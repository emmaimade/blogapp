export interface TimezoneOption {
  value: string;
  label: string;
}

export interface TimezoneGroup {
  region: string;
  options: TimezoneOption[];
}

// For browsers without Intl.supportedValuesOf (Safari before 15.4).
const FALLBACK_TIMEZONES = [
  'Africa/Lagos', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Nairobi', 'Africa/Accra',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo', 'America/Toronto',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'Europe/Berlin', 'Europe/London', 'Europe/Madrid', 'Europe/Paris', 'Pacific/Auckland',
];

const offsetLabel = (timeZone: string): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
};

const cityLabel = (timeZone: string) => timeZone.split('/').slice(1).join(' / ').replace(/_/g, ' ');

let cachedGroups: TimezoneGroup[] | null = null;

/** Every IANA timezone, grouped by region, labelled "Lagos (GMT+1)". UTC comes first, on its own. */
export const getTimezoneGroups = (): TimezoneGroup[] => {
  if (cachedGroups) return cachedGroups;

  let zones: string[];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = FALLBACK_TIMEZONES;
  }

  const byRegion = new Map<string, TimezoneOption[]>();
  for (const zone of zones) {
    const [region] = zone.split('/');
    if (!zone.includes('/') || region === 'Etc') continue;
    const offset = offsetLabel(zone);
    const options = byRegion.get(region) ?? [];
    options.push({ value: zone, label: offset ? `${cityLabel(zone)} (${offset})` : cityLabel(zone) });
    byRegion.set(region, options);
  }

  cachedGroups = [
    { region: 'Universal', options: [{ value: 'UTC', label: 'UTC (Coordinated Universal Time)' }] },
    ...[...byRegion.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([region, options]) => ({ region, options: options.sort((a, b) => a.label.localeCompare(b.label)) })),
  ];
  return cachedGroups;
};

/** Sets the blog's `<html lang>`, which screen readers and search engines use. */
export const LANGUAGES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'zh', label: 'Chinese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ha', label: 'Hausa' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ig', label: 'Igbo' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'es', label: 'Spanish' },
  { value: 'sw', label: 'Swahili' },
  { value: 'tr', label: 'Turkish' },
  { value: 'yo', label: 'Yoruba' },
];
