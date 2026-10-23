import { useQuery } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import api from '../../../shared/api/client';

interface PostFollowerEmail {
  status: 'none' | 'pending' | 'sending' | 'sent' | 'skipped';
  notify_followers: boolean;
  sent: number;
  recipients: number;
  sending_enabled: boolean;
}

const plural = (count: number, word: string) => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

/** "Emailed to 43 followers", "Sending… 120 of 500", "Not emailed" — the post's new-post email. */
export const FollowerEmailStatus = ({ blogId, postId }: { blogId: number; postId: number }) => {
  const { data } = useQuery<PostFollowerEmail>({
    queryKey: ['postFollowerEmail', blogId, postId],
    queryFn: async () => (await api.get(`/blogs/${blogId}/posts/${postId}/follower-email`)).data,
    // While it's going out, keep the count moving.
    refetchInterval: (query) => (['pending', 'sending'].includes(query.state.data?.status ?? '') ? 30_000 : false),
  });

  if (!data || data.status === 'none') return null;

  const label = {
    sent: `Emailed to ${plural(data.sent, 'follower')}`,
    sending: `Emailing followers… ${data.sent.toLocaleString()} of ${data.recipients.toLocaleString()}`,
    pending: data.sending_enabled
      ? `Emailing ${plural(data.recipients, 'follower')} shortly`
      : 'Queued for followers · email sending isn’t switched on yet',
    skipped: 'Not emailed to followers',
  }[data.status];

  return (
    <div className="flex items-center gap-1.5">
      <Mail size={14} />
      <span>{label}</span>
    </div>
  );
};
