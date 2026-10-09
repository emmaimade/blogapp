import { Link } from 'react-router-dom';
import { usePageMeta } from '../shared/hooks/usePageMeta';
import type { LegalDocument } from './legalDocuments';

// Once the copy in legalDocuments.ts is final, set LAST_UPDATED and turn IS_DRAFT off.
const IS_DRAFT = true;
const LAST_UPDATED = '—';

const contactLine = (
  <>
    Questions about this page? <Link to="/contact" className="font-semibold text-primary hover:text-primary-hover">Contact us</Link>.
  </>
);

export const LegalPage = ({ document }: { document: LegalDocument }) => {
  usePageMeta(document.title, document.description);

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {IS_DRAFT && (
        <div role="note" className="mb-10 rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Draft.</strong> This page is being prepared and is not yet our final {document.title.toLowerCase()}.
        </div>
      )}

      <h1 className="font-display text-5xl sm:text-6xl text-zinc-900 mb-3">{document.title}</h1>
      <p className="text-sm text-zinc-500 mb-10">Last updated: {LAST_UPDATED}</p>

      <p className="text-lg text-zinc-700 leading-relaxed mb-12">{document.intro}</p>

      <div className="space-y-10">
        {document.sections.map((section, index) => (
          <section key={section.heading}>
            <h2 className="text-xl font-bold text-zinc-900 mb-3">
              {index + 1}. {section.heading}
            </h2>
            <p className="text-zinc-600 leading-relaxed">{section.body}</p>
          </section>
        ))}
      </div>

      <p className="mt-16 pt-8 border-t border-zinc-200 text-zinc-600">{contactLine}</p>
    </article>
  );
};
