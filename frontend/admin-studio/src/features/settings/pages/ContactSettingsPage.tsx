import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, HelpCircle, Mail, Plus, Share2, Trash2 } from 'lucide-react';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { useWorkspacePath } from '../../../app/providers/useWorkspacePath';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsForm } from '../components/SettingsForm';
import { Field, SwitchRow, hintClass, inputClass, secondaryButtonClass } from '../components/SettingsFields';
import { useSettingsForm } from '../hooks/useSettingsForm';

interface FAQItem {
  /** Only in the form, so a moved question keeps its inputs and focus. Not saved. */
  id: number;
  question: string;
  answer: string;
}

interface ContactSettingsData {
  contact_email: string;
  location: string;
  response_time: string;
  phone: string;
  show_social_links: boolean;
  show_faq: boolean;
  /** Edited under Social profiles; sent back as received. */
  social_links: Record<string, string | null>;
  faqs: FAQItem[];
}

// Loaded questions are numbered by position, so a refetch gives the same ids
// and doesn't read as an unsaved change; added ones count on from far above.
let lastAddedFaqId = 1_000_000;
const newFaq = (): FAQItem => ({ id: ++lastAddedFaqId, question: '', answer: '' });

const isBlank = (faq: FAQItem) => !faq.question.trim() && !faq.answer.trim();

// A blank question is just left out on save; a half-written one needs finishing,
// and the empty half is the one flagged.
const faqErrors = (faq: FAQItem) => ({
  question: !isBlank(faq) && !faq.question.trim() ? 'Add the question, or remove this one.' : null,
  answer: !isBlank(faq) && !faq.answer.trim() ? 'Add an answer, or remove this one.' : null,
});
const isIncomplete = (faq: FAQItem) => {
  const errors = faqErrors(faq);
  return !!(errors.question || errors.answer);
};

const iconButtonClass =
  'rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 disabled:pointer-events-none disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';

export const ContactSettings = () => {
  useDocumentTitle('Contact settings');
  const { activeBlog } = useBlog();
  const toWorkspace = useWorkspacePath();
  const blogId = activeBlog?.id;

  const form = useSettingsForm<ContactSettingsData>({
    queryKey: ['settings', 'contact', blogId],
    empty: {
      contact_email: '',
      location: '',
      response_time: '',
      phone: '',
      show_social_links: true,
      show_faq: true,
      social_links: {},
      faqs: [],
    },
    enabled: !!blogId,
    load: async () => {
      const data = (await api.get(`/blogs/${blogId}/settings/contact`)).data ?? {};
      return {
        // The API returns null for unset fields; inputs need strings.
        contact_email: data.contact_email ?? '',
        location: data.location ?? '',
        response_time: data.response_time ?? '',
        phone: data.phone ?? '',
        show_social_links: data.show_social_links ?? true,
        show_faq: data.show_faq ?? true,
        social_links: data.social_links ?? {},
        faqs: (data.faqs ?? []).map((faq: { question: string; answer: string }, index: number) => ({
          id: index + 1,
          question: faq.question,
          answer: faq.answer,
        })),
      };
    },
    validate: (values) =>
      values.show_faq && values.faqs.some(isIncomplete) ? 'Finish or remove the incomplete FAQ before saving.' : null,
    save: (values) =>
      api.post(`/blogs/${blogId}/settings/contact`, {
        ...values,
        // Blank means "not set" — the backend validates any other value as an address.
        contact_email: values.contact_email.trim() || null,
        phone: values.phone.trim() || null,
        faqs: values.faqs
          .filter((faq) => !isBlank(faq))
          .map(({ question, answer }) => ({ question: question.trim(), answer: answer.trim() })),
      }),
    successMessage: 'Contact page saved',
    errorMessage: "Couldn't save the Contact page",
  });

  const { values, update, setValues } = form;

  // Puts the cursor in a newly added question, and keeps focus on a moved item's button.
  const faqListRef = useRef<HTMLOListElement>(null);
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    const target = faqListRef.current?.querySelector<HTMLButtonElement | HTMLInputElement>(pendingFocus.current);
    // A question moved to the top or bottom has that move button disabled;
    // keep focus on the same question's other one.
    const fallback = target?.closest('li')?.querySelector<HTMLButtonElement>('[data-faq-move]:not(:disabled)');
    (target && !target.disabled ? target : fallback)?.focus();
    pendingFocus.current = null;
  });

  const setFaqs = (next: (faqs: FAQItem[]) => FAQItem[]) => setValues((current) => ({ ...current, faqs: next(current.faqs) }));

  const addFaq = () => {
    const faq = newFaq();
    pendingFocus.current = `[data-faq-question="${faq.id}"]`;
    setFaqs((faqs) => [...faqs, faq]);
  };

  const updateFaq = (id: number, field: 'question' | 'answer', value: string) =>
    setFaqs((faqs) => faqs.map((faq) => (faq.id === id ? { ...faq, [field]: value } : faq)));

  const moveFaq = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    pendingFocus.current = `[data-faq-move="${values.faqs[index].id}:${direction}"]`;
    setFaqs((faqs) => {
      const next = [...faqs];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeFaq = (id: number) => setFaqs((faqs) => faqs.filter((faq) => faq.id !== id));

  return (
    <SettingsForm form={form} loadErrorTitle="Couldn't load contact settings" skeletonCards={3}>
      <SettingsCard
        title="Contact details"
        icon={Mail}
        description="Shown on your Contact page. Leave any of them blank to hide it."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Email" hint="Messages from the contact form go to your account email if this is blank.">
            {(control) => (
              <input
                {...control}
                type="email"
                autoCapitalize="none"
                spellCheck={false}
                value={values.contact_email}
                onChange={(e) => update('contact_email', e.target.value)}
                placeholder="you@yourdomain.com"
                className={inputClass}
              />
            )}
          </Field>
          <Field label="Phone">
            {(control) => (
              <input
                {...control}
                type="tel"
                value={values.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="+234 800 000 0000"
                className={inputClass}
              />
            )}
          </Field>
          <Field label="Location" hint="A city, a region, or “Remote”.">
            {(control) => (
              <input
                {...control}
                type="text"
                value={values.location}
                onChange={(e) => update('location', e.target.value)}
                placeholder="Lagos, Nigeria"
                className={inputClass}
              />
            )}
          </Field>
          <Field label="Response time" hint="How soon you usually reply.">
            {(control) => (
              <input
                {...control}
                type="text"
                value={values.response_time}
                onChange={(e) => update('response_time', e.target.value)}
                placeholder="Usually within 1–2 days"
                className={inputClass}
              />
            )}
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard title="Social links" icon={Share2}>
        <SwitchRow
          label="Show social links"
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
      </SettingsCard>

      <SettingsCard
        title="FAQ"
        icon={HelpCircle}
        description="Answer common questions before readers have to ask."
        toggle={{ checked: values.show_faq, onChange: (checked) => update('show_faq', checked), label: 'Show' }}
      >
        {values.show_faq && (
          <>
            {values.faqs.length === 0 ? (
              <p className={hintClass}>No questions yet. Readers won't see this section until you add one.</p>
            ) : (
              <ol ref={faqListRef} className="space-y-4">
                {values.faqs.map((faq, index) => {
                  const errors = faqErrors(faq);
                  return (
                    <li key={faq.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700 sm:p-5">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          Question {index + 1}
                        </p>
                        <div className="flex items-center">
                          <button
                            type="button"
                            data-faq-move={`${faq.id}:-1`}
                            onClick={() => moveFaq(index, -1)}
                            disabled={index === 0}
                            aria-label={`Move question ${index + 1} up`}
                            className={iconButtonClass}
                          >
                            <ArrowUp size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            data-faq-move={`${faq.id}:1`}
                            onClick={() => moveFaq(index, 1)}
                            disabled={index === values.faqs.length - 1}
                            aria-label={`Move question ${index + 1} down`}
                            className={iconButtonClass}
                          >
                            <ArrowDown size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFaq(faq.id)}
                            aria-label={`Remove question ${index + 1}`}
                            className={`${iconButtonClass} hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400`}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Field label="Question" error={errors.question}>
                          {(control) => (
                            <input
                              {...control}
                              data-faq-question={faq.id}
                              type="text"
                              value={faq.question}
                              onChange={(e) => updateFaq(faq.id, 'question', e.target.value)}
                              placeholder="e.g. Are you open to freelance work?"
                              className={inputClass}
                            />
                          )}
                        </Field>
                        <Field label="Answer" error={errors.answer}>
                          {(control) => (
                            <textarea
                              {...control}
                              value={faq.answer}
                              onChange={(e) => updateFaq(faq.id, 'answer', e.target.value)}
                              rows={3}
                              className={`${inputClass} resize-y`}
                            />
                          )}
                        </Field>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <button type="button" onClick={addFaq} className={secondaryButtonClass}>
              <Plus size={16} aria-hidden="true" /> Add question
            </button>
          </>
        )}
      </SettingsCard>
    </SettingsForm>
  );
};
