import React, { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Image, LayoutList, Loader2, Palette, Type, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { toastApiError } from '../../../shared/lib/apiErrors';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsForm } from '../components/SettingsForm';
import { Field, hintClass, inputClass, labelClass, secondaryButtonClass } from '../components/SettingsFields';
import { useSettingsForm } from '../hooks/useSettingsForm';

type PostLayout = 'feed' | 'list' | 'cards' | 'compact';

interface BrandingSettingsData {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string;
  favicon_url: string;
  font_heading: string;
  font_body: string;
  // Saved with the rest of branding (the endpoint takes the whole object),
  // so they must always be in the form data — or saving a colour would reset them.
  home_layout: PostLayout;
  archive_layout: PostLayout;
}

const defaultBrandingSettings: BrandingSettingsData = {
  primary_color: '#9333EA',
  secondary_color: '#18181B',
  accent_color: '#A855F7',
  logo_url: '',
  favicon_url: '',
  font_heading: 'Inter',
  font_body: 'Inter',
  home_layout: 'feed',
  archive_layout: 'list',
};

const HEADING_FONTS = ['Inter', 'Roboto', 'Poppins', 'Montserrat', 'Playfair Display', 'Merriweather', 'Lora', 'Open Sans'];
const BODY_FONTS = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Source Sans Pro', 'Raleway', 'PT Sans', 'Nunito'];

// The blog only reads the primary colour today; the other two are stored for
// themes that use them.
const COLOR_FIELDS = [
  { key: 'primary_color', label: 'Primary', hint: 'Buttons, links and highlights across your blog.' },
  { key: 'secondary_color', label: 'Secondary', hint: "Saved with your brand. The current theme doesn't use it yet." },
  { key: 'accent_color', label: 'Accent', hint: "Saved with your brand. The current theme doesn't use it yet." },
] as const;

const LAYOUT_OPTIONS: Array<{ value: PostLayout; label: string; description: string }> = [
  { value: 'feed', label: 'Feed', description: 'Title, excerpt and byline. A thumbnail only when the post has one.' },
  { value: 'list', label: 'List', description: 'Thumbnail, title and date. Compact but visual.' },
  { value: 'compact', label: 'Compact', description: 'One line per post: date, title and tags.' },
  { value: 'cards', label: 'Cards', description: 'A grid of small image cards. Best when every post has a thumbnail.' },
];

const hexColorPattern = /^#(?:[0-9A-F]{3}){1,2}$/i;

const getSafeHexColor = (value: string | undefined, fallback: string) =>
  value && hexColorPattern.test(value) ? value : fallback;

const colorError = (value: string) => (hexColorPattern.test(value) ? null : 'Use a hex colour like #9333EA.');

/** WCAG contrast ratio of a hex colour against white. */
const contrastWithWhite = (hex: string) => {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (luminance + 0.05);
};

// Normal-size text needs 4.5:1 (WCAG AA); the primary colour is used for both
// link text and white-on-colour buttons.
const MIN_CONTRAST = 4.5;

/** Loads the chosen Google Fonts into the studio, so the preview shows the real typefaces. */
const usePreviewFonts = (fonts: string[]) => {
  const families = [...new Set(fonts.filter(Boolean))].sort().join('|');
  useEffect(() => {
    if (!families) return;
    const query = families
      .split('|')
      .map((font) => `family=${font.trim().replace(/\s+/g, '+')}:wght@400;700;900`)
      .join('&');
    let link = document.getElementById('settings-font-preview') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = 'settings-font-preview';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
  }, [families]);
};

const PreviewBar: React.FC<{ className: string }> = ({ className }) => (
  <span className={`block rounded-sm ${className}`} />
);

/** A tiny drawing of each layout, so owners can see what they're choosing. */
const LayoutPreview: React.FC<{ layout: PostLayout }> = ({ layout }) => {
  const image = 'bg-zinc-200 dark:bg-zinc-600';
  const strong = 'bg-zinc-400 dark:bg-zinc-400';
  const faint = 'bg-zinc-300 dark:bg-zinc-600';

  if (layout === 'cards') {
    return (
      <div className="grid grid-cols-4 gap-1">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="rounded-sm border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
            <PreviewBar className={`h-3 ${image}`} />
            <PreviewBar className={`mt-0.5 h-1 w-4/5 ${strong}`} />
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'list') {
    return (
      <div className="space-y-1.5">
        {['w-4/5', 'w-3/5', 'w-11/12'].map((width, i) => (
          <div key={i} className="flex items-center gap-2">
            <PreviewBar className={`h-4 w-4 shrink-0 ${image}`} />
            <div className="flex-1">
              <PreviewBar className={`h-1.5 ${strong} ${width}`} />
              <PreviewBar className={`mt-0.5 h-1 w-1/3 ${faint}`} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'compact') {
    return (
      <div className="space-y-2">
        {['w-4/5', 'w-3/5', 'w-11/12', 'w-2/3', 'w-3/4'].map((width, i) => (
          <div key={i} className="flex items-center gap-2">
            <PreviewBar className={`h-1 w-5 shrink-0 ${faint}`} />
            <PreviewBar className={`h-1.5 ${strong} ${width}`} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
      {[true, false, true].map((hasImage, i) => (
        <div key={i} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
          <div className="flex-1">
            <PreviewBar className={`h-1.5 w-4/5 ${strong}`} />
            <PreviewBar className={`mt-1 h-1 w-full ${faint}`} />
            <PreviewBar className={`mt-0.5 h-1 w-2/3 ${faint}`} />
          </div>
          {hasImage && <PreviewBar className={`h-6 w-6 shrink-0 ${image}`} />}
        </div>
      ))}
    </div>
  );
};

interface LayoutPickerProps {
  name: string;
  legend: string;
  hint: string;
  value: PostLayout;
  onChange: (layout: PostLayout) => void;
}

const LayoutPicker: React.FC<LayoutPickerProps> = ({ name, legend, hint, value, onChange }) => (
  <fieldset>
    <legend className={labelClass}>{legend}</legend>
    <p className={`mb-3 mt-1 ${hintClass}`}>{hint}</p>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {LAYOUT_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={`cursor-pointer rounded-xl border bg-white p-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-violet-500 has-focus-visible:ring-offset-2 dark:bg-zinc-900 dark:has-focus-visible:ring-offset-zinc-900 ${
              selected
                ? 'border-violet-500 ring-1 ring-violet-500'
                : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <div className="h-20 overflow-hidden rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-800" aria-hidden="true">
              <LayoutPreview layout={option.value} />
            </div>
            <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">{option.label}</p>
            <p className={`mt-0.5 leading-snug ${hintClass}`}>{option.description}</p>
          </label>
        );
      })}
    </div>
  </fieldset>
);

type AssetType = 'logo' | 'favicon';

export const BrandingSettings: React.FC = () => {
  useDocumentTitle('Appearance settings');
  const { activeBlog } = useBlog();
  const blogId = activeBlog?.id;
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  const form = useSettingsForm<BrandingSettingsData>({
    queryKey: ['brandingSettings', blogId],
    empty: defaultBrandingSettings,
    enabled: !!blogId,
    load: async () => {
      const data = (await api.get(`/blogs/${blogId}/settings/branding`)).data ?? {};
      return {
        ...defaultBrandingSettings,
        ...data,
        logo_url: data.logo_url || activeBlog?.logo_url || '',
        favicon_url: data.favicon_url || activeBlog?.favicon_url || '',
      };
    },
    validate: (values) =>
      COLOR_FIELDS.some(({ key }) => colorError(values[key])) ? 'Fix the highlighted colours before saving.' : null,
    save: (values) =>
      api.post(`/blogs/${blogId}/settings/branding`, {
        ...values,
        logo_url: values.logo_url || null,
        favicon_url: values.favicon_url || null,
      }),
    invalidate: [['allSettings']],
    successMessage: 'Appearance saved',
    errorMessage: "Couldn't save appearance settings",
  });

  const { values, update } = form;
  usePreviewFonts([values.font_heading, values.font_body]);

  const upload = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: AssetType }) => {
      const body = new FormData();
      body.append('file', file);
      const res = await api.post(`/blogs/${blogId}/settings/branding/upload-${type}`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { type, url: res.data.url as string };
    },
    // Uploading only stores the file; it's used once the page is saved.
    onSuccess: ({ type, url }) => {
      update(type === 'logo' ? 'logo_url' : 'favicon_url', url);
      toast.success(type === 'logo' ? 'Logo uploaded — save to publish it' : 'Favicon uploaded — save to publish it');
    },
    onError: (error) => toastApiError(error, "Couldn't upload the image"),
  });

  const uploading = upload.isPending ? upload.variables?.type : null;
  const handleFile = (file: File | undefined, type: AssetType) => {
    if (file) upload.mutate({ file, type });
  };

  const primaryColor = getSafeHexColor(values.primary_color, defaultBrandingSettings.primary_color);
  const primaryContrast = contrastWithWhite(primaryColor);

  return (
    <SettingsForm form={form} loadErrorTitle="Couldn't load appearance settings" skeletonCards={5}>
      <SettingsCard title="Logo" icon={Image} description="Shown in your blog's navigation bar. Without one, your blog name is shown.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingLogo(true);
            }}
            onDragLeave={() => setIsDraggingLogo(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingLogo(false);
              handleFile(e.dataTransfer.files[0], 'logo');
            }}
            disabled={uploading === 'logo'}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors hover:border-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              isDraggingLogo
                ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                : 'border-zinc-300 dark:border-zinc-700'
            }`}
          >
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              {uploading === 'logo' ? (
                <Loader2 size={26} className="animate-spin text-violet-500" aria-hidden="true" />
              ) : (
                <Upload size={26} className="text-zinc-400" aria-hidden="true" />
              )}
            </span>
            <span className="font-semibold text-zinc-900 dark:text-white">
              {uploading === 'logo' ? 'Uploading…' : values.logo_url ? 'Replace logo' : 'Upload logo'}
            </span>
            <span className={`mt-1 ${hintClass}`}>Drop an image here or click. PNG, JPEG, WebP or SVG, about 200×60 pixels.</span>
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0], 'logo');
              e.target.value = '';
            }}
          />

          <div>
            <p className={`mb-2 ${labelClass}`}>In your navigation bar</p>
            <div className="flex min-h-33 items-center justify-center rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700">
              {values.logo_url ? (
                <img src={values.logo_url} alt="Logo preview" className="max-h-14 object-contain" />
              ) : (
                <span className="text-xl font-bold tracking-tight text-[#18181b]" style={{ fontFamily: values.font_heading }}>
                  {activeBlog?.name}
                </span>
              )}
            </div>
            {values.logo_url && (
              <button
                type="button"
                onClick={() => update('logo_url', '')}
                className="mt-3 rounded-lg px-2 py-1 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Remove logo
              </button>
            )}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Favicon" icon={Image} description="The small icon in browser tabs and bookmarks.">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 bg-white dark:border-zinc-700">
            {values.favicon_url ? (
              <img src={values.favicon_url} alt="Favicon preview" className="h-8 w-8 object-contain" />
            ) : (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-white"
                style={{ backgroundColor: primaryColor }}
                aria-label="Default favicon: your blog's first letter"
              >
                {activeBlog?.name?.charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => faviconInputRef.current?.click()}
            disabled={uploading === 'favicon'}
            className={secondaryButtonClass}
          >
            {uploading === 'favicon' ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}
            {values.favicon_url ? 'Replace favicon' : 'Upload favicon'}
          </button>
          {values.favicon_url && (
            <button
              type="button"
              onClick={() => update('favicon_url', '')}
              className="rounded-lg px-2 py-1 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Remove
            </button>
          )}
        </div>
        <p className={hintClass}>A square image, 512×512 pixels, or an .ico file. Without one, your blog's first letter is used.</p>
        <input
          ref={faviconInputRef}
          type="file"
          accept=".ico,.png,.jpg,.jpeg,.webp,.svg"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0], 'favicon');
            e.target.value = '';
          }}
        />
      </SettingsCard>

      <SettingsCard title="Colors" icon={Palette}>
        <div className="grid gap-6 md:grid-cols-3">
          {COLOR_FIELDS.map(({ key, label, hint }) => (
            <Field key={key} label={label} hint={hint} error={colorError(values[key])}>
              {(control) => (
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    type="color"
                    value={getSafeHexColor(values[key], defaultBrandingSettings[key])}
                    onChange={(e) => update(key, e.target.value.toUpperCase())}
                    aria-label={`${label} colour picker`}
                    className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <input
                    {...control}
                    type="text"
                    spellCheck={false}
                    value={values[key]}
                    onChange={(e) => update(key, e.target.value.trim())}
                    className={`${inputClass} min-w-0 font-mono uppercase`}
                  />
                </div>
              )}
            </Field>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            Button
          </span>
          <span className="text-sm font-semibold underline underline-offset-2" style={{ color: primaryColor }}>
            A link in your post
          </span>
        </div>
        {primaryContrast < MIN_CONTRAST && (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Hard to read: this primary colour has a contrast of {primaryContrast.toFixed(1)}:1 with white. Aim for at least{' '}
              {MIN_CONTRAST}:1 — try a darker shade.
            </span>
          </p>
        )}
      </SettingsCard>

      {/* The previews show the blog's light theme, so their text colours are
          fixed rather than following the studio's dark mode. */}
      <SettingsCard title="Fonts" icon={Type}>
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Headings" hint="Post titles and section headings.">
            {(control) => (
              <select {...control} value={values.font_heading} onChange={(e) => update('font_heading', e.target.value)} className={inputClass}>
                {!HEADING_FONTS.includes(values.font_heading) && <option value={values.font_heading}>{values.font_heading}</option>}
                {HEADING_FONTS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Body text" hint="Paragraphs and everything else.">
            {(control) => (
              <select {...control} value={values.font_body} onChange={(e) => update('font_body', e.target.value)} className={inputClass}>
                {!BODY_FONTS.includes(values.font_body) && <option value={values.font_body}>{values.font_body}</option>}
                {BODY_FONTS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700" aria-label="Font preview">
          <p className="mb-2 text-3xl font-black text-[#18181b]" style={{ fontFamily: `"${values.font_heading}", sans-serif` }}>
            The quiet craft of writing
          </p>
          <p className="text-base leading-relaxed text-[#52525b]" style={{ fontFamily: `"${values.font_body}", sans-serif` }}>
            Good writing reads easily. Pick a heading font with character and a body font that stays comfortable over a
            long post.
          </p>
        </div>
      </SettingsCard>

      <SettingsCard title="Post layout" icon={LayoutList} description="How lists of posts appear on your blog. Article pages aren't affected.">
        <LayoutPicker
          name="home_layout"
          legend="Home page"
          hint="The posts below the large lead post at the top."
          value={values.home_layout}
          onChange={(layout) => update('home_layout', layout)}
        />
        <LayoutPicker
          name="archive_layout"
          legend="Blog page"
          hint="The full list of posts, including tag pages. List and Compact group posts by year."
          value={values.archive_layout}
          onChange={(layout) => update('archive_layout', layout)}
        />
      </SettingsCard>
    </SettingsForm>
  );
};
