/**
 * TierDetailStudio - Studio Tier Detail Page
 * 
 * Target: Agencies and teams scaling operations
 * Tone: Professional, efficient, ROI-focused
 * Focus: Team collaboration, unlimited content, Brand Hub
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Palette, Lock, Users, Headphones, Sparkles,
  Shield, Award, Clock, Zap, Check, TrendingUp, Building2,
  Layers, Video, Globe, Briefcase, Crown, Target, BarChart3, Loader
} from 'lucide-react';

import { initializePayment, initializeApplePayCheckout, isApplePayAvailable } from '../../services/paystackService';
import { UserTier } from '../../types';

import {
  HeroSection,
  SectionWrapper,
  FeatureGrid,
  TestimonialCard,
  WorkflowSteps,
  PersonaCards,
  CaseStudyAccordion,
  PricingBreakdown,
  FAQAccordion,
  TrustBadges,
  FinalCTA,
  BackToPricing,
  TierConfig,
  FeatureCard,
  Testimonial,
  PersonaCard,
  CaseStudy,
  FAQ
} from './TierDetailShared';
import { SavingsCounter } from './interactive/SavingsCounter';
import { ROICalculator } from './interactive/ROICalculator';
import { TierMatchQuiz } from './interactive/TierMatchQuiz';
import { DayInLifeTimeline } from './interactive/DayInLifeTimeline';
import { FeatureVideoStories } from './interactive/FeatureVideoStories';
import { FeatureExplorer } from './interactive/FeatureExplorer';
import { UsageHeatmap } from './interactive/UsageHeatmap';
import { PeerComparison } from './interactive/PeerComparison';
import { MigrationAssistant } from './interactive/MigrationAssistant';
import { CommitmentCalculator } from './interactive/CommitmentCalculator';


// ============================================================================
// TIER CONFIGURATION
// ============================================================================

const tierConfig: TierConfig = {
  name: 'Studio',
  tagline: 'Scale Your Operations',
  price: { monthly: 59.99, annual: 49.92 },
  gradient: 'from-violet-600 to-indigo-600',
  accentColor: 'violet',
  heroStat: { value: '5x', label: 'faster content production' },
  customerCount: '2,500+',
  bgClass: 'bg-indigo-50/30',
  blobColors: ['bg-violet-500/10', 'bg-indigo-500/10']
};

const PAYMENT_CONFIG = {
  paystackPaymentUrl: "https://paystack.shop/pay/akv70alb1x",
  planCode: "PLN_09zg1ly5kg57niz"
};

// ============================================================================
// CONTENT DATA
// ============================================================================

const trustLogos = [
  'Creative Agencies',
  'EdTech Companies',
  'Publishing Houses',
  'School Districts',
  'Content Studios'
];

const features: FeatureCard[] = [
  {
    icon: BookOpen,
    title: 'Unlimited Creation',
    description: 'No caps on your creativity',
    highlight: 'Unlimited Books',
    items: [
      'Unlimited ebooks per month',
      'Up to 500 pages per book',
      'Complex narrative structures',
      'Series and collection support'
    ]
  },
  {
    icon: Palette,
    title: 'Complete Style Library',
    description: 'Every style, every project',
    highlight: 'ALL 50+ Styles',
    items: [
      'Access to all 50+ illustration styles',
      'Premium exclusive styles',
      'Style mixing capabilities',
      'Early access to new releases'
    ]
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Work together seamlessly',
    highlight: '5 Team Seats',
    items: [
      '5 team member accounts',
      'Real-time collaboration',
      'Role-based permissions',
      'Shared asset library'
    ]
  },
  {
    icon: Building2,
    title: 'Brand Hub',
    description: 'Consistent brand identity',
    highlight: 'Enterprise Feature',
    items: [
      'Custom brand guidelines',
      'Saved style presets',
      'Branded export templates',
      'Logo and watermark placement'
    ]
  },
  {
    icon: Headphones,
    title: 'Premium Support',
    description: 'Expert help on demand',
    highlight: '4hr Response',
    items: [
      '4-hour priority response',
      'Dedicated success manager',
      'Private Slack channel',
      'Quarterly strategy calls'
    ]
  },
  {
    icon: Video,
    title: 'Advanced Exports',
    description: 'Professional deliverables',
    highlight: 'Video + White-Label',
    items: [
      'Video book exports',
      'White-label PDFs',
      'Custom cover templates',
      'Print-ready specifications'
    ]
  }
];

const testimonials: Testimonial[] = [
  {
    name: 'Rachel Nguyen',
    role: 'Creative Director',
    company: 'Bright Minds Agency',
    avatar: 'RN',
    quote: 'We went from producing 5 client books per month to 40. Our margins doubled and client satisfaction is at an all-time high. Studio is our secret weapon.',
    metric: '8x',
    metricLabel: 'Production increase'
  },
  {
    name: 'David Park',
    role: 'Founder',
    company: 'StoryLab EdTech',
    avatar: 'DP',
    quote: 'The Brand Hub keeps everything consistent across our curriculum. Teachers love it, kids love it, and our district partnerships grew 300% this year.',
    metric: '300%',
    metricLabel: 'Partnership growth'
  },
  {
    name: 'Amanda Foster',
    role: 'Content Lead',
    company: 'Little Giant Publishing',
    avatar: 'AF',
    quote: 'We replaced a team of 3 freelance illustrators with Genesis Studio. Same quality, 10x the speed, and our creative team actually enjoys the process now.',
    metric: '$180K',
    metricLabel: 'Annual savings'
  }
];

const workflowSteps = [
  {
    number: 1,
    title: 'Set Up Your Brand',
    description: 'Configure Brand Hub with your style guidelines, color palettes, and preferred illustration styles. Create templates for consistent output across your entire team.'
  },
  {
    number: 2,
    title: 'Collaborate & Create',
    description: 'Assign projects to team members, share assets, and work together in real-time. Built-in version control ensures nothing gets lost and everyone stays aligned.'
  },
  {
    number: 3,
    title: 'Scale & Deliver',
    description: 'Produce unlimited content for clients, campaigns, or curriculum. Export in any format—white-label PDFs, videos, or print-ready files with your branding.'
  }
];

const personas: PersonaCard[] = [
  {
    name: 'The Agency Owner',
    role: 'Creative services leader',
    avatar: 'AO',
    quote: 'Genesis lets us offer illustrated book services without hiring illustrators. Our profit per project increased 4x.',
    useCase: 'Produces custom children\'s books for brand clients',
    results: '40+ client projects delivered, $250K new revenue stream'
  },
  {
    name: 'The EdTech Builder',
    role: 'Educational content startup',
    avatar: 'EB',
    quote: 'We\'re building the future of personalized learning content. Genesis is our production engine.',
    useCase: 'Creates adaptive learning stories at scale',
    results: '500+ unique stories generated, Series A funded'
  },
  {
    name: 'The School Administrator',
    role: 'District curriculum lead',
    avatar: 'SA',
    quote: 'Culturally relevant content for our diverse student body, created by our own teachers.',
    useCase: 'Empowers teachers to create inclusive materials',
    results: '12 schools, 200+ custom books, 15% reading improvement'
  },
  {
    name: 'The Content Studio',
    role: 'Digital publishing team',
    avatar: 'CS',
    quote: 'We launched an entire children\'s book imprint in 3 months. That used to take years.',
    useCase: 'Rapid prototyping and series development',
    results: '3 book series launched, 50K+ copies sold'
  }
];

const caseStudies: CaseStudy[] = [
  {
    company: 'Bright Minds Creative Agency',
    industry: 'Marketing & Branding',
    challenge: 'A 12-person creative agency wanted to offer illustrated children\'s books as a premium service but couldn\'t justify hiring full-time illustrators for sporadic projects.',
    solution: 'Genesis Studio enabled their existing designers to create professional illustrated books. The Brand Hub ensures client brand consistency across deliverables.',
    results: [
      { metric: '$450K', label: 'New annual revenue' },
      { metric: '40+', label: 'Client projects/year' },
      { metric: '85%', label: 'Profit margin' }
    ],
    quote: 'We added a six-figure revenue stream without adding headcount. Genesis Studio is the best investment we\'ve made.',
    quotePerson: 'Rachel Nguyen, Creative Director'
  },
  {
    company: 'Harmony School District',
    industry: 'K-12 Education',
    challenge: 'A diverse school district needed culturally representative reading materials but had no budget for custom content development.',
    solution: 'Teachers use Genesis Studio to create stories featuring characters that look like their students, teaching concepts aligned to their specific curriculum.',
    results: [
      { metric: '200+', label: 'Custom books created' },
      { metric: '15%', label: 'Reading scores up' },
      { metric: '12', label: 'Schools participating' }
    ],
    quote: 'Our students finally see themselves in their reading materials. Engagement has never been higher.',
    quotePerson: 'Dr. Linda Martinez, Superintendent'
  },
  {
    company: 'TinyTales Publishing',
    industry: 'Digital Publishing',
    challenge: 'A digital-first publisher wanted to rapidly test book concepts before committing to full production with traditional illustrators.',
    solution: 'Genesis Studio for rapid prototyping—they create MVP books, test with focus groups, then refine winners for full release.',
    results: [
      { metric: '75%', label: 'Faster to market' },
      { metric: '10x', label: 'More concepts tested' },
      { metric: '3', label: 'Bestselling series' }
    ],
    quote: 'We used to bet big on single titles. Now we test 10 concepts for the same cost and only scale winners.',
    quotePerson: 'James Chen, Publisher'
  }
];

const costBreakdown = [
  { label: 'Per book (unlimited)', value: '$0*' },
  { label: 'Per team member (5 included)', value: '$9.98/seat' },
  { label: 'Brand Hub access', value: 'Included' },
  { label: 'Video exports', value: 'Included' }
];

const competitors = [
  { name: 'Full-time Illustrator', price: '$60,000+/year', features: 'Limited bandwidth' },
  { name: 'Freelance Team (3)', price: '$9,000+/month', features: 'Coordination overhead' },
  { name: 'Other AI + Collaboration', price: '$200+/month', features: 'Separate tools, no brand control' }
];

const faqs: FAQ[] = [
  {
    category: 'usage',
    question: 'What does "unlimited ebooks" actually mean?',
    answer: 'Truly unlimited. Create as many books as you want each month—there\'s no cap. Fair use applies (no automated bulk generation), but normal business use has no practical limits. Many Studio customers create 50-100+ books monthly.'
  },
  {
    category: 'technical',
    question: 'How does team collaboration work?',
    answer: 'Each of your 5 team seats gets a full Genesis account. Team members can share projects, assets, and brand settings. Real-time collaboration lets multiple people work on a book simultaneously. Admins can set permissions for who can publish or export.'
  },
  {
    category: 'technical',
    question: 'What is Brand Hub and how do I use it?',
    answer: 'Brand Hub is your central repository for brand assets and guidelines. Upload logos, set color palettes, define preferred styles, and create templates. Every book your team creates will have access to these brand elements for consistent output.'
  },
  {
    category: 'usage',
    question: 'Can different team members have different permissions?',
    answer: 'Yes! Admins can set role-based permissions. Options include: Admin (full access), Editor (create and edit), Viewer (read-only), and Publisher (can export and distribute). Customize access to match your team structure.'
  },
  {
    category: 'comparison',
    question: 'Why Studio over Creator for my agency?',
    answer: 'Creator limits you to 30 books/month and 12 pages each—fine for individuals, but agencies need more. Studio gives you unlimited books, 500 pages each, team seats for collaboration, Brand Hub for consistency, and premium support for enterprise needs.'
  },
  {
    category: 'licensing',
    question: 'Can we white-label books for clients?',
    answer: 'Absolutely. Studio includes white-label export options. Remove all Genesis branding from PDFs, add your agency logo, include client branding—deliver as if you created it entirely in-house.'
  },
  {
    category: 'support',
    question: 'What\'s included in premium support?',
    answer: '4-hour response time guarantee, dedicated success manager for your account, private Slack channel for your team, and quarterly strategy calls to optimize your workflow. We\'re invested in your success.'
  },
  {
    category: 'technical',
    question: 'How do video book exports work?',
    answer: 'Convert any book into a video with animated page turns, optional narration, and background music. Perfect for social media, YouTube, or client presentations. Export in MP4 format in various aspect ratios.'
  },
  {
    category: 'comparison',
    question: 'When should we consider Empire instead?',
    answer: 'Consider Empire if you need more than 5 team seats, custom AI model training for unique styles, API access for automation, or enterprise-grade SLAs. Empire is for organizations where Genesis is mission-critical infrastructure.'
  },
  {
    category: 'licensing',
    question: 'Does the commercial license cover client work?',
    answer: 'Yes. Your Studio license covers work you create for clients. They can sell the books, use them for marketing, or distribute as they wish. You\'re transferring the commercial rights when you deliver to clients.'
  },
  {
    category: 'support',
    question: 'Is there onboarding for our team?',
    answer: 'Yes! Every Studio account includes a dedicated onboarding session with your success manager. We\'ll help you set up Brand Hub, train your team, and establish workflows optimized for your use case.'
  },
  {
    category: 'technical',
    question: 'Can we integrate with our existing tools?',
    answer: 'Studio includes export integrations with common tools—direct upload to cloud storage, Zapier connections, and more. For deeper integrations, consider Empire tier which includes full API access.'
  }
];

const trustBadges = [
  { icon: Shield, label: '14-Day Free Trial', detail: 'Full access, no limits' },
  { icon: Award, label: '30-Day Guarantee', detail: 'Complete refund policy' },
  { icon: Users, label: '5 Team Seats', detail: 'Collaborate together' },
  { icon: Clock, label: '4hr Support', detail: 'Premium response time' }
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const TierDetailStudio: React.FC = () => {
  const navigate = useNavigate();
  const [showQuiz, setShowQuiz] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState("agency@genesis.ai");

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('genesis_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) setUserEmail(parsed.email);
      }
    } catch (e) {
      console.error("Failed to load user settings");
    }
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Helper to get user ID from Supabase or generate one
  const getUserId = async (): Promise<string> => {
    try {
      // Try to get from Supabase auth
      const { supabase } = await import('../../services/supabaseClient');
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) return user.id;

      // Fallback: generate/retrieve from localStorage
      let localUserId = localStorage.getItem('genesis_user_id');
      if (!localUserId) {
        localUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('genesis_user_id', localUserId);
      }
      return localUserId;
    } catch (error) {
      console.error('Failed to get user ID:', error);
      // Generate temp ID as last resort
      return `temp_${Date.now()}`;
    }
  };

  const handleStartTrial = async () => {
    setIsProcessing(true);

    // Default to Annual billing for this tier page
    const isAnnual = true;

    // Use Paystack Payment Page URL implementation (preferred)
    if (PAYMENT_CONFIG.paystackPaymentUrl && PAYMENT_CONFIG.planCode) {
      try {
        const userId = await getUserId();

        const paymentUrl = new URL(PAYMENT_CONFIG.paystackPaymentUrl);
        paymentUrl.searchParams.append('email', userEmail);
        paymentUrl.searchParams.append('metadata[user_id]', userId);
        paymentUrl.searchParams.append('metadata[plan_code]', PAYMENT_CONFIG.planCode);
        paymentUrl.searchParams.append('metadata[billing_cycle]', 'annual');

        const paymentWindow = window.open(
          paymentUrl.toString(),
          '_blank',
          'width=600,height=800,scrollbars=yes,resizable=yes'
        );

        if (!paymentWindow) {
          alert('Please allow pop-ups to complete payment');
          setIsProcessing(false);
          return;
        }

        const pollInterval = setInterval(() => {
          if (paymentWindow.closed) {
            clearInterval(pollInterval);
            setIsProcessing(false);
            // Optionally redirect to welcome/success
            console.log('Payment window closed');
          }
        }, 1000);

        setTimeout(() => {
          clearInterval(pollInterval);
          setIsProcessing(false);
        }, 300000);

      } catch (error) {
        console.error('Failed to open payment page:', error);
        alert('Unable to start payment. Please try again.');
        setIsProcessing(false);
      }
      return;
    }

    // Fallback implementation
    const amountToCharge = tierConfig.price.annual * 12;

    try {
      if (isApplePayAvailable()) {
        await initializeApplePayCheckout({
          email: userEmail,
          amount: amountToCharge,
          currency: "USD",
          metadata: {
            tier: UserTier.STUDIO,
            billing_cycle: 'annual'
          },
          onSuccess: (transaction) => {
            alert(`Subscription successful! Reference: ${transaction.reference}`);
            setIsProcessing(false);
            navigate('/welcome');
          },
          onCancel: () => {
            setIsProcessing(false);
          }
        });
      } else {
        await initializePayment({
          email: userEmail,
          amount: amountToCharge,
          currency: "USD",
          metadata: {
            tier: UserTier.STUDIO,
            billing_cycle: 'annual'
          },
          onSuccess: (transaction) => {
            alert(`Subscription successful! Reference: ${transaction.reference}`);
            setIsProcessing(false);
            navigate('/welcome');
          },
          onCancel: () => {
            setIsProcessing(false);
          },
          onError: (error) => {
            console.error("Payment error:", error);
            alert(`Payment failed: ${error.message}`);
            setIsProcessing(false);
          }
        });
      }
    } catch (error) {
      console.error("Payment initialization failed:", error);
      alert("Unable to start payment processing. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleDownloadPDF = () => {
    console.log('Download studio PDF');
  };

  const handleContactSales = () => {
    window.location.href = 'mailto:sales@genesis.ai?subject=Studio Tier Inquiry';
  };

  const handleBack = () => {
    // Navigate back to the onboarding pricing step
    navigate('/welcome?step=pricing');
  };

  return (
    <div className="min-h-screen bg-white font-body selection:bg-indigo-200 selection:text-indigo-900">
      <UsageHeatmap tier={tierConfig} />
      <BackToPricing onBack={handleBack} />

      {showQuiz && <TierMatchQuiz onClose={() => setShowQuiz(false)} />}

      {/* Hero */}
      <HeroSection
        tier={tierConfig}
        headline="Scale Your Creative Output"
        subheadline="Built for professional teams and high-volume independent publishers. Get advanced collaboration, brand controls, and premium features."
        trustLogos={trustLogos}
        onStartTrial={handleStartTrial}
        onDownloadPDF={handleDownloadPDF}
      >
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setShowQuiz(true)}
            className="text-sm font-semibold text-charcoal-soft/60 hover:text-indigo-600 underline decoration-dotted underline-offset-4"
          >
            Not sure? Take the 1-minute tier quiz
          </button>
        </div>
      </HeroSection>

      {/* Interactive Savings Counter */}
      <div className="container mx-auto px-6 -mt-8 relative z-10">
        <SavingsCounter tier={tierConfig} />
      </div>

      {/* Why This Tier */}
      <SectionWrapper
        id="why"
        title="Why Studio?"
        subtitle="When individual tools aren't enough, Studio gives you enterprise power with startup simplicity."
        background="bg-indigo-50/30"
      >
        <div className="space-y-12">
          {/* Value Proposition Grid */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-charcoal-soft/5 shadow-sm">
              <TrendingUp className="w-10 h-10 text-coral-burst mb-4" />
              <h3 className="font-heading font-bold text-lg mb-2">Scale Revenue</h3>
              <p className="text-charcoal-soft/70 text-sm">Add illustrated book services to your offerings. 85%+ margins on a new revenue stream.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-charcoal-soft/5 shadow-sm">
              <Users className="w-10 h-10 text-coral-burst mb-4" />
              <h3 className="font-heading font-bold text-lg mb-2">Empower Teams</h3>
              <p className="text-charcoal-soft/70 text-sm">5 seats let your whole team create. No bottlenecks, no waiting for one illustrator.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-charcoal-soft/5 shadow-sm">
              <Building2 className="w-10 h-10 text-coral-burst mb-4" />
              <h3 className="font-heading font-bold text-lg mb-2">Protect Brand</h3>
              <p className="text-charcoal-soft/70 text-sm">Brand Hub ensures every book matches your guidelines. Consistency at scale.</p>
            </div>
          </div>

          {/* Testimonials */}
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <TestimonialCard key={index} testimonial={testimonial} gradient={tierConfig.gradient} />
            ))}
          </div>

          {/* ROI Calculator Preview */}
          <div className="bg-gradient-to-br from-coral-burst/5 to-gold-sunshine/5 rounded-2xl p-8 border border-coral-burst/20">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="font-heading font-bold text-2xl text-charcoal-soft mb-4">Calculate Your ROI</h3>
                <p className="text-charcoal-soft/70 mb-4">
                  Most agencies recoup their Studio investment within the first month. See how much you could save and earn.
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-charcoal-soft/60">Typical freelance cost per book</span>
                    <span className="font-bold text-charcoal-soft">$500-1,500</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-charcoal-soft/60">Genesis Studio monthly cost</span>
                    <span className="font-bold text-charcoal-soft">$49.92</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-charcoal-soft/10 pt-3">
                    <span className="text-charcoal-soft/60">Savings on just 1 book</span>
                    <span className="font-bold text-green-600">$450-1,450</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="text-center">
                  <div className="text-5xl font-heading font-bold bg-gradient-to-r from-coral-burst to-gold-sunshine bg-clip-text text-transparent">
                    $180,000+
                  </div>
                  <div className="text-charcoal-soft/60 mt-2">Average annual savings for agencies</div>
                  <div className="text-xs text-charcoal-soft/40 mt-1">Based on 15 books/month at $1,000 avg freelance cost</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* What's Included */}
      <SectionWrapper
        id="value-prop"
        title="Scale Without Complexity"
        subtitle="Tools designed to multiply your team's output, not their workload"
        background="bg-indigo-50/30"
      >
        <FeatureVideoStories tier={tierConfig} />

        <div className="my-12">
          <FeatureGrid features={features} gradient={tierConfig.gradient} />
        </div>

        <FeatureExplorer tier={tierConfig} />
      </SectionWrapper>

      {/* How It Works */}
      <SectionWrapper
        id="testimonials"
        title="Trusted by Fast-Growing Studios"
        subtitle="See how others are scaling their production with Genesis"
        background="bg-indigo-50/30"
      >
        <DayInLifeTimeline tier={tierConfig} />
        <WorkflowSteps steps={workflowSteps} gradient={tierConfig.gradient} />

        {/* Demo CTA */}
        <div
          className="mt-16 bg-charcoal-soft rounded-2xl p-8 text-center text-white"
        >
          <h3 className="font-heading font-bold text-2xl mb-4">See Studio in Action</h3>
          <p className="text-white/70 mb-6 max-w-xl mx-auto">
            Watch how Bright Minds Agency delivers 40+ client projects per month using Genesis Studio's team collaboration features.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button className="px-8 py-4 bg-white text-charcoal-soft rounded-xl font-bold hover:bg-cream-base transition-colors inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-coral-burst flex items-center justify-center">
                <div className="w-0 h-0 border-l-[8px] border-l-white border-y-[6px] border-y-transparent ml-1" />
              </div>
              Watch Demo
            </button>
            <button
              onClick={handleContactSales}
              className="px-8 py-4 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors inline-flex items-center gap-2"
            >
              <Briefcase className="w-5 h-5" />
              Schedule Live Walkthrough
            </button>
          </div>
        </div>
      </SectionWrapper>

      {/* Who It's For */}
      <SectionWrapper
        id="who"
        title="Who Studio Is For"
        subtitle="Teams and organizations building content at scale"
        className="bg-gradient-to-b from-white to-indigo-50/30"
        background="bg-indigo-50/30"
      >
        <PersonaCards personas={personas} gradient={tierConfig.gradient} />
      </SectionWrapper>

      {/* Case Studies */}
      <SectionWrapper
        id="case-studies"
        title="Proven Results"
        subtitle="See how top studios are dominating their niche"
        background="bg-white"
      >
        <CaseStudyAccordion caseStudies={caseStudies} gradient={tierConfig.gradient} />
        <PeerComparison tier={tierConfig} />
      </SectionWrapper>

      {/* Migration & Commitment */}
      <SectionWrapper
        id="switch"
        title="Seamless Integration"
        subtitle="Plug Genesis into your existing pipeline"
        background="bg-indigo-50/30"
      >
        <MigrationAssistant tier={tierConfig} />
        <div className="mt-20">
          <CommitmentCalculator tier={tierConfig} />
        </div>
      </SectionWrapper>

      {/* Pricing */}
      <SectionWrapper
        id="pricing"
        title="Transparent Pricing"
        subtitle="Enterprise value at a fraction of enterprise cost"
        className="bg-gradient-to-b from-indigo-50/30 to-white"
        background="bg-indigo-50/30"
      >
        <PricingBreakdown
          tier={tierConfig}
          costPerUnit={costBreakdown}
          competitors={competitors}
        />

        <ROICalculator tier={tierConfig} />
      </SectionWrapper>

      {/* Trust Badges */}
      <SectionWrapper
        id="compliance"
        title="Enterprise-Grade Security"
        subtitle="Your IP is protected by industry-leading security standards"
        background="bg-indigo-50/30"
      >
        <TrustBadges badges={trustBadges} />

        <div className="mt-12 text-center">
          <p className="text-charcoal-soft/70 max-w-2xl mx-auto">
            Every Studio subscription includes a 14-day free trial with full access to all features. Your team can test everything before committing. Plus, our 30-day money-back guarantee means zero risk—if Studio doesn't transform your workflow, we'll refund you completely.
          </p>
        </div>
      </SectionWrapper>

      {/* FAQ */}
      <SectionWrapper
        id="faq"
        title="Frequently Asked Questions"
        subtitle="Everything teams need to know about Studio tier"
        className="bg-gradient-to-b from-white to-indigo-50/30"
        background="bg-indigo-50/30"
      >
        <FAQAccordion faqs={faqs} />
      </SectionWrapper>

      {/* Final CTA */}
      <FinalCTA
        tier={tierConfig}
        headline="Ready to Scale Your Content Production?"
        onStartTrial={handleStartTrial}
        onContactSales={handleContactSales}
        ctaText={isProcessing ? 'Processing...' : 'Start 14-Day Free Trial'}
      />

      {/* Footer */}
      <section className="py-12 bg-charcoal-soft text-white">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 text-center md:text-left">
            <div>
              <h4 className="font-bold mb-4">Compare Tiers</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/tier/creator')}
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Creator ($16.41/mo)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/tier/empire')}
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Empire ($166.58/mo)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/welcome?step=pricing')}
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Full Comparison
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Resources</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('who')}
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Team Setup Guide
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('value-prop')}
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Brand Hub Tutorial
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('case-studies')}
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Agency Playbook
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li>
                  <a
                    href="mailto:support@genesis.ai"
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Help Center
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:enterprise@genesis.ai?subject=Studio%20Onboarding%20Request"
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Schedule Onboarding
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:enterprise@genesis.ai"
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li>
                  <a
                    href="mailto:legal@genesis.ai?subject=Terms%20of%20Service"
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:legal@genesis.ai?subject=Privacy%20Policy"
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:legal@genesis.ai?subject=Enterprise%20Agreement"
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Enterprise Agreement
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TierDetailStudio;
