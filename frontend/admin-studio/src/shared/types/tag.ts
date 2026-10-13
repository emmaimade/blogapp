export interface Tag {
  id: number;
  name: string;
}

/** A tag with how many posts use it, drafts included (studio only). */
export interface TagUsage extends Tag {
  post_count: number;
}
