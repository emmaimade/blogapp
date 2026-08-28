export interface PostAuthor {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}

export interface PostTag {
  id?: number;
  name: string;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  thumbnail_url?: string;
  created_at: string;
  views?: number;
  is_project?: boolean;
  is_sample?: boolean;
  author?: PostAuthor | null;
  tags: PostTag[];
}

export interface PaginatedPosts {
  items: Post[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}
