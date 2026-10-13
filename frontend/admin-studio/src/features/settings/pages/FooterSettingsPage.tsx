import React from 'react';
import { Link } from 'react-router-dom';
import { PanelBottom, SlidersHorizontal } from 'lucide-react';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useWorkspacePath } from '../../../app/providers/useWorkspacePath';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { usePlanAccess } from '../../billing/hooks/usePlanAccess';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsForm } from '../components/SettingsForm';
import { Field, PaidFeatureBadge, SwitchRow, inputClass } from '../components/SettingsFields';
import { useSettingsForm } from '../hooks/useSettingsForm';

interface FooterSettingsData {
  footer_text: string;
  show_social_links: boolean;
  copyright_text: string;
  show_categories: boolean;
  // Anything else the API sends (social links, show_quick_links, the unused
  // newsletter fields) is sent back unchanged, since the endpoint replaces the
  // whole object.
  [other: string]: unknown;
}

export const FooterSettings: React.FC = () => {
  useDocumentTitle('Footer settings');
  const { activeBlog } = useBlog();
  const toWorkspace = useWorkspacePath();
  const { isPaid } = usePlanAccess();
  const blogId = activeBlog?.id;

  const form = useSettingsForm<FooterSettingsData>({
    queryKey: ['footerSettings', blogId],
    empty: {
      footer_text: '',
      show_social_links: true,
      copyright_text: '',
      show_categories: true,
    },
    enabled: !!blogId,
    load: async () => {
      const data = (await api.get(`/blogs/${blogId}/settings/footer`)).data ?? {};
      return {
        ...data,
        footer_text: data.footer_text ?? '',
        show_social_links: data.show_social_links ?? true,
        copyright_text: data.copyright_text ?? '',
        show_categories: data.show_categories ?? true,
      };
    },
    save: (values) => api.post(`/blogs/${blogId}/settings/footer`, values),
    successMessage: 'Footer saved',
    errorMessage: "Couldn't save the footer",
  });

  const { values, update } = form;

  return (
    <SettingsForm form={form} loadErrorTitle="Couldn't load footer settings" skeletonCards={3}>
      <SettingsCard title="Footer text" icon={PanelBottom} description="The text at the bottom of every page.">
        <Field label="Tagline" hint="A line under your blog name. Leave blank to hide it.">
          {(control) => (
            <input
              {...control}
              type="text"
              value={values.footer_text}
              onChange={(e) => update('footer_text', e.target.value)}
              placeholder={activeBlog?.tagline || 'Thoughts and ideas from my blog.'}
              className={inputClass}
            />
          )}
        </Field>
        <Field
          label="Copyright"
          aside={!isPaid && <PaidFeatureBadge />}
          hint={
            isPaid
              ? 'Write {year} for the current year. Remove "Powered by INKO" to drop the Inko credit.'
              : 'On the Free plan, your footer credits Inko. Upgrade to write your own.'
          }
        >
          {(control) => (
            <input
              {...control}
              type="text"
              value={values.copyright_text}
              onChange={(e) => update('copyright_text', e.target.value)}
              placeholder={`© {year} ${activeBlog?.name ?? 'My blog'}`}
              disabled={!isPaid}
              className={inputClass}
            />
          )}
        </Field>
      </SettingsCard>

      <SettingsCard title="Sections" icon={SlidersHorizontal} description="What else your footer shows.">
        <SwitchRow
          label="Social links"
          description={
            <>
              Your links from{' '}
              <Link to={toWorkspace('/settings/social')} className="font-semibold text-violet-600 hover:underline dark:text-violet-400">
                Social profiles
              </Link>
              .
            </>
          }
          checked={values.show_social_links}
          onChange={(checked) => update('show_social_links', checked)}
        />
        <SwitchRow
          label="Popular topics"
          description="Your most-used tags. Hidden until a published post has a tag."
          checked={values.show_categories}
          onChange={(checked) => update('show_categories', checked)}
        />
      </SettingsCard>

    </SettingsForm>
  );
};
