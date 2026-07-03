import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, CheckCircle2, Copy, ExternalLink, Zap, Lock } from 'lucide-react';

interface SiteCardProps {
  subdomain: string;
  customDomain?: string | null;
  plan?: string;
  canManageSettings: boolean;
}

export const SiteCard = ({ subdomain, customDomain, plan, canManageSettings }: SiteCardProps) => {
  const [copied, setCopied] = useState(false);
  const isPro = plan === 'pro' || plan === 'team';
  const BLOG_BASE_URL = import.meta.env.VITE_BLOG_URL || 'http://localhost:5174';
  
  const liveUrl = customDomain
    ? `https://${customDomain}`
    : import.meta.env.DEV
      ? `${BLOG_BASE_URL}`
      : `https://${subdomain}.inko.blog`;
      
  const displayUrl = customDomain ?? (import.meta.env.DEV ? BLOG_BASE_URL.replace(/^https?:\/\//, '') : `${subdomain}.inko.blog`);

  const handleCopy = () => {
    navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="admin-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-violet-500" />
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Your blog</h3>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold text-green-700 dark:text-green-400">Live</span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-3">
          <span className="flex-1 text-sm font-mono font-semibold text-zinc-900 dark:text-white truncate">
            {displayUrl}
          </span>
          <button onClick={handleCopy} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            {copied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
          <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400">
            <ExternalLink size={14} />
          </a>
        </div>

        {!customDomain && (
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${isPro ? 'border-violet-200 bg-violet-50 dark:border-violet-800/50 dark:bg-violet-950/30' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50'}`}>
            {isPro ? <Zap size={14} className="text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" /> : <Lock size={14} className="text-zinc-400 flex-shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{isPro ? 'Connect a custom domain' : 'Custom domain on Pro plan'}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{isPro ? 'Replace your .inko.blog address with your own domain.' : 'Upgrade to use your own domain like blog.yoursite.com.'}</p>
            </div>
            {canManageSettings && (
              <Link to="/admin/settings/general" className="flex-shrink-0 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline whitespace-nowrap">
                {isPro ? 'Set up →' : 'Upgrade →'}
              </Link>
            )}
          </div>
        )}

        {customDomain && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <CheckCircle2 size={13} className="text-green-500" /> Custom domain active
            {canManageSettings && <Link to="/admin/settings/general" className="ml-auto text-violet-600 dark:text-violet-400 font-semibold hover:underline">Manage →</Link>}
          </div>
        )}
      </div>
    </div>
  );
};