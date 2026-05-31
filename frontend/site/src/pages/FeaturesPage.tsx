  import { Building2, Users, FileText, ShieldCheck, Lock, BarChart3, Code, Globe, Settings, Bell, ArrowRight } from 'lucide-react';
  import { Link } from 'react-router-dom';

  const mainFeatures = [
    {
      icon: Building2,
      title: 'Multi-tenant Workspaces',
      description: 'Run isolated blogs with separate branding, team members, and settings from one SaaS platform.',
      details: [
        'Complete data isolation between workspaces',
        'Independent branding and theme customization',
        'Separate user management and permissions',
        'Isolated analytics and reporting',
      ],
      image: '/modern-professional-illustration-of-a-digital-agen.jpeg',
      use_case: 'Perfect for agencies managing multiple client blogs',
    },
    {
      icon: Users,
      title: 'Role-based Collaboration',
      description: 'Owners, editors, and authors work with clear permissions and tenant-scoped workflows.',
      details: [
        'Owner: Full workspace control',
        'Editor: Content & settings management',
        'Author: Create & edit posts',
      ],
      image: '/modern-professional-illustration-for-role-based-co.jpeg',
      use_case: 'Scale your team without compromising security',
    },
    {
      icon: FileText,
      title: 'Publishing Control',
      description: 'Manage posts, tags, comments, and workspace dashboards without crossing tenant boundaries.',
      details: [
        'Rich-text editor with markdown support',
        'Scheduled publishing',
        'SEO optimization tools',
        'Comment moderation & management',
      ],
      image: '/modern-professional-illustration-of-a-content-creator-working-on-a-blog-post.jpeg',
      use_case: 'Complete control over your publishing workflow',
    },
    {
      icon: ShieldCheck,
      title: 'Platform-grade Admin',
      description: 'Give super admins platform visibility while keeping everyday users focused on their own workspace.',
      details: [
        'Platform-wide analytics dashboard',
        'User and workspace management',
        'Billing and subscription control',
        'System health and monitoring',
      ],
      image: '/modern-professional-illustration-of-a-cybersecurity-expert-monitoring-a-network.jpeg',
      use_case: 'Enterprise-grade admin capabilities',
    },
  ];

  const advancedFeatures = [
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Track performance metrics, reader engagement, and growth trends across all your blogs.',
    },
    {
      icon: Code,
      title: 'REST API',
      description: 'Build custom integrations and automate your publishing workflow with our full-featured API.',
    },
    {
      icon: Lock,
      title: 'Enterprise Security',
      description: 'End-to-end encryption, data isolation, and compliance with industry standards.',
    },
    {
      icon: Globe,
      title: 'Custom Domains',
      description: 'Point custom domains to your workspaces for a completely branded experience.',
    },
    {
      icon: Settings,
      title: 'SSO/SAML',
      description: 'Enterprise single sign-on for seamless user management and access control.',
    },
    {
      icon: Bell,
      title: 'Notifications',
      description: 'Real-time alerts for comments, team mentions, and important workspace events.',
    },
  ];

  const useCases = [
    {
      title: 'Agencies & Studios',
      description: 'Manage multiple client blogs from one platform with white-label customization.',
      image: '🏢',
      features: ['Unlimited workspaces', 'Client branding', 'Team collaboration', 'Client analytics'],
    },
    {
      title: 'Content Teams',
      description: 'Streamline editorial workflows with role-based permissions and content approval.',
      image: '✍️',
      features: ['Content calendar', 'Approval workflows', 'Team roles', 'Comment management'],
    },
    {
      title: 'SaaS Companies',
      description: 'Run a multi-tenant blog platform serving your customers with isolated workspaces.',
      image: '💼',
      features: ['White-label solution', 'API access', 'Custom domains', 'Advanced security'],
    },
    {
      title: 'Creators & Publishers',
      description: 'Launch and grow your blog with professional tools and beautiful design.',
      image: '⭐',
      features: ['Easy setup', 'SEO tools', 'Analytics', 'Custom themes'],
    },
  ];

  export const FeaturesPage = () => {
    return (
      <div className="space-y-0">
        {/* Hero Section */}
        <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <div className="absolute inset-0 bg-zinc-50">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_top_right,_rgba(124,58,237,0.18),_transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_bottom_left,_rgba(124,58,237,0.12),_transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_center,_rgba(139,92,246,0.06),_transparent)]" />
          </div>

          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-accent-border mb-8">
              <span className="text-sm font-semibold text-accent-text">
                Powerful features
              </span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl font-black text-zinc-900 mb-6 leading-[1.1]">
              Everything you need to{' '}
              <span className="bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
                publish at scale
              </span>
            </h1>
            
            <p className="text-xl text-zinc-600 mb-8 max-w-2xl mx-auto">
              Built-in features designed for teams. From solo creators to enterprise organizations.
            </p>
          </div>
        </section>

        {/* Main Features Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="space-y-12">
              {mainFeatures.map((feature, index) => {
                const IconComponent = feature.icon;
                const isEven = index % 2 === 0;
                
                return (
                  <div key={feature.title} className={`grid md:grid-cols-2 gap-12 items-center ${!isEven ? 'md:grid-cols-2 md:direction-rtl' : ''}`}>
                    <div>
                      <div className="flex items-center gap-4 mb-6">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
                          <IconComponent className="text-primary" size={32} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-zinc-900">{feature.title}</h3>
                        </div>
                      </div>
                      
                      <p className="text-lg text-zinc-600 mb-6 leading-relaxed">
                        {feature.description}
                      </p>
                      
                      <ul className="space-y-3 mb-8">
                        {feature.details.map((detail) => (
                          <li key={detail} className="flex items-start gap-3">
                            <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                              <div className="h-2 w-2 rounded-full bg-primary" />
                            </div>
                            <span className="text-zinc-700">{detail}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-50 border border-zinc-200">
                        <span className="text-xs font-semibold text-zinc-950 uppercase tracking-wider">Use case</span>
                        <span className="text-sm text-zinc-900">{feature.use_case}</span>
                      </div>
                    </div>
                    
                    <div className="bg-accent/40 rounded-2xl ">
                      <div className="flex items-center justify-center h-64">
                        <img src={feature.image} alt={feature.title} className="w-full h-full object-cover rounded-xl"/>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Advanced Features Grid */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-zinc-900 mb-4">Advanced capabilities</h2>
              <p className="text-xl text-zinc-600">Everything you need for professional publishing</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {advancedFeatures.map((feature) => {
                const IconComponent = feature.icon;
                return (
                  <div 
                    key={feature.title}
                    className="group bg-white rounded-2xl p-8 border-2 border-zinc-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-zinc-100 group-hover:bg-accent flex items-center justify-center mb-4 transition-colors">
                      <IconComponent className="text-zinc-700 group-hover:text-primary transition-colors" size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 mb-2">{feature.title}</h3>
                    <p className="text-zinc-600 leading-relaxed">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-zinc-900 mb-4">Built for every team</h2>
              <p className="text-xl text-zinc-600">See how INKO works for different use cases</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {useCases.map((useCase) => (
                <div
                  key={useCase.title}
                  className="rounded-2xl p-8 bg-zinc-50 border-2 border-zinc-200 hover:border-zinc-300 hover:shadow-lg transition-all"
                >
                  <div className="text-5xl mb-4">{useCase.image}</div>
                  <h3 className="text-2xl font-bold text-zinc-900 mb-2">{useCase.title}</h3>
                  <p className="text-zinc-600 text-lg mb-6">{useCase.description}</p>
                  
                  <div className="space-y-2 mb-6 pt-6 border-t border-zinc-200">
                    {useCase.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <span className="text-zinc-700 text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Link
                    to="/signup"
                    className="text-primary hover:text-primary-hover font-semibold text-sm flex items-center gap-2"
                  >
                    Learn more
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Integration Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-50">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-zinc-900 mb-6">Integrations & APIs</h2>
            <p className="text-xl text-zinc-600 mb-8">
              Connect INKO with your favorite tools. Build custom integrations with our REST API.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
              {['Zapier', 'Slack', 'Webhooks', 'Custom API', 'Google Analytics', 'Stripe', 'Auth0', 'More...'].map((integration) => (
                <div key={integration} className="bg-white rounded-lg p-4 border border-zinc-200">
                  <div className="text-sm font-semibold text-zinc-700">{integration}</div>
                </div>
              ))}
            </div>

            <a 
              href="#"
              className="text-primary hover:text-primary-hover font-semibold inline-flex items-center gap-2"
            >
              Explore integrations
              <ArrowRight size={16} />
            </a>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-zinc-900 mb-6">Ready to get started?</h2>
            <p className="text-xl text-zinc-600 mb-8">
              All features included in every plan. 14-day free trial.
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-zinc-900/10 hover:shadow-xl hover:shadow-zinc-900/20 transition-all"
            >
              Start free trial
              <ArrowRight size={20} />
            </Link>
          </div>
        </section>
      </div>
    );
  };
