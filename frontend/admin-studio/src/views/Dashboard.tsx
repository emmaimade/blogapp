import { useQuery } from '@tanstack/react-query';
import { BarChart3, Users, MessageSquare, FileText } from 'lucide-react';
import api from '../api/client';

interface Stats {
  posts: number;
  users: number;
  comments: number;
  tags?: number;
}

const fetchStats = async (): Promise<Stats> => {
  const { data } = await api.get('/admin/stats');
  return data;
};

export const Dashboard = () => {
  const { data, isLoading, error } = useQuery({ 
    queryKey: ['adminStats'], 
    queryFn: fetchStats,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-medium mb-2">Failed to Load Statistics</h3>
        <p className="text-red-600 text-sm">
          {error instanceof Error ? error.message : 'An error occurred while fetching data'}
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back!</h2>
        <p className="text-gray-600">Here's what's happening with your blog today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Posts" 
          value={data?.posts || 0}
          icon={<FileText size={24} />}
          color="bg-blue-500"
          bgColor="bg-blue-50"
        />
        <StatCard 
          title="Total Users" 
          value={data?.users || 0}
          icon={<Users size={24} />}
          color="bg-green-500"
          bgColor="bg-green-50"
        />
        <StatCard 
          title="Comments" 
          value={data?.comments || 0}
          icon={<MessageSquare size={24} />}
          color="bg-purple-500"
          bgColor="bg-purple-50"
        />
        {data?.tags !== undefined && (
          <StatCard 
            title="Tags" 
            value={data.tags}
            icon={<BarChart3 size={24} />}
            color="bg-orange-500"
            bgColor="bg-orange-50"
          />
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickActionCard 
            title="Create Post"
            description="Write a new blog post"
            href="/admin/posts/new"
            color="bg-indigo-600"
          />
          <QuickActionCard 
            title="Manage Tags"
            description="Organize your content"
            href="/admin/tags"
            color="bg-purple-600"
          />
          <QuickActionCard 
            title="View Comments"
            description="Moderate discussions"
            href="/admin/comments"
            color="bg-green-600"
          />
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const StatCard = ({ title, value, icon, color, bgColor }: StatCardProps) => (
  <div className={`${bgColor} p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow`}>
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-gray-600 font-medium text-sm">{title}</h3>
      <div className={`${color} text-white p-2 rounded-lg`}>
        {icon}
      </div>
    </div>
    <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
  </div>
);

interface QuickActionCardProps {
  title: string;
  description: string;
  href: string;
  color: string;
}

const QuickActionCard = ({ title, description, href, color }: QuickActionCardProps) => (
  <a 
    href={href}
    className={`${color} text-white p-6 rounded-lg hover:opacity-90 transition-opacity block`}
  >
    <h4 className="font-semibold text-lg mb-2">{title}</h4>
    <p className="text-sm opacity-90">{description}</p>
  </a>
);