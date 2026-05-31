import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Search, ArrowLeft, TrendingUp } from 'lucide-react';

export const NotFound: React.FC = () => {
  const popularLinks = [
    { title: 'Home', path: '/', icon: Home },
    { title: 'About Me', path: '/about', icon: TrendingUp },
    { title: 'All Posts', path: '/', icon: Search },
    { title: 'Projects', path: '/projects', icon: TrendingUp }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-zinc-50 to-zinc-50 px-6">
      <div className="max-w-2xl w-full text-center">
        
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="text-9xl font-black text-transparent bg-clip-text bg-zinc-900 mb-4">
            404
          </div>
          <div className="text-6xl mb-6">🤔</div>
        </div>

        {/* Message */}
        <h1 className="text-4xl md:text-5xl font-black text-zinc-900 mb-4">
          Page Not Found
        </h1>
        <p className="text-xl text-zinc-600 mb-8">
          Oops! The page you're looking for seems to have wandered off.
          Don't worry, even the best developers get lost sometimes.
        </p>

        {/* Search Box */}
        <div className="mb-12">
          <div className="relative max-w-md mx-auto">
            <input
              type="text"
              placeholder="Search for posts..."
              className="w-full px-6 py-4 pr-12 rounded-full border-2 border-zinc-200 focus:border-primary outline-none transition-all"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-white p-3 rounded-full hover:bg-purple-700 transition-all">
              <Search size={20} />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            to="/"
            className="flex items-center justify-center gap-2 bg-primary text-white px-8 py-4 rounded-full font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-900/10"
          >
            <Home size={20} />
            Go Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 bg-zinc-100 text-zinc-900 px-8 py-4 rounded-full font-bold hover:bg-zinc-200 transition-all"
          >
            <ArrowLeft size={20} />
            Go Back
          </button>
        </div>

        {/* Popular Links */}
        <div className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-xl">
          <h2 className="text-xl font-bold text-zinc-900 mb-6">
            🔗 Popular Pages
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {popularLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="flex items-center gap-3 p-4 bg-zinc-50 hover:bg-zinc-50 hover:text-primary rounded-xl transition-all group"
              >
                <link.icon size={20} className="group-hover:scale-110 transition-transform" />
                <span className="font-medium">{link.title}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Fun Message */}
        <div className="mt-12 text-sm text-zinc-500">
          <p>Error Code: 404 | Page Status: Lost in the void 🌌</p>
          <p className="mt-2">
            If you think this is a mistake, please{' '}
            <Link to="/contact" className="text-zinc-900 hover:underline font-medium">
              let me know
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
