import type { ComponentType } from 'react';
import { Facebook, Github, Globe, Instagram, Linkedin, Youtube, type LucideProps } from 'lucide-react';
import { XIcon } from '../components/XIcon';

type SocialIcon = ComponentType<LucideProps>;

// One table for every place the blog renders the owner's social links
// (footer, about, contact). Unknown platforms fall back to a neutral globe
// rather than borrowing another brand's logo.
const SOCIAL_PLATFORMS: Record<string, { label: string; icon: SocialIcon }> = {
  github: { label: 'GitHub', icon: Github },
  twitter: { label: 'X (Twitter)', icon: XIcon },
  x: { label: 'X (Twitter)', icon: XIcon },
  linkedin: { label: 'LinkedIn', icon: Linkedin },
  instagram: { label: 'Instagram', icon: Instagram },
  youtube: { label: 'YouTube', icon: Youtube },
  facebook: { label: 'Facebook', icon: Facebook },
};

export interface SocialLink {
  key: string;
  url: string;
  label: string;
  icon: SocialIcon;
}

export const getSocialPlatform = (platform: string) =>
  SOCIAL_PLATFORMS[platform.toLowerCase()] ?? {
    label: platform.charAt(0).toUpperCase() + platform.slice(1),
    icon: Globe,
  };

/**
 * Settings can hold every platform key with an empty value (unconfigured) —
 * only links with an actual URL are returned.
 */
export const getActiveSocialLinks = (
  links: Record<string, string | null | undefined> | null | undefined,
): SocialLink[] =>
  Object.entries(links ?? {})
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, url]) => ({ key, url, ...getSocialPlatform(key) }));
