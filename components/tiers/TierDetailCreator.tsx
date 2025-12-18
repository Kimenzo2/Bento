/**
 * TierDetailCreator - Creator Tier Detail Page
 * 
 * Target: Freelancers making the leap to professional
 * Tone: Empowering, "you can do this"
 * Focus: Going pro, commercial license, quality upgrade
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Palette, Lock, Users, Headphones, Sparkles,
  Shield, Award, Clock, Zap, Check, TrendingUp, DollarSign,
  Target, Rocket, Heart, Star, Calendar, FileText
} from 'lucide-react';

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
  name: 'Creator',
  tagline: 'Go Professional',
  price: { monthly: 19.99, annual: 16.41 },
  gradient: 'from-emerald-500 to-teal-400',
  accentColor: 'emerald',
  heroStat: { value: '78%', label: 'average time saved per book' },
  customerCount: '10,000+',
  bgClass: 'bg-emerald-50/30',
  blobColors: ['bg-emerald-500/10', 'bg-teal-400/10']
};

// ============================================================================
// CONTENT DATA
// ============================================================================

const trustLogos = [
  'Indie Authors Guild',
  'Self-Publishing School',
  'Children\'s Writers United',
  'Creative Freelancers',
  'Etsy Sellers'
];

const features: FeatureCard[] = [
  {
    icon: BookOpen,
    title: 'Creation Capacity',
    description: 'Produce content at professional scale',
    highlight: '30 ebooks/month',
    items: [
      '30 fully illustrated ebooks per month',
      'Up to 12 pages per book',
      'Unlimited drafts and revisions',
      'Save and resume projects anytime'
    ]
  },
  {
    icon: Palette,
    title: 'Illustration Styles',
    description: 'Access premium visual aesthetics',
    highlight: '20+ styles',
    items: [
      'Watercolor, Oil Painting, Pixar 3D',
      'Manga, Comic Book, Storybook',
      'Educational, Minimalist, Fantasy',
      'New styles added monthly'
    ]
  },
  {
    icon: Lock,
    title: 'Commercial Rights',
    description: 'Sell your creations with confidence',
    highlight: 'Full License',
    items: [
      'Sell on Amazon KDP, Etsy, Gumroad',
      'Print-on-demand ready exports',
      'No royalty fees to Genesis',
      'Lifetime rights to your content'
    ]
  },
  {
    icon: Sparkles,
    title: 'Quality Features',
    description: 'Professional polish for every book',
    highlight: 'No Watermarks',
    items: [
      'Clean, watermark-free exports',
      'High-resolution illustrations',
      'Print-ready PDF with bleed marks',
      'EPUB format for digital stores'
    ]
  },
  {
    icon: Headphones,
    title: 'Priority Support',
    description: 'Get help when you need it',
    highlight: '24h Response',
    items: [
      'Email support with 24-hour response',
      'Access to Creator community forum',
      'Video tutorials and guides',
      'Monthly Creator office hours'
    ]
  },
  {
    icon: Zap,
    title: 'Advanced Features',
    description: 'Tools that elevate your craft',
    highlight: 'Priority Queue',
    items: [
      'Priority rendering queue',
      'Smart Editor with AI suggestions',
      'Character consistency tools',
      'Batch generation options'
    ]
  }
];

const testimonials: Testimonial[] = [
  {
    name: 'Sarah Mitchell',
    role: 'Children\'s Book Author',
    company: 'Independent',
    avatar: 'SM',
    quote: 'Genesis Creator paid for itself in the first week. I published 4 books on Amazon and made $847 in my first month. The commercial license is a game-changer.',
    metric: '$847',
    metricLabel: 'First month revenue'
  },
  {
    name: 'Marcus Chen',
    role: 'Etsy Seller',
    company: 'StoryTime Prints',
    avatar: 'MC',
    quote: 'I was spending $200+ per book on illustrations. Now I create beautiful books in hours, not weeks. My profit margins went from 20% to 75%.',
    metric: '75%',
    metricLabel: 'Profit margin'
  },
  {
    name: 'Elena Rodriguez',
    role: 'Homeschool Parent',
    company: 'Teaching 3 Kids',
    avatar: 'ER',
    quote: 'I create personalized learning books for my children. The educational styles are perfect, and my kids love seeing themselves in the stories.',
    metric: '12',
    metricLabel: 'Books created'
  }
];

const workflowSteps = [
  {
    number: 1,
    title: 'Describe Your Story',
    description: 'Enter your story concept, choose your audience age range, and select an illustration style. Our AI understands narrative structure and creates age-appropriate content automatically.'
  },
  {
    number: 2,
    title: 'Generate & Customize',
    description: 'Watch as Genesis creates your complete illustrated book in minutes. Use the Smart Editor to refine text, regenerate illustrations, or adjust the narrative flow.'
  },
  {
    number: 3,
    title: 'Export & Publish',
    description: 'Download print-ready PDFs or EPUBs. Upload directly to Amazon KDP, Etsy, or your website. Your commercial license means you keep 100% of the profits.'
  }
];

const personas: PersonaCard[] = [
  {
    name: 'The Side Hustle Author',
    role: 'Full-time job + writing passion',
    avatar: 'SH',
    quote: 'I dreamed of publishing children\'s books but couldn\'t afford illustrators. Genesis made it possible.',
    useCase: 'Creates 2-3 books monthly for Amazon KDP passive income',
    results: 'Earning $1,200/month in royalties after 6 months'
  },
  {
    name: 'The Etsy Entrepreneur',
    role: 'Digital product seller',
    avatar: 'EE',
    quote: 'My personalized children\'s books are now my bestselling product category.',
    useCase: 'Offers custom storybooks as premium digital products',
    results: '340% increase in average order value'
  },
  {
    name: 'The Teaching Parent',
    role: 'Homeschool educator',
    avatar: 'TP',
    quote: 'I create curriculum-aligned storybooks that make learning magical.',
    useCase: 'Produces educational content for homeschool co-op',
    results: 'Now selling curriculum to 50+ other families'
  },
  {
    name: 'The Gift Creator',
    role: 'Personalized gifting',
    avatar: 'GC',
    quote: 'Every grandchild gets a personalized birthday book. It\'s become a family tradition.',
    useCase: 'Creates personalized books for family milestones',
    results: 'Started a local custom book business'
  }
];

const caseStudies: CaseStudy[] = [
  {
    company: 'MagicBooks by Maria',
    industry: 'Amazon KDP Publisher',
    challenge: 'Maria wanted to publish children\'s books but illustration costs of $500-2000 per book made it financially impossible as a single mom.',
    solution: 'Using Genesis Creator, she creates 8-10 books monthly at a fraction of the cost, with professional-quality illustrations.',
    results: [
      { metric: '$4,200', label: 'Monthly KDP revenue' },
      { metric: '47', label: 'Books published' },
      { metric: '4.6★', label: 'Average rating' }
    ],
    quote: 'Genesis didn\'t just save me money—it gave me a business. I quit my day job after 8 months.',
    quotePerson: 'Maria Santos, MagicBooks Founder'
  },
  {
    company: 'Little Learners Press',
    industry: 'Educational Content',
    challenge: 'A retired teacher wanted to create phonics-based readers but had no illustration budget and limited technical skills.',
    solution: 'Genesis\'s educational styles and simple interface let her create a complete 24-book phonics series.',
    results: [
      { metric: '24', label: 'Book series' },
      { metric: '2,400+', label: 'Copies sold' },
      { metric: '3 days', label: 'Per book creation' }
    ],
    quote: 'I went from dreaming about writing books to having a published series in 3 months.',
    quotePerson: 'Patricia Webb, Educator'
  }
];

const costBreakdown = [
  { label: 'Per book (30 books/mo)', value: '$0.55' },
  { label: 'Per illustration', value: '~$0.05' },
  { label: 'Per page', value: '$0.05' },
  { label: 'Commercial license', value: 'Included' }
];

const competitors = [
  { name: 'Freelance Illustrator', price: '$500-2,000/book', features: '4-8 week turnaround' },
  { name: 'Fiverr Basic', price: '$100-300/book', features: 'Variable quality, 1-2 weeks' },
  { name: 'Other AI Tools', price: '$30-50/mo', features: 'No commercial rights' }
];

const faqs: FAQ[] = [
  {
    category: 'licensing',
    question: 'Can I really sell books created with Genesis?',
    answer: 'Absolutely! Your Creator subscription includes a full commercial license. You can sell on Amazon KDP, Etsy, Gumroad, your own website, or anywhere else. There are no royalty fees or revenue sharing—you keep 100% of your earnings.'
  },
  {
    category: 'usage',
    question: 'What happens to unused book credits?',
    answer: 'Your 30 monthly ebook credits reset each billing cycle. We recommend using them! However, if you\'re on an annual plan, we offer credit rollover of up to 10 unused credits to the next month.'
  },
  {
    category: 'technical',
    question: 'What export formats are available?',
    answer: 'Creator tier includes PDF (print-ready with crop marks and bleed), EPUB (for digital stores), and PNG sequences (for social media). All exports are high-resolution and watermark-free.'
  },
  {
    category: 'comparison',
    question: 'Why upgrade from the free Spark tier?',
    answer: 'Spark is great for trying Genesis, but the 4-page limit, watermarks, and no commercial rights make it unsuitable for selling. Creator removes all limits and adds the commercial license you need to monetize.'
  },
  {
    category: 'support',
    question: 'How fast is support response?',
    answer: 'Creator members receive priority email support with a 24-hour response guarantee during business days. You also get access to our Creator community forum and monthly office hours with the Genesis team.'
  },
  {
    category: 'technical',
    question: 'How do I ensure character consistency across pages?',
    answer: 'Genesis includes character consistency tools that maintain visual coherence. Describe your character once, and our AI ensures they look the same throughout your book—same colors, proportions, and style.'
  },
  {
    category: 'usage',
    question: 'Can I edit the AI-generated text?',
    answer: 'Yes! The Smart Editor lets you modify any text. You can rewrite sentences, add your own content, or use AI suggestions to improve. You have full creative control over the final product.'
  },
  {
    category: 'licensing',
    question: 'Do I own the copyright to my books?',
    answer: 'Yes. You own full copyright to the text you create or modify. For AI-generated illustrations, you receive a perpetual, worldwide license for commercial use. This is industry-standard for AI content.'
  },
  {
    category: 'comparison',
    question: 'Is Creator enough, or should I get Studio?',
    answer: 'Creator is perfect for individual creators publishing up to 30 books monthly. Consider Studio if you need team collaboration, more than 12 pages per book, or Brand Hub features for consistent styling.'
  },
  {
    category: 'support',
    question: 'Are there tutorials to help me get started?',
    answer: 'Absolutely! You get access to our complete video tutorial library, quick-start guides, style showcases, and monthly Creator office hours where you can ask questions live.'
  }
];

const trustBadges = [
  { icon: Shield, label: '14-Day Free Trial', detail: 'No credit card required' },
  { icon: Award, label: '30-Day Guarantee', detail: 'Full money-back, no questions' },
  { icon: Lock, label: 'Commercial License', detail: 'Sell everywhere' },
  { icon: Clock, label: '24hr Support', detail: 'Priority response' }
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const TierDetailCreator: React.FC = () => {
  const navigate = useNavigate();
  const [showQuiz, setShowQuiz] = React.useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleStartTrial = () => {
    navigate('/signup?tier=creator');
  };

  const handleDownloadPDF = () => {
    console.log('Download creator PDF');
  };

  const handleContactSales = () => {
    window.location.href = 'mailto:sales@genesis.ai?subject=Creator Tier Inquiry';
  };

  const handleBack = () => {
    // Navigate back to the onboarding pricing step
    navigate('/welcome?step=pricing');
  };

  return (
    <div className="min-h-screen bg-white font-body selection:bg-emerald-200 selection:text-emerald-900">
      <UsageHeatmap tier={tierConfig} />
      <BackToPricing onBack={handleBack} />

      {showQuiz && <TierMatchQuiz onClose={() => setShowQuiz(false)} />}

      {/* Hero */}
      <HeroSection
        tier={tierConfig}
        headline="Turn Your Stories Into Income"
        subheadline="Create professional, illustrated children's books in minutes—not months. With a full commercial license, everything you make is yours to sell."
        trustLogos={trustLogos}
        onStartTrial={handleStartTrial}
        onDownloadPDF={handleDownloadPDF}
      >
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setShowQuiz(true)}
            className="text-sm font-semibold text-charcoal-soft/60 hover:text-emerald-600 underline decoration-dotted underline-offset-4"
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
        title="Why Creator?"
        subtitle="The bridge between hobby and business. Creator gives you everything you need to publish and profit."
        background="bg-emerald-50/30"
      >
        <div className="space-y-12">
          {/* Problem → Solution */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
              <div className="text-red-500 font-bold mb-2">The Problem</div>
              <p className="text-red-900/70">Hiring illustrators costs $500-2,000 per book. Most aspiring authors never publish because they can't afford it.</p>
            </div>
            <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-100">
              <div className="text-yellow-600 font-bold mb-2">The Shift</div>
              <p className="text-yellow-900/70">AI illustration technology now creates professional-quality art in seconds, at a fraction of the cost.</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
              <div className="text-green-600 font-bold mb-2">The Solution</div>
              <p className="text-green-900/70">Genesis Creator: 30 books/month, commercial license, professional exports. Everything you need to build a publishing business.</p>
            </div>
          </div>

          {/* Testimonials */}
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <TestimonialCard key={index} testimonial={testimonial} gradient={tierConfig.gradient} />
            ))}
          </div>

          {/* Upgrade Comparison */}
          <div className="bg-white rounded-2xl p-8 border border-charcoal-soft/10">
            <h3 className="font-heading font-bold text-xl text-charcoal-soft mb-6 text-center">
              Why Upgrade from Spark (Free)?
            </h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="text-charcoal-soft/50 font-bold text-sm uppercase">Spark (Free)</div>
                {['3 books/month', '4 pages max', 'Watermarked', 'No commercial use', 'Basic support'].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-charcoal-soft/60">
                    <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="text-red-500 text-xs">✕</span>
                    </div>
                    {item}
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <div className="text-blue-500 font-bold text-sm uppercase">Creator ($16.41/mo)</div>
                {['30 books/month', '12 pages per book', 'No watermarks', 'Full commercial license', 'Priority 24hr support'].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-charcoal-soft font-medium">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* What's Included */}
      <SectionWrapper
        id="features"
        title="Everything You Get"
        subtitle="Six powerful feature categories designed for professional publishing"
        background="bg-emerald-50/30"
      >
        <FeatureVideoStories tier={tierConfig} />

        <div className="my-12">
          <FeatureGrid features={features} gradient={tierConfig.gradient} />
        </div>

        <FeatureExplorer tier={tierConfig} />
      </SectionWrapper>

      {/* How It Works */}
      <SectionWrapper
        id="how"
        title="How It Works"
        subtitle="From idea to published book in three simple steps"
        background="bg-emerald-50/30"
      >
        <DayInLifeTimeline tier={tierConfig} />
        <WorkflowSteps steps={workflowSteps} gradient={tierConfig.gradient} />

        {/* Video CTA */}
        <div
          className="mt-16 bg-charcoal-soft rounded-2xl p-8 text-center text-white"
        >
          <h3 className="font-heading font-bold text-2xl mb-4">See It In Action</h3>
          <p className="text-white/70 mb-6 max-w-xl mx-auto">
            Watch how Sarah created her first children's book in under 15 minutes—from concept to Amazon-ready PDF.
          </p>
          <button className="px-8 py-4 bg-white text-charcoal-soft rounded-xl font-bold hover:bg-cream-base transition-colors inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-coral-burst flex items-center justify-center">
              <div className="w-0 h-0 border-l-[8px] border-l-white border-y-[6px] border-y-transparent ml-1" />
            </div>
            Watch 2-Minute Demo
          </button>
        </div>
      </SectionWrapper>

      {/* Who It's For */}
      <SectionWrapper
        id="who"
        title="Who Creator Is For"
        subtitle="Real creators building real businesses with Genesis"
        className="bg-gradient-to-b from-white to-emerald-50/30"
        background="bg-emerald-50/30"
      >
        <PersonaCards personas={personas} gradient={tierConfig.gradient} />
        <PeerComparison tier={tierConfig} />
      </SectionWrapper>

      {/* Case Studies */}
      <SectionWrapper
        id="results"
        title="Where It Takes You"
        subtitle="Real results from real creators"
      >
        <CaseStudyAccordion caseStudies={caseStudies} gradient={tierConfig.gradient} />
      </SectionWrapper>

      {/* Migration & Commitment */}
      <SectionWrapper
        id="switch"
        title="Risk-Free Transition"
        subtitle="Moving to Genesis is easier than you think"
        background="bg-white"
      >
        <MigrationAssistant tier={tierConfig} />
        <div className="mt-20">
          <CommitmentCalculator tier={tierConfig} />
        </div>
      </SectionWrapper>

      {/* Pricing */}
      <SectionWrapper
        id="pricing"
        title="Simple, Transparent Pricing"
        subtitle="Know exactly what you're paying—and what you're saving"
        className="bg-gradient-to-b from-emerald-50/30 to-white"
        background="bg-emerald-50/30"
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
        id="trust"
        title="Risk-Free to Try"
        subtitle="We're confident you'll love Genesis. That's why we make it easy to try."
        background="bg-emerald-50/30"
      >
        <TrustBadges badges={trustBadges} />

        <div className="mt-12 text-center">
          <p className="text-charcoal-soft/70 max-w-2xl mx-auto">
            Start your 14-day free trial with no credit card required. If you decide Creator isn't for you within 30 days of subscribing, we'll refund you completely—no questions asked. You can also downgrade or cancel anytime from your account settings.
          </p>
        </div>
      </SectionWrapper>

      {/* FAQ */}
      <SectionWrapper
        id="faq"
        title="Frequently Asked Questions"
        subtitle="Everything you need to know about Creator tier"
        className="bg-gradient-to-b from-white to-emerald-50/30"
        background="bg-emerald-50/30"
      >
        <FAQAccordion faqs={faqs} />
      </SectionWrapper>

      {/* Final CTA */}
      <FinalCTA
        tier={tierConfig}
        headline="Ready to Turn Your Stories Into Income?"
        onStartTrial={handleStartTrial}
        onContactSales={handleContactSales}
      />

      {/* Footer Links */}
      <section className="py-12 bg-charcoal-soft text-white">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 text-center md:text-left">
            <div>
              <h4 className="font-bold mb-4">Compare Tiers</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/welcome?step=pricing')}
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Spark (Free)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/tier/studio')}
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Studio ($49.92/mo)
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
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Resources</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/welcome?step=tour')}
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Getting Started Guide
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('features')}
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Style Gallery
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('how')}
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Publishing Tutorials
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
                    href="mailto:hello@genesis.ai?subject=Community%20Forum"
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Community Forum
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:hello@genesis.ai"
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
                    href="mailto:legal@genesis.ai?subject=License%20Agreement"
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    License Agreement
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

export default TierDetailCreator;
