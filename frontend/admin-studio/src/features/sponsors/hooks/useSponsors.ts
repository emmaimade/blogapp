import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../../shared/api/client';
import { useBlog } from '../../../app/providers/BlogProvider';
import { toastApiError } from '../../../shared/lib/apiErrors';

export type SponsorPlacement = 'post_end' | 'home';
export type SponsorState = 'running' | 'scheduled' | 'ended' | 'paused';

export interface SponsorInput {
  name: string;
  logo_url: string | null;
  tagline: string;
  url: string;
  placement: SponsorPlacement;
  starts_on: string | null; // YYYY-MM-DD
  ends_on: string | null;
  is_active: boolean;
}

export interface Sponsor extends SponsorInput {
  id: number;
  created_at: string;
  state: SponsorState;
  impressions: number;
  clicks: number;
}

export interface AdvertisePackage {
  name: string;
  price: string;
  description: string;
}

export interface AdvertiseSettings {
  enabled: boolean;
  intro: string;
  packages: AdvertisePackage[];
  show_followers: boolean;
  show_sources: boolean;
  show_top_posts: boolean;
  contact_email: string | null;
}

export const useSponsors = () => {
  const { activeMembership } = useBlog();
  const blogId = activeMembership?.blog_id;
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['sponsors', blogId] });

  const list = useQuery<Sponsor[]>({
    queryKey: ['sponsors', blogId],
    queryFn: async () => (await api.get(`/blogs/${blogId}/sponsors`)).data,
    enabled: !!blogId,
  });

  const save = useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: SponsorInput }) =>
      id
        ? (await api.put(`/blogs/${blogId}/sponsors/${id}`, data)).data
        : (await api.post(`/blogs/${blogId}/sponsors`, data)).data,
    onSuccess: (_res, { id }) => {
      refresh();
      toast.success(id ? 'Sponsor updated.' : 'Sponsor added.');
    },
    onError: (error) => toastApiError(error, "Couldn't save the sponsor."),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/blogs/${blogId}/sponsors/${id}`),
    onSuccess: () => {
      refresh();
      toast.success('Sponsor removed.');
    },
    onError: (error) => toastApiError(error, "Couldn't remove the sponsor."),
  });

  const uploadLogo = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post(`/blogs/${blogId}/sponsors/upload-logo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url;
  };

  return { list, save, remove, uploadLogo };
};

export const useAdvertiseSettings = () => {
  const { activeMembership } = useBlog();
  const blogId = activeMembership?.blog_id;
  const queryClient = useQueryClient();

  const settings = useQuery<AdvertiseSettings>({
    queryKey: ['advertiseSettings', blogId],
    queryFn: async () => (await api.get(`/blogs/${blogId}/advertise/settings`)).data,
    enabled: !!blogId,
  });

  const save = useMutation({
    mutationFn: async (data: AdvertiseSettings) => (await api.put(`/blogs/${blogId}/advertise/settings`, data)).data,
    onSuccess: (saved) => {
      queryClient.setQueryData(['advertiseSettings', blogId], saved);
      toast.success('Advertise page saved.');
    },
    onError: (error) => toastApiError(error, "Couldn't save the Advertise page."),
  });

  return { settings, save };
};
