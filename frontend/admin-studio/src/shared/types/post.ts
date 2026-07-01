import type { Tag } from './tag';

export type PostStatus = 'draft' | 'scheduled' | 'published';

export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  blog_id: number;
  is_project: boolean;
  published: boolean;          // kept for backward compat — prefer `status`
  status: PostStatus;          // draft | scheduled | published
  published_at: string | null; // ISO datetime — set when scheduled or published
  thumbnail_url?: string | null;
  views: number;
  created_at: string;
  updated_at: string;
  author?: {
    id?: number;
    username?: string;
    full_name?: string;
    email?: string;
  } | null;
  tags: Tag[];
}