import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PrimaryCtaProps {
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  secondaryText?: string;
  secondaryButtonText?: string;
  secondaryButtonLink?: string;
  variant?: 'default' | 'dark' | 'light';
  className?: string;
}

export const PrimaryCta = ({
  title,
  description,
  ctaText,
  ctaLink,
  secondaryText,
  secondaryButtonText,
  secondaryButtonLink,
  variant = 'default',
  className = '',
}: PrimaryCtaProps) => {
  const isDark = variant === 'dark';
  const isLight = variant === 'light';
  const hasBgOverride = className ? className.split(/\s+/).some((c) => c.startsWith('bg-') || c.startsWith('!bg-')) : false;

  return (
    <section className={`py-20 px-4 sm:px-6 lg:px-8 ${isDark ? 'bg-zinc-900' : hasBgOverride ? '' : 'bg-zinc-50'} overflow-hidden ${className}`.trim()}>
      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <h2 className={`text-4xl font-bold mb-4 ${isDark ? 'text-white' : isLight ? 'text-zinc-900' : 'text-zinc-900'}`}>{title}</h2>
        <p className={`text-xl mb-8 ${isDark ? 'text-white/80' : isLight ? 'text-zinc-600' : 'text-zinc-600'}`}>{description}</p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to={ctaLink}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/20 transition-all"
          >
            {ctaText}
            <ArrowRight size={20} />
          </Link>

          {secondaryButtonText && secondaryButtonLink && (
            <Link
              to={secondaryButtonLink}
              className={`inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold transition-all ${
                isDark
                  ? 'border-2 border-white/20 text-white hover:border-white/40 hover:bg-white/5'
                  : 'border-2 border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              {secondaryButtonText}
            </Link>
          )}
        </div>

        {secondaryText && (
          <p className={`mt-6 text-sm ${isDark ? 'text-white/50' : 'text-zinc-500'}`}>{secondaryText}</p>
        )}
      </div>
    </section>
  );
};
