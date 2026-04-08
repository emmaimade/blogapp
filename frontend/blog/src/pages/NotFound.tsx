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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 px-6">
      <div className="max-w-2xl w-full text-center">
        
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-4">
            404
          </div>
          <div className="text-6xl mb-6">🤔</div>
        </div>

        {/* Message */}
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
          Page Not Found
        </h1>
        <p className="text-xl text-slate-600 mb-8">
          Oops! The page you're looking for seems to have wandered off.
          Don't worry, even the best developers get lost sometimes.
        </p>

        {/* Search Box */}
        <div className="mb-12">
          <div className="relative max-w-md mx-auto">
            <input
              type="text"
              placeholder="Search for posts..."
              className="w-full px-6 py-4 pr-12 rounded-full border-2 border-slate-200 focus:border-indigo-500 outline-none transition-all"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white p-3 rounded-full hover:bg-indigo-700 transition-all">
              <Search size={20} />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            to="/"
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-full font-bold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Home size={20} />
            Go Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 bg-slate-100 text-slate-900 px-8 py-4 rounded-full font-bold hover:bg-slate-200 transition-all"
          >
            <ArrowLeft size={20} />
            Go Back
          </button>
        </div>

        {/* Popular Links */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            🔗 Popular Pages
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {popularLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="flex items-center gap-3 p-4 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all group"
              >
                <link.icon size={20} className="group-hover:scale-110 transition-transform" />
                <span className="font-medium">{link.title}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Fun Message */}
        <div className="mt-12 text-sm text-slate-500">
          <p>Error Code: 404 | Page Status: Lost in the void 🌌</p>
          <p className="mt-2">
            If you think this is a mistake, please{' '}
            <Link to="/contact" className="text-indigo-600 hover:underline font-medium">
              let me know
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};