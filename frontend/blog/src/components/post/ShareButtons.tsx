import React from 'react';
import { Facebook, Link2, Linkedin } from 'lucide-react';
import toast from 'react-hot-toast';
import { XIcon } from '../XIcon';

const buttonClassName =
  'p-2 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-all text-zinc-700 hover:text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 dark:hover:text-zinc-50';

export const ShareButtons: React.FC<{ title: string }> = ({ title }) => {
  const shareUrl = window.location.href;
  const shareLinks = [
    {
      key: 'twitter',
      label: 'Share on X',
      icon: XIcon,
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`,
    },
    {
      key: 'linkedin',
      label: 'Share on LinkedIn',
      icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      key: 'facebook',
      label: 'Share on Facebook',
      icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
  ];

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Could not copy link');
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Share</span>
      <div className="flex items-center gap-2">
        {shareLinks.map(({ key, label, icon: Icon, href }) => (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={buttonClassName}>
            <Icon size={16} />
          </a>
        ))}
        <button onClick={copyShareLink} aria-label="Copy link" className={buttonClassName}>
          <Link2 size={16} />
        </button>
      </div>
    </div>
  );
};
