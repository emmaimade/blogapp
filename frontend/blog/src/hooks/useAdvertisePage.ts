import { useQuery } from '@tanstack/react-query';
import api from '../api/blogApi';
import { getErrorStatus } from '../api/errors';
import { useTenant } from '../contexts/TenantContext';

export interface AdvertisePackage {
  name: string;
  price: string;
  description: string;
}

export interface AdvertisePageData {
  blog_name: string;
  intro: string;
  packages: AdvertisePackage[];
  monthly_readers: number;
  monthly_views: number;
  /** null when the owner hides it */
  followers: number | null;
  sources: { source: string; share: number }[] | null;
  top_posts: { title: string; slug: string; views: number }[] | null;
  /** "Your brand here" in empty sponsor slots */
  show_house_ads: boolean;
  /** An "Advertise" link in the top menu too */
  show_in_menu: boolean;
}

/**
 * The blog's "Advertise with us" page. The API answers 404 while the owner
 * has it switched off, which here means "no page": the footer hides its link.
 */
export const useAdvertisePage = () => {
  const { blog } = useTenant();
  const query = useQuery<AdvertisePageData | null>({
    queryKey: ['advertisePage', blog?.id],
    queryFn: async () => {
      try {
        return (await api.get(`/blogs/${blog!.id}/advertise`)).data;
      } catch (err) {
        if (getErrorStatus(err) === 404) return null;
        throw err;
      }
    },
    enabled: !!blog?.id,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  return { page: query.data ?? null, isLoading: query.isLoading };
};
