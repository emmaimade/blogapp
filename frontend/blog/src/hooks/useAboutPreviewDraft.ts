import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Receives unsaved About-page settings from the admin studio's "Preview"
 * button over postMessage, never from the URL.
 *
 * The admin opens `/about?preview=1`; this page announces it's ready to its
 * opener, and accepts exactly one message shape, only from the admin
 * studio's origin and only from the window that opened it. A link someone
 * crafts can't supply a draft, so it just shows the saved About page.
 */

export const PREVIEW_READY = 'inko:about-preview-ready';
export const PREVIEW_DRAFT = 'inko:about-preview-draft';

const ADMIN_ORIGIN = (() => {
  try {
    return new URL(import.meta.env.VITE_ADMIN_STUDIO_URL || 'http://localhost:5173').origin;
  } catch {
    return null;
  }
})();

export interface AboutDraft {
  bio_title?: string;
  bio_subtitle?: string;
  bio_content?: string;
  show_stats?: boolean;
  show_contact_cta?: boolean;
  email?: string | null;
  social_links?: Record<string, string>;
}

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

/** Keeps only known fields of the expected types — never passes the raw message through. */
const toDraft = (raw: unknown): AboutDraft | null => {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const text = (key: string) => (typeof data[key] === 'string' ? (data[key] as string) : undefined);
  const flag = (key: string) => (typeof data[key] === 'boolean' ? (data[key] as boolean) : undefined);

  const socialLinks: Record<string, string> = {};
  if (data.social_links && typeof data.social_links === 'object') {
    for (const [network, url] of Object.entries(data.social_links as Record<string, unknown>)) {
      if (isHttpUrl(url)) socialLinks[network] = url;
    }
  }

  return {
    bio_title: text('bio_title'),
    bio_subtitle: text('bio_subtitle'),
    bio_content: text('bio_content'),
    show_stats: flag('show_stats'),
    show_contact_cta: flag('show_contact_cta'),
    email: text('email') ?? null,
    social_links: socialLinks,
  };
};

export const useAboutPreviewDraft = (): AboutDraft | null => {
  const location = useLocation();
  const [draft, setDraft] = useState<AboutDraft | null>(null);
  const wantsPreview = new URLSearchParams(location.search).get('preview') === '1';

  useEffect(() => {
    const opener = window.opener as Window | null;
    if (!wantsPreview || !opener || !ADMIN_ORIGIN) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== ADMIN_ORIGIN || event.source !== opener) return;
      if (event.data?.type !== PREVIEW_DRAFT) return;
      const next = toDraft(event.data.draft);
      if (next) setDraft(next);
    };

    window.addEventListener('message', handleMessage);
    // targetOrigin pins delivery: if the opener isn't the admin studio, the
    // browser drops this message instead of handing it to whoever opened us.
    opener.postMessage({ type: PREVIEW_READY }, ADMIN_ORIGIN);
    return () => window.removeEventListener('message', handleMessage);
  }, [wantsPreview]);

  return draft;
};
