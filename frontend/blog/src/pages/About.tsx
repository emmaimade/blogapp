import React from 'react';
import { Mail, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/blogApi';

export const About: React.FC = () => {
  const location = useLocation();

  // Fetch posts for real stats
  const { data: posts } = useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const res = await api.get('/posts/');
      return res.data;
    }
  });

  // Fetch site settings (for customizable About page content)
  const { data: settings } = useQuery({
    queryKey: ['siteSettings'],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/about');
        return res.data;
      } catch (error) {
        // Return defaults if not configured yet
        return {
          enabled: false,
          bio_title: "Welcome to My Blog",
          bio_subtitle: "Sharing ideas, stories, and insights",
          bio_content: "This is a modern blog built with React and FastAPI. Customize this content in your admin panel under Settings > About Page.",
          show_stats: true,
          show_contact_cta: true,
          email: "hello@example.com",
          social_links: {
            github: "",
            twitter: "",
            linkedin: ""
          }
        };
      }
    }
  });

  let previewDraft = null;

  try {
    const params = new URLSearchParams(location.search);
    const draftParam = params.get('draft');

    if (draftParam) {
      previewDraft = JSON.parse(draftParam);
    }
  } catch (error) {
    previewDraft = null;
  }

  // Real, dynamic stats
  const stats = {
    articles: posts?.length || 0,
    views: posts?.reduce((sum: number, post: any) => sum + (post.views || 0), 0) || 0,
    projects: posts?.filter((p: any) => p.is_project).length || 0
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Use settings data or defaults
  const effectiveSettings = previewDraft || settings || {};

  const {
    bio_title,
    bio_subtitle,
    bio_content,
    show_stats,
    show_contact_cta,
    email,
    social_links
  } = effectiveSettings;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-20 md:py-32">
          <div className="text-center">
            {previewDraft && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-full mb-4 border border-amber-200 text-sm font-bold">
                Previewing unsaved changes
              </div>
            )}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full mb-6 border border-indigo-100">
              <Sparkles className="text-indigo-600" size={16} />
              <span className="text-sm font-bold text-indigo-600">About</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black text-slate-900 mb-6 leading-tight">
              {bio_title || "Welcome to My Blog"}
            </h1>
            
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              {bio_subtitle || "Sharing ideas, stories, and insights"}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        
        {/* Stats - Only show if enabled */}
        {show_stats !== false && (
          <div className="grid grid-cols-3 gap-6 mb-20">
            <div className="text-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-4xl font-black text-indigo-600 mb-2">
                {stats.articles}
              </div>
              <div className="text-sm text-slate-600 font-medium">Articles Published</div>
            </div>
            <div className="text-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-4xl font-black text-purple-600 mb-2">
                {formatNumber(stats.views)}
              </div>
              <div className="text-sm text-slate-600 font-medium">Total Readers</div>
            </div>
            <div className="text-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-4xl font-black text-pink-600 mb-2">
                {stats.projects}
              </div>
              <div className="text-sm text-slate-600 font-medium">Projects</div>
            </div>
          </div>
        )}

        {/* Bio Content */}
        <div className="mb-20">
          <div className="prose prose-lg max-w-none">
            <div 
              className="text-slate-600 leading-relaxed text-lg whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ 
                __html: bio_content || "This is a modern blog built with React and FastAPI. Customize this content in your admin panel under Settings > About Page." 
              }}
            />
          </div>
        </div>

        {/* CTA - Only show if enabled */}
        {show_contact_cta !== false && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-12 text-center text-white">
            <h2 className="text-3xl font-black mb-4">Let's Connect</h2>
            <p className="text-indigo-100 mb-8 max-w-xl mx-auto text-lg">
              Interested in collaborating or just want to say hi? I'd love to hear from you.
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center mb-8">
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-2 bg-white text-indigo-600 px-8 py-4 rounded-xl font-bold hover:bg-indigo-50 transition-all shadow-lg text-lg"
                >
                  <Mail size={20} />
                  Get in Touch
                </a>
              )}
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-8 py-4 rounded-xl font-bold hover:bg-white/30 transition-all text-lg"
              >
                Send Message
              </Link>
            </div>

            {/* Social Links - Only show if configured */}
            {social_links && (social_links.github || social_links.twitter || social_links.linkedin) && (
              <div className="flex gap-4 justify-center">
                {social_links.github && (
                  <a 
                    href={social_links.github} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </a>
                )}
                {social_links.twitter && (
                  <a 
                    href={social_links.twitter} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                  </a>
                )}
                {social_links.linkedin && (
                  <a 
                    href={social_links.linkedin} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
