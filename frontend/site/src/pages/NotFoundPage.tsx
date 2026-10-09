import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../shared/hooks/usePageMeta';

export const NotFoundPage = () => {
  usePageMeta('Page not found');

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-28 text-center">
      <p className="text-sm font-bold uppercase tracking-wider text-primary mb-4">404</p>
      <h1 className="font-display text-5xl sm:text-6xl text-zinc-900 mb-4">We couldn't find that page</h1>
      <p className="text-lg text-zinc-600 mb-10 max-w-xl mx-auto">
        The link may be broken, or the page may have moved.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-all"
        >
          Back to home <ArrowRight size={18} />
        </Link>
        <Link
          to="/contact"
          className="inline-flex items-center justify-center px-6 py-3 border-2 border-zinc-200 bg-white text-zinc-900 font-bold rounded-xl hover:border-zinc-300 transition-all"
        >
          Contact us
        </Link>
      </div>
    </section>
  );
};
