import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { toastApiError } from '../../../shared/lib/apiErrors';

export interface RecommendedBlog {
  id: number;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  url: string;
}

export interface StudioRecommendation extends RecommendedBlog {
  followers_sent: number;
  /** false: no longer qualifies (suspended, opted out...), so readers don't see it */
  shown: boolean;
}

export interface RecommendationsOverview {
  recommendations: StudioRecommendation[];
  received: { id: number; name: string; url: string; followers: number; recommends_you_now: boolean }[];
  allow_recommendations: boolean;
}

export const MAX_RECOMMENDATIONS = 5;

export const useRecommendations = () => {
  const { activeMembership } = useBlog();
  const blogId = activeMembership?.blog_id;
  const queryClient = useQueryClient();
  const key = ['recommendations', blogId];

  const overview = useQuery<RecommendationsOverview>({
    queryKey: key,
    queryFn: async () => (await api.get(`/blogs/${blogId}/recommendations/manage`)).data,
    enabled: !!blogId,
  });

  const setList = useMutation({
    mutationFn: async (blogIds: number[]) =>
      (await api.put(`/blogs/${blogId}/recommendations`, { blog_ids: blogIds })).data as RecommendationsOverview,
    onSuccess: (data) => queryClient.setQueryData(key, data),
    onError: (error) => toastApiError(error, "Couldn't update your recommendations."),
  });

  const setAllowed = useMutation({
    mutationFn: async (allow: boolean) =>
      api.patch(`/blogs/${blogId}/recommendations/settings`, { allow_recommendations: allow }),
    onSuccess: (_res, allow) => {
      queryClient.invalidateQueries({ queryKey: key });
      toast.success(allow ? 'Other blogs can recommend yours.' : "Other blogs can't recommend yours now.");
    },
    onError: (error) => toastApiError(error, "Couldn't change that setting."),
  });

  const search = async (q: string): Promise<RecommendedBlog[]> =>
    (await api.get(`/blogs/${blogId}/recommendations/search`, { params: { q } })).data;

  return { overview, setList, setAllowed, search };
};
