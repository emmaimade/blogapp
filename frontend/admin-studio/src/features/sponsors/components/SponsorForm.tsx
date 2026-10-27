import React from 'react';
import toast from 'react-hot-toast';
import { ImageIcon, Upload, X } from 'lucide-react';
import type { Sponsor, SponsorInput } from '../hooks/useSponsors';

const EMPTY: SponsorInput = {
  name: '',
  logo_url: null,
  tagline: '',
  url: 'https://',
  placement: 'sidebar',
  starts_on: null,
  ends_on: null,
  is_active: true,
};

const fieldClass =
  'mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100';
const labelClass = 'block text-sm font-medium text-zinc-700 dark:text-zinc-300';

interface SponsorFormProps {
  sponsor: Sponsor | null; // null: adding a new one
  saving: boolean;
  onSave: (data: SponsorInput) => void;
  onCancel: () => void;
  uploadLogo: (file: File) => Promise<string>;
}

export const SponsorForm = ({ sponsor, saving, onSave, onCancel, uploadLogo }: SponsorFormProps) => {
  const [data, setData] = React.useState<SponsorInput>(() =>
    sponsor
      ? {
          name: sponsor.name, logo_url: sponsor.logo_url, tagline: sponsor.tagline, url: sponsor.url,
          placement: sponsor.placement, starts_on: sponsor.starts_on, ends_on: sponsor.ends_on, is_active: sponsor.is_active,
        }
      : EMPTY,
  );
  const [uploading, setUploading] = React.useState(false);
  const set = <K extends keyof SponsorInput>(key: K, value: SponsorInput[K]) => setData((d) => ({ ...d, [key]: value }));

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image file.');
    setUploading(true);
    try {
      set('logo_url', await uploadLogo(file));
    } catch {
      toast.error("Couldn't upload the logo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form
      className="admin-card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...data, url: data.url.trim(), starts_on: data.starts_on || null, ends_on: data.ends_on || null });
      }}
    >
      <h2 className="text-sm font-bold text-zinc-900 dark:text-white">{sponsor ? `Edit ${sponsor.name}` : 'Add a sponsor'}</h2>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          {data.logo_url ? (
            <img src={data.logo_url} alt="" className="h-full w-full object-contain p-1" />
          ) : (
            <ImageIcon size={22} className="text-zinc-300 dark:text-zinc-600" />
          )}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
          <Upload size={14} /> {uploading ? 'Uploading…' : data.logo_url ? 'Change logo' : 'Upload logo'}
          <input type="file" accept="image/*" className="sr-only" onChange={onLogo} disabled={uploading} />
        </label>
        {data.logo_url && (
          <button type="button" onClick={() => set('logo_url', null)} className="text-xs font-semibold text-zinc-500 hover:text-red-600" aria-label="Remove logo">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Sponsor name
          <input required maxLength={80} value={data.name} onChange={(e) => set('name', e.target.value)} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Link
          <input required type="url" pattern="https://.+" title="A full https:// address" value={data.url}
            onChange={(e) => set('url', e.target.value)} className={fieldClass} />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          One-line message <span className="font-normal text-zinc-500">({120 - data.tagline.length} left)</span>
          <input maxLength={120} value={data.tagline} onChange={(e) => set('tagline', e.target.value)} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Where it shows
          <select value={data.placement} onChange={(e) => set('placement', e.target.value as SponsorInput['placement'])} className={fieldClass}>
            <option value="sidebar">Post sidebar (most visible) · under the title on phones</option>
            <option value="post_end">End of every post</option>
            <option value="home">Home page banner</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Starts <span className="font-normal text-zinc-500">(optional)</span>
            <input type="date" value={data.starts_on ?? ''} onChange={(e) => set('starts_on', e.target.value || null)} className={fieldClass} />
          </label>
          <label className={labelClass}>
            Ends <span className="font-normal text-zinc-500">(optional)</span>
            <input type="date" value={data.ends_on ?? ''} min={data.starts_on ?? undefined}
              onChange={(e) => set('ends_on', e.target.value || null)} className={fieldClass} />
          </label>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" checked={data.is_active} onChange={(e) => set('is_active', e.target.checked)} className="accent-violet-600" />
        Show it (untick to pause without deleting)
      </label>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
          Cancel
        </button>
        <button type="submit" disabled={saving || uploading} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
          {saving ? 'Saving…' : sponsor ? 'Save changes' : 'Add sponsor'}
        </button>
      </div>
    </form>
  );
};
