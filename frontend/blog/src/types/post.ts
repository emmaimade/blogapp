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
  /** When the post went live — kept across edits and republishing. */
  published_at?: string | null;
  /** Last content revision made after the post went live, if any. */
  edited_at?: string | null;
  views?: number;
  is_project?: boolean;
  is_featured?: boolean;
  is_sample?: boolean;
  status?: 'published' | 'scheduled' | 'draft';
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

export interface CommentReply {
  id: number;
  content: string;
  post_id: number;
  parent_id: number | null;
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
  created_at: string;
  /** Set when the author edited the comment. */
  edited_at?: string | null;
  is_deleted: boolean;
  /** Who removed it — the API already swaps `content` for a placeholder. */
  deleted_by?: 'author' | 'moderator' | 'platform' | null;
}

export interface Comment extends CommentReply {
  replies: CommentReply[];
}

export interface CommentThreadPage {
  items: Comment[];
  /** Top-level comments — what pagination walks. */
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
  /** Every non-deleted comment, replies included — what the heading shows. */
  comment_count: number;
}

export interface PostDetail extends Post {
  comment_count?: number;
}
