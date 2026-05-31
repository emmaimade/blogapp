import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clock, ArrowLeft, Sparkles } from 'lucide-react';

const featureNames: Record<string, string> = {
  '/admin/blogs': 'Blogs Management',
  '/admin/users': 'User Management',
  '/admin/platform-users': 'User Management',
  '/admin/subscriptions': 'Subscriptions & Billing',
  '/admin/analytics': 'Advanced Analytics',
  '/admin/moderation': 'Content Moderation',
  '/admin/platform-settings': 'Platform Settings',
  // Add more as needed
};

export const ComingSoon: React.FC = () => {
  const location = useLocation();
  const featureName = featureNames[location.pathname] || 'This Feature';

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-zinc-100 dark:from-purple-950 dark:to-zinc-900">
        <Sparkles className="h-12 w-12 text-purple-600 dark:text-purple-400" />
      </div>

      <h1 className="mb-3 text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
        {featureName}
      </h1>
      
      <p className="mb-8 max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        We're working hard to bring this feature to you.<br />
        Expected soon â€” stay tuned!
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          to={location.pathname.includes('superadmin') ? '/admin/superadmin' : '/admin/dashboard'}
          className="back-to-dashboard-btn flex items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 dark:bg-white dark:hover:bg-zinc-100 transition"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>

        <button
          onClick={() => window.location.reload()} // or show feedback modal
          className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-300 px-8 py-3.5 text-sm font-semibold hover:border-purple-300 hover:bg-purple-50 dark:border-zinc-700 dark:hover:border-purple-500 dark:hover:bg-zinc-800 transition"
        >
          <Clock size={18} />
          Remind Me Later
        </button>
      </div>

      <p className="mt-12 text-xs text-zinc-500 dark:text-zinc-400">
        Have feedback or want early access? Reach out to us.
      </p>
    </div>
  );
};
