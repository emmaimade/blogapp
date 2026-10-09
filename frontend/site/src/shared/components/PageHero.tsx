import type { ReactNode } from 'react';

interface PageHeroProps {
  title: ReactNode;
  /** Trailing words of the title, set in italic and the brand gradient. */
  highlight: string;
  description: ReactNode;
  size?: 'default' | 'large';
  children?: ReactNode;
  /** Wide visual (e.g. a product shot) shown under the text column. */
  media?: ReactNode;
}

export const PageHero = ({ title, highlight, description, size = 'default', children, media }: PageHeroProps) => (
  <section className="relative pt-20 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
    <div className="absolute inset-0 bg-zinc-50" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_top_right,_rgba(124,58,237,0.18),_transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_bottom_left,_rgba(124,58,237,0.12),_transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_center,_rgba(139,92,246,0.06),_transparent)]" />
    </div>

    <div className="relative z-10 max-w-3xl mx-auto text-center">
      <h1
        className={`font-display text-zinc-900 mb-6 leading-[1.05] ${
          size === 'large' ? 'text-6xl sm:text-7xl lg:text-8xl' : 'text-5xl sm:text-6xl lg:text-7xl'
        }`}
      >
        {title}{' '}
        {/* pr keeps the italic's overhang inside the clipped gradient */}
        <span className="text-gradient italic pr-[0.08em]">{highlight}</span>
      </h1>

      <p className="text-xl text-zinc-600 mb-8 max-w-2xl mx-auto leading-relaxed">{description}</p>

      {children}
    </div>

    {media && <div className="relative z-10 max-w-6xl mx-auto mt-16">{media}</div>}
  </section>
);
