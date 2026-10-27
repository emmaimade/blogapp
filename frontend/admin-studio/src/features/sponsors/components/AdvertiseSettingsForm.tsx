import React from 'react';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import type { AdvertiseSettings } from '../hooks/useSponsors';

const MAX_PACKAGES = 5;
const fieldClass =
  'mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100';
const labelClass = 'block text-sm font-medium text-zinc-700 dark:text-zinc-300';

interface Props {
  initial: AdvertiseSettings;
  saving: boolean;
  onSave: (data: AdvertiseSettings) => void;
  pageUrl: string;
}

/** The owner's "Advertise with us" page: on/off, pitch, packages, which live numbers to show, where enquiries go. */
export const AdvertiseSettingsForm = ({ initial, saving, onSave, pageUrl }: Props) => {
  const [data, setData] = React.useState<AdvertiseSettings>(initial);
  const set = <K extends keyof AdvertiseSettings>(key: K, value: AdvertiseSettings[K]) => setData((d) => ({ ...d, [key]: value }));
  const setPackage = (index: number, field: 'name' | 'price' | 'description', value: string) =>
    set('packages', data.packages.map((p, i) => (i === index ? { ...p, [field]: value } : p)));

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...data, contact_email: data.contact_email?.trim() || null, packages: data.packages.filter((p) => p.name.trim()) });
      }}
    >
      <div className="admin-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Advertise page</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {data.enabled
              ? 'Live on your blog, linked from the footer.'
              : 'Hidden. Turn it on to show sponsors your audience and packages.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {initial.enabled && (
            <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-violet-600 hover:underline dark:text-violet-400">
              View page <ExternalLink size={14} />
            </a>
          )}
          <label className="inline-flex cursor-pointer items-center gap-3">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{data.enabled ? 'On' : 'Off'}</span>
            <input type="checkbox" role="switch" className="peer sr-only" checked={data.enabled} onChange={(e) => set('enabled', e.target.checked)} />
            <span className="relative h-6 w-11 rounded-full bg-zinc-300 transition peer-checked:bg-violet-600 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500 dark:bg-zinc-700 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
          </label>
        </div>
      </div>

      <div className="admin-card space-y-4 p-5">
        <label className={labelClass}>
          Introduction
          <textarea rows={4} maxLength={2000} value={data.intro} onChange={(e) => set('intro', e.target.value)} className={fieldClass}
            placeholder="Who reads your blog, and why they're worth reaching." />
        </label>

        <div>
          <p className={labelClass}>Packages</p>
          <div className="mt-2 space-y-3">
            {data.packages.map((pkg, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 rounded-xl border border-zinc-200 p-3 sm:grid-cols-[1fr_10rem_auto] dark:border-zinc-700">
                <input aria-label="Package name" placeholder="Sponsored post" maxLength={60} value={pkg.name}
                  onChange={(e) => setPackage(index, 'name', e.target.value)} className={`${fieldClass} mt-0`} />
                <input aria-label="Price" placeholder="₦50,000" maxLength={60} value={pkg.price}
                  onChange={(e) => setPackage(index, 'price', e.target.value)} className={`${fieldClass} mt-0`} />
                <button type="button" onClick={() => set('packages', data.packages.filter((_, i) => i !== index))}
                  className="inline-flex items-center justify-center rounded-lg px-2 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                  aria-label={`Remove ${pkg.name || 'package'}`}>
                  <Trash2 size={16} />
                </button>
                <input aria-label="What's included" placeholder="What's included" maxLength={300} value={pkg.description}
                  onChange={(e) => setPackage(index, 'description', e.target.value)} className={`${fieldClass} mt-0 sm:col-span-3`} />
              </div>
            ))}
          </div>
          {data.packages.length < MAX_PACKAGES && (
            <button type="button" onClick={() => set('packages', [...data.packages, { name: '', price: '', description: '' }])}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:underline dark:text-violet-400">
              <Plus size={14} /> Add a package
            </button>
          )}
        </div>
      </div>

      <div className="admin-card space-y-3 p-5">
        <p className="text-sm font-bold text-zinc-900 dark:text-white">Live numbers on the page</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Readers and page views over the last 30 days always show. Choose the rest:</p>
        {([
          ['show_followers', 'Email follower count'],
          ['show_sources', 'Where readers come from'],
          ['show_top_posts', 'Most-read posts'],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={data[key]} onChange={(e) => set(key, e.target.checked)} className="accent-violet-600" />
            {label}
          </label>
        ))}
        <p className="pt-2 text-sm font-bold text-zinc-900 dark:text-white">Pointing readers here</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">There's always an "Advertise" link in your blog's footer, and under every sponsor.</p>
        <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" checked={data.show_house_ads} onChange={(e) => set('show_house_ads', e.target.checked)} className="mt-0.5 accent-violet-600" />
          <span>Show “Your brand here” in sponsor spots nobody has booked <span className="text-zinc-500">(recommended)</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" checked={data.show_in_menu} onChange={(e) => set('show_in_menu', e.target.checked)} className="mt-0.5 accent-violet-600" />
          <span>Also add “Advertise” to your blog's top menu</span>
        </label>
        <label className={`${labelClass} pt-2`}>
          Send enquiries to <span className="font-normal text-zinc-500">(optional, your account email otherwise)</span>
          <input type="email" value={data.contact_email ?? ''} onChange={(e) => set('contact_email', e.target.value)} className={fieldClass} />
        </label>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="w-full rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 sm:w-auto">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
};
