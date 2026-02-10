export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  is_project: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}