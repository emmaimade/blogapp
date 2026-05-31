import type { Tag } from './tag';

export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  is_project: boolean;
  published: boolean;
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
