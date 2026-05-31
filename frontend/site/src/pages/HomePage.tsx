import { ArrowRight, Building2, FileText, ShieldCheck, Users, Star, TrendingUp, Shield, Play } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: Building2,
    title: 'Multi-tenant Workspaces',
    description: 'Run isolated blogs with separate branding, team members, and settings from one SaaS platform.',
  },
  {
    icon: Users,
    title: 'Role-based Collaboration',
    description: 'Owners, editors, and authors work with clear permissions and tenant-scoped workflows.',
  },
  {
    icon: FileText,
    title: 'Publishing Control',
    description: 'Manage posts, tags, comments, and workspace dashboards without crossing tenant boundaries.',
  },
  {
    icon: ShieldCheck,
    title: 'Platform-grade Admin',
    description: 'Give super admins platform visibility while keeping everyday users focused on their own workspace.',
  },
];



const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Founder, Creative Studio',
    content: 'INKO transformed how we manage multiple client blogs. The multi-tenant setup is exactly what we needed.',
    avatar: '👩‍💼',
  },
  {
    name: 'Marcus Johnson',
    role: 'CTO, Media Group',
    content: 'The role-based permissions and workspace isolation gave us the control we were looking for. Highly impressed.',
    avatar: '👨‍💼',
  },
  {
    name: 'Elena Rodriguez',
    role: 'Content Manager, Publishing Co',
    content: 'Setup was seamless and the dashboard is intuitive. Our team was productive on day one.',
    avatar: '👩‍🦱',
  },
];



export const HomePage = () => {
  return (
    <div className="space-y-0">
      {/* ✅ Hero Section - Industry Standard with Gradient Background */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Hero Background */}
        <div className="absolute inset-0 bg-zinc-50">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_top_right,_rgba(124,58,237,0.18),_transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_bottom_left,_rgba(124,58,237,0.12),_transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_center,_rgba(139,92,246,0.06),_transparent)]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-accent-border mb-8">
            <span className="text-sm font-semibold text-accent-text">
              Multi-tenant blog CMS platform
            </span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-zinc-900 mb-6 leading-[1.1]">
            Launch branded blogs{' '}
            <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
              at scale
            </span>
          </h1>
          
          <p className="text-xl text-zinc-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            INKO is the multi-tenant blog platform built for agencies, creators, and SaaS companies. Create, manage, and scale multiple branded workspaces with role-based teams.
          </p>
          
          {/* ✅ Industry-standard CTA buttons with proper gradient */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link 
              to="/signup" 
              className="group flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/10 hover:bg-primary-hover hover:shadow-xl hover:shadow-primary/20 transition-all"
            >
              Start free trial
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <a 
              href="#demo" 
              className="flex items-center justify-center gap-2 px-8 py-4 border-2 border-zinc-200 bg-white text-zinc-900 font-bold rounded-xl hover:border-zinc-300 hover:bg-zinc-50 transition-all"
            >
              <Play size={20} />
              Watch demo
            </a>
          </div>

          {/* ✅ Trust badges with proper icons */}
          <div className="flex flex-wrap justify-center gap-8 text-sm text-zinc-600">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              <span>10K+ posts published</span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-primary" />
              <span>500+ active teams</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-primary" />
              <span>99.9% uptime SLA</span>
            </div>
          </div>
        </div>
      </section>

      {/* ✅ Features Section - With proper ID for anchor navigation */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-zinc-900 mb-4">Everything you need to publish</h2>
            <p className="text-xl text-zinc-600">Built-in features that scale with your operation</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => {
              const IconComponent = feature.icon;
              return (
                <div 
                  key={feature.title} 
                  className="group bg-white rounded-2xl p-8 border-2 border-zinc-200 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 group-hover:bg-accent flex items-center justify-center mb-4 group-hover:scale-110 transition-all">
                    <IconComponent className="text-zinc-700 group-hover:text-primary transition-colors" size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 mb-2">{feature.title}</h3>
                  <p className="text-zinc-600 text-sm leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing teaser — links to dedicated /pricing page */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-zinc-50 border-y border-zinc-200">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-zinc-900 font-bold text-lg">Simple, transparent pricing</p>
            <p className="text-zinc-500 text-sm mt-1">Plans from <span className="text-primary font-semibold">$29/month</span> · 14-day free trial · No credit card required</p>
          </div>
          <Link
            to="/pricing"
            className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 border-2 border-primary text-primary font-bold rounded-xl hover:bg-primary hover:text-white transition-all"
          >
            See all plans <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ✅ Testimonials Section - With proper ID */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 bg-white scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-zinc-900 mb-4">Loved by teams worldwide</h2>
            <p className="text-xl text-zinc-600">See how teams use INKO to scale their publishing</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <div key={testimonial.name} className="bg-white rounded-2xl p-8 border-2 border-zinc-200 hover:border-zinc-300 hover:shadow-xl transition-all">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-zinc-700 mb-6 leading-relaxed">"{testimonial.content}"</p>
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{testimonial.avatar}</div>
                  <div>
                    <p className="font-bold text-zinc-900">{testimonial.name}</p>
                    <p className="text-sm text-zinc-600">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo/Video Section */}
      <section id="demo" className="py-20 px-4 sm:px-6 lg:px-8 bg-white scroll-mt-16">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-zinc-900 mb-4">See INKO in action</h2>
          <p className="text-xl text-zinc-600 mb-8">Watch how easy it is to create and manage your blogs</p>
          
          {/* Placeholder for video/demo */}
          <div className="aspect-video bg-zinc-100 rounded-2xl border-2 border-zinc-200 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform cursor-pointer">
                <Play size={32} className="text-primary" />
              </div>
              <p className="text-zinc-600 font-semibold">Demo video coming soon</p>
              <p className="text-sm text-zinc-500 mt-2">In the meantime, start your free trial</p>
            </div>
          </div>
        </div>
      </section>

      {/* ✅ Final CTA Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-zinc-900 overflow-hidden">
        {/* Purple glow matching footer */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_center,_rgba(124,58,237,0.20),_transparent)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <div className="relative z-10 max-w-3xl mx-auto text-center text-white">
          <h2 className="text-4xl font-bold mb-4">Ready to launch your blogs?</h2>
          <p className="text-xl mb-8 text-white/80">Join hundreds of teams using INKO to scale their publishing.</p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-all shadow-xl shadow-primary/20"
          >
            Start free trial <ArrowRight size={20} />
          </Link>
          <p className="mt-6 text-white/50 text-sm">✓ No credit card required  ✓ 14-day free trial  ✓ Cancel anytime</p>
        </div>
      </section>
    </div>
  );
};
