import React from 'react';
import { AtSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useWorkspacePath } from '../../../app/providers/useWorkspacePath';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsForm } from '../components/SettingsForm';
import { Field, inputClass } from '../components/SettingsFields';
import { useSettingsForm } from '../hooks/useSettingsForm';

const NETWORKS = [
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/username' },
  { key: 'twitter', label: 'X (Twitter)', placeholder: 'https://x.com/username' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/username' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@channel' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/page' },
] as const;

type Network = (typeof NETWORKS)[number]['key'];
type SocialProfiles = Record<Network, string>;

// The blog only shows http(s) links, so anything else would quietly disappear.
const linkError = (value: string) => {
  if (!value.trim()) return null;
  try {
    if (['http:', 'https:'].includes(new URL(value.trim()).protocol)) return null;
  } catch {
    // Falls through to the message.
  }
  return 'Enter the full link, starting with https://';
};

export const SocialSettings: React.FC = () => {
  useDocumentTitle('Social profiles');
  const { activeBlog } = useBlog();
  const toWorkspace = useWorkspacePath();
  const blogId = activeBlog?.id;

  const form = useSettingsForm<SocialProfiles>({
    queryKey: ['socialProfiles', blogId],
    empty: Object.fromEntries(NETWORKS.map(({ key }) => [key, ''])) as SocialProfiles,
    enabled: !!blogId,
    load: async () => {
      const data = (await api.get(`/blogs/${blogId}/settings/social`)).data ?? {};
      return Object.fromEntries(NETWORKS.map(({ key }) => [key, data[key] ?? ''])) as SocialProfiles;
    },
    validate: (values) =>
      NETWORKS.some(({ key }) => linkError(values[key])) ? 'Fix the highlighted links before saving.' : null,
    save: (values) =>
      api.post(
        `/blogs/${blogId}/settings/social`,
        Object.fromEntries(NETWORKS.map(({ key }) => [key, values[key].trim() || null])),
      ),
    // About, Contact and the footer all show these links.
    invalidate: [['aboutSettings'], ['footerSettings'], ['settings', 'contact']],
    successMessage: 'Social profiles saved',
    errorMessage: "Couldn't save social profiles",
  });

  const pageLink = (path: string, label: string) => (
    <Link to={toWorkspace(path)} className="font-semibold text-violet-600 hover:underline dark:text-violet-400">
      {label}
    </Link>
  );

  return (
    <SettingsForm form={form} loadErrorTitle="Couldn't load social profiles" skeletonCards={1}>
      <SettingsCard
        title="Social profiles"
        icon={AtSign}
        description={
          <>
            Shown on your {pageLink('/settings/about', 'About')} and {pageLink('/settings/contact', 'Contact')} pages and
            in your {pageLink('/settings/footer', 'footer')} — each can hide them. Leave a field blank to leave it out.
          </>
        }
      >
        <div className="grid gap-6 md:grid-cols-2">
          {NETWORKS.map(({ key, label, placeholder }) => (
            <Field key={key} label={label} error={linkError(form.values[key])}>
              {(control) => (
                <input
                  {...control}
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={form.values[key]}
                  onChange={(e) => form.update(key, e.target.value)}
                  placeholder={placeholder}
                  className={inputClass}
                />
              )}
            </Field>
          ))}
        </div>
      </SettingsCard>
    </SettingsForm>
  );
};
