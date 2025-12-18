/**
 * TierDetailEmpire - Empire Tier Detail Page
 * 
 * Target: Large organizations and enterprises
 * Tone: Premium, strategic, partnership-focused
 * Focus: Unlimited scale, custom AI, API access, white-glove service
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Palette, Lock, Users, Headphones, Sparkles,
  Shield, Award, Clock, Zap, Check, Building, Cpu,
  Globe, Crown, Target, BarChart3, Code, Server,
  Fingerprint, Brain, Rocket, Star, Diamond, Infinity
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
  name: 'Empire',
  tagline: 'Enterprise Excellence',
  price: { monthly: 199.99, annual: 166.58 },
  gradient: 'from-slate-700 to-zinc-800',
  accentColor: 'slate',
  heroStat: { value: '∞', label: 'unlimited everything' },
  customerCount: '500+',
  bgClass: 'bg-slate-50',
  blobColors: ['bg-slate-500/10', 'bg-zinc-500/10']
};

// ============================================================================
// CONTENT DATA
// ============================================================================

const trustLogos = [
  'Fortune 500',
  'Global Publishers',
  'EdTech Unicorns',
  'Government',
  'Healthcare Systems'
];

const features: FeatureCard[] = [
  {
    icon: Infinity,
    title: 'Truly Unlimited',
    description: 'No limits, no exceptions',
    highlight: 'Unlimited Everything',
    items: [
      'Unlimited team members',
      'Unlimited books per month',
      'Unlimited pages per book',
      'Unlimited API calls'
    ]
  },
  {
    icon: Brain,
    title: 'Custom AI Training',
    description: 'AI that learns your brand',
    highlight: 'Exclusive Feature',
    items: [
      'Train on your proprietary styles',
      'Custom character models',
      'Brand-specific generation',
      'Unique to your organization'
    ]
  },
  {
    icon: Code,
    title: 'Full API Access',
    description: 'Integrate anywhere',
    highlight: 'Developer Ready',
    items: [
      'RESTful API endpoints',
      'Webhook integrations',
      'Batch processing',
      'Custom workflows'
    ]
  },
  {
    icon: Server,
    title: 'Dedicated Infrastructure',
    description: 'Enterprise performance',
    highlight: 'Priority Resources',
    items: [
      'Dedicated GPU allocation',
      'Priority queue processing',
      'No rate limits',
      '99.9% SLA uptime'
    ]
  },
  {
    icon: Headphones,
    title: 'White-Glove Support',
    description: 'Partnership, not service',
    highlight: '24/7 Dedicated',
    items: [
      '24/7 phone support',
      'Dedicated account team',
      'Custom onboarding',
      'Executive business reviews'
    ]
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Compliance ready',
    highlight: 'SOC 2 Certified',
    items: [
      'SSO/SAML integration',
      'Custom data retention',
      'Audit logging',
      'GDPR & HIPAA ready'
    ]
  }
];

const testimonials: Testimonial[] = [
  {
    name: 'Michael Thompson',
    role: 'Chief Product Officer',
    company: 'Scholastic Digital',
    avatar: 'MT',
    quote: 'Genesis Empire isn\'t a tool for us—it\'s infrastructure. We\'ve integrated it into our core product and serve millions of readers with custom-generated content.',
    metric: '10M+',
    metricLabel: 'Readers served'
  },
  {
    name: 'Dr. Sarah Chen',
    role: 'VP of Learning',
    company: 'Pearson Education',
    avatar: 'SC',
    quote: 'The custom AI training transformed our workflow. We generated an entire K-5 curriculum with consistent characters that students recognize book to book.',
    metric: '2,400',
    metricLabel: 'Books in curriculum'
  },
  {
    name: 'Robert Okafor',
    role: 'CTO',
    company: 'AfriStories',
    avatar: 'RO',
    quote: 'The API lets us build features we never imagined. Our users create personalized books with their own photos as characters—all powered by Genesis.',
    metric: '500K',
    metricLabel: 'API calls/month'
  }
];

const workflowSteps = [
  {
    number: 1,
    title: 'Strategic Onboarding',
    description: 'Meet your dedicated success team. We\'ll understand your goals, audit your workflows, and design a custom implementation plan aligned with your organization\'s objectives.'
  },
  {
    number: 2,
    title: 'Custom Integration',
    description: 'Our engineers work alongside yours to integrate Genesis into your systems. Custom AI model training, API implementation, SSO setup—we handle the complexity.'
  },
  {
    number: 3,
    title: 'Scale & Optimize',
    description: 'Launch with confidence knowing you have 24/7 support and dedicated resources. Regular business reviews ensure we\'re always aligned with your evolving needs.'
  }
];

const personas: PersonaCard[] = [
  {
    name: 'The Publisher',
    role: 'Global publishing house',
    avatar: 'GP',
    quote: 'We needed a solution that could handle our scale and integrate with our existing systems. Genesis Empire was the only option.',
    useCase: 'Integrated into digital publishing platform',
    results: 'Powers 3 children\'s book imprints, 1000+ titles/year'
  },
  {
    name: 'The EdTech Platform',
    role: 'Learning management system',
    avatar: 'ET',
    quote: 'Our users expect personalized content. The API lets us deliver that at scale.',
    useCase: 'API-driven content generation',
    results: 'Custom stories for 2M+ student profiles'
  },
  {
    name: 'The Government Agency',
    role: 'Public education department',
    avatar: 'GA',
    quote: 'Compliance requirements made most solutions impossible. Genesis met every security standard.',
    useCase: 'Secure, compliant content creation',
    results: 'National literacy program, 50 states'
  },
  {
    name: 'The Healthcare System',
    role: 'Pediatric hospital network',
    avatar: 'HS',
    quote: 'Therapeutic storytelling needed HIPAA compliance and customization. Genesis delivered both.',
    useCase: 'Personalized therapeutic content',
    results: '200+ hospitals, 50K custom books/year'
  }
];

const caseStudies: CaseStudy[] = [
  {
    company: 'Major Educational Publisher',
    industry: 'Publishing',
    challenge: 'A top-5 educational publisher needed to modernize their illustrated content pipeline. Legacy workflows took 18+ months per title and costs were unsustainable.',
    solution: 'Genesis Empire integrated directly into their editorial workflow. Custom AI models trained on their proprietary illustration styles. API enables automated pipeline from manuscript to illustrated proof.',
    results: [
      { metric: '75%', label: 'Cost reduction' },
      { metric: '6 weeks', label: 'Time to market (was 18mo)' },
      { metric: '400%', label: 'Title output increase' }
    ],
    quote: 'Genesis didn\'t just improve our process—it fundamentally changed what\'s possible in educational publishing.',
    quotePerson: 'SVP of Product Development'
  },
  {
    company: 'National EdTech Platform',
    industry: 'Education Technology',
    challenge: 'An edtech unicorn wanted to offer personalized illustrated stories as a differentiator, but couldn\'t find a solution that met their scale (20M+ users) and compliance requirements.',
    solution: 'Genesis Empire\'s API powers their story engine. Custom character training means each student can see themselves in stories. SOC 2 compliance met their enterprise customer requirements.',
    results: [
      { metric: '2M', label: 'Personalized books' },
      { metric: '47%', label: 'Engagement increase' },
      { metric: '$8M', label: 'New enterprise contracts' }
    ],
    quote: 'The ROI was immediate. Enterprise customers that previously said no are now signing multi-year deals.',
    quotePerson: 'Chief Revenue Officer'
  },
  {
    company: 'Children\'s Hospital Network',
    industry: 'Healthcare',
    challenge: 'A major pediatric hospital network wanted to use illustrated stories for therapeutic purposes—helping children process difficult diagnoses and procedures—but needed HIPAA compliance.',
    solution: 'Genesis Empire with custom data retention policies, HIPAA-compliant infrastructure, and specialized training for therapeutic content. Staff can create personalized stories for individual patients.',
    results: [
      { metric: '200+', label: 'Hospitals deployed' },
      { metric: '89%', label: 'Patient anxiety reduction' },
      { metric: '50K', label: 'Therapeutic books/year' }
    ],
    quote: 'We\'re helping children face their fears through personalized stories. The clinical outcomes have exceeded our research expectations.',
    quotePerson: 'Director of Child Life Services'
  }
];

const costBreakdown = [
  { label: 'Per team member', value: 'Unlimited' },
  { label: 'Per book', value: 'Unlimited' },
  { label: 'Per API call', value: 'Unlimited' },
  { label: 'Custom AI training', value: 'Included' }
];

const competitors = [
  { name: 'Custom AI Solution', price: '$500K+/year', features: '+ 18mo build time' },
  { name: 'Enterprise Licensing', price: '$300K+/year', features: 'Limited customization' },
  { name: 'In-House Team', price: '$1M+/year', features: '6+ specialists needed' }
];

const faqs: FAQ[] = [
  {
    category: 'enterprise',
    question: 'What does custom AI training mean?',
    answer: 'We train Genesis\'s AI models on your proprietary content—your illustration styles, your characters, your brand elements. The result is an AI that generates content uniquely yours. This training is exclusive to your organization and creates a competitive moat.'
  },
  {
    category: 'technical',
    question: 'How does API integration work?',
    answer: 'Full RESTful API with comprehensive documentation. Endpoints for book creation, style selection, image generation, export—everything you can do in the UI, you can automate via API. We provide SDKs for popular languages and webhook support for event-driven architectures.'
  },
  {
    category: 'enterprise',
    question: 'What security certifications do you have?',
    answer: 'SOC 2 Type II certified. GDPR compliant. HIPAA-ready with BAA available. SSO/SAML support for enterprise identity management. Custom data retention policies. Full audit logging. We can provide security documentation for your procurement process.'
  },
  {
    category: 'enterprise',
    question: 'What\'s included in dedicated infrastructure?',
    answer: 'Dedicated GPU allocation ensures your generation requests are never queued behind other customers. Priority processing for all API calls. 99.9% uptime SLA with financial guarantees. Geographic region selection for data residency requirements.'
  },
  {
    category: 'support',
    question: 'What does white-glove support mean?',
    answer: 'Dedicated account team including Technical Account Manager, Customer Success Manager, and Solutions Architect. 24/7 phone support with 1-hour response SLA. Quarterly executive business reviews. Custom training for your team. We\'re partners in your success.'
  },
  {
    category: 'comparison',
    question: 'Why Empire over Studio for our organization?',
    answer: 'Studio is for teams; Empire is for organizations where Genesis is critical infrastructure. You need Empire if: you require API access for automation, you want custom AI training for proprietary styles, you need unlimited team size, you require enterprise security/compliance, or you need SLA guarantees.'
  },
  {
    category: 'enterprise',
    question: 'Can we negotiate custom terms?',
    answer: 'Absolutely. Empire is designed for enterprise needs. Multi-year commitments, volume discounts, custom SLAs, on-premise deployment options, custom development—let\'s discuss your requirements.'
  },
  {
    category: 'technical',
    question: 'What\'s the API rate limit?',
    answer: 'Empire has no rate limits. Burst to whatever capacity you need. We\'ll provision infrastructure to match your requirements. Typical customers process 100K-500K API calls monthly.'
  },
  {
    category: 'enterprise',
    question: 'How long does implementation take?',
    answer: 'Standard enterprise implementation is 4-8 weeks depending on complexity. This includes onboarding, API integration, custom AI training if needed, SSO setup, and team training. We can expedite for urgent needs.'
  },
  {
    category: 'licensing',
    question: 'What are the licensing terms?',
    answer: 'Full commercial rights to all generated content. Enterprise redistribution rights. API usage for your products and services. White-label options available. Custom licensing terms negotiable for specific use cases.'
  },
  {
    category: 'support',
    question: 'Is there a pilot program?',
    answer: 'Yes. We offer a 30-day enterprise pilot with full Empire access. Work with our team to validate the solution for your use case before committing. Pilot fees apply toward your first year if you proceed.'
  },
  {
    category: 'technical',
    question: 'Can Genesis be deployed on-premise?',
    answer: 'For qualifying enterprise customers, we offer on-premise or private cloud deployment options. This meets requirements for organizations with strict data residency or air-gapped infrastructure needs.'
  }
];

const trustBadges = [
  { icon: Shield, label: 'SOC 2 Certified', detail: 'Enterprise security' },
  { icon: Clock, label: '99.9% SLA', detail: 'Guaranteed uptime' },
  { icon: Users, label: 'Unlimited Team', detail: 'No seat limits' },
  { icon: Headphones, label: '24/7 Support', detail: 'Dedicated team' }
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const TierDetailEmpire: React.FC = () => {
  const navigate = useNavigate();
  const [showQuiz, setShowQuiz] = React.useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleStartTrial = () => {
    // Empire typically goes to sales contact
    handleContactSales();
  };

  const handleDownloadPDF = () => {
    console.log('Download enterprise PDF');
  };

  const handleContactSales = () => {
    window.location.href = 'mailto:enterprise@genesis.ai?subject=Empire Tier - Enterprise Inquiry';
  };

  const handleBack = () => {
    // Navigate back to the onboarding pricing step
    navigate('/welcome?step=pricing');
  };

  return (
    <div className="min-h-screen bg-cream-base font-body">
      <UsageHeatmap tier={tierConfig} />
      <BackToPricing onBack={handleBack} />

      {showQuiz && <TierMatchQuiz onClose={() => setShowQuiz(false)} />}

      {/* Hero */}
      <HeroSection
        tier={tierConfig}
        headline="Where Innovation Meets Scale"
        subheadline="For organizations where Genesis isn't just a tool—it's infrastructure. Custom AI, unlimited scale, enterprise security, and a partnership built for your success."
        trustLogos={trustLogos}
        onStartTrial={handleStartTrial}
        onDownloadPDF={handleDownloadPDF}
        ctaText="Contact Sales"
        secondaryCtaText="Download Enterprise Overview"
      >
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setShowQuiz(true)}
            className="text-sm font-semibold text-charcoal-soft/60 hover:text-slate-600 underline decoration-dotted underline-offset-4"
          >
            Not sure? Take the 1-minute tier quiz
          </button>
        </div>
      </HeroSection>

      {/* Interactive Savings Counter */}
      <div className="container mx-auto px-6 -mt-8 relative z-10">
        <SavingsCounter tier={tierConfig} />
      </div>

      {/* Enterprise Value Prop */}
      <SectionWrapper
        id="why"
        title="Why Empire?"
        subtitle="Infrastructure built for organizations that cannot fail"
        background="bg-slate-50"
      >
        <div className="space-y-12">
          {/* Value Grid */}
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-gold-sunshine/10 to-coral-burst/10 rounded-2xl p-6 border border-gold-sunshine/20">
              <Crown className="w-10 h-10 text-gold-sunshine mb-4" />
              <h3 className="font-heading font-bold text-lg mb-2">Competitive Moat</h3>
              <p className="text-charcoal-soft/70 text-sm">Custom AI trained on your styles creates capabilities competitors can't replicate.</p>
            </div>
            <div className="bg-gradient-to-br from-gold-sunshine/10 to-coral-burst/10 rounded-2xl p-6 border border-gold-sunshine/20">
              <Infinity className="w-10 h-10 text-gold-sunshine mb-4" />
              <h3 className="font-heading font-bold text-lg mb-2">Infinite Scale</h3>
              <p className="text-charcoal-soft/70 text-sm">No limits on team, content, or API usage. Grow without constraints.</p>
            </div>
            <div className="bg-gradient-to-br from-gold-sunshine/10 to-coral-burst/10 rounded-2xl p-6 border border-gold-sunshine/20">
              <Shield className="w-10 h-10 text-gold-sunshine mb-4" />
              <h3 className="font-heading font-bold text-lg mb-2">Enterprise Ready</h3>
              <p className="text-charcoal-soft/70 text-sm">SOC 2, HIPAA, GDPR—compliance that satisfies your most demanding stakeholders.</p>
            </div>
            <div className="bg-gradient-to-br from-gold-sunshine/10 to-coral-burst/10 rounded-2xl p-6 border border-gold-sunshine/20">
              <Rocket className="w-10 h-10 text-gold-sunshine mb-4" />
              <h3 className="font-heading font-bold text-lg mb-2">Strategic Partner</h3>
              <p className="text-charcoal-soft/70 text-sm">Dedicated team invested in your success. We grow when you grow.</p>
            </div>
          </div>

          {/* Testimonials */}
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <TestimonialCard key={index} testimonial={testimonial} gradient={tierConfig.gradient} />
            ))}
          </div>

          {/* Enterprise Stats */}
          <div className="bg-charcoal-soft rounded-2xl p-8 text-white">
            <h3 className="font-heading font-bold text-2xl text-center mb-8">Enterprise Impact</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-4xl font-heading font-bold bg-gradient-to-r from-gold-sunshine to-coral-burst bg-clip-text text-transparent">
                  $50M+
                </div>
                <div className="text-white/60 text-sm mt-1">Customer Revenue Generated</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-heading font-bold bg-gradient-to-r from-gold-sunshine to-coral-burst bg-clip-text text-transparent">
                  99.9%
                </div>
                <div className="text-white/60 text-sm mt-1">Uptime SLA</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-heading font-bold bg-gradient-to-r from-gold-sunshine to-coral-burst bg-clip-text text-transparent">
                  500+
                </div>
                <div className="text-white/60 text-sm mt-1">Enterprise Customers</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-heading font-bold bg-gradient-to-r from-gold-sunshine to-coral-burst bg-clip-text text-transparent">
                  &lt;1hr
                </div>
                <div className="text-white/60 text-sm mt-1">Support Response SLA</div>
              </div>
            </div>
          </div>
        </div>
      </SectionWrapper >

      {/* What's Included */}
      < SectionWrapper
        id="features"
        title="Enterprise Capabilities"
        subtitle="Everything from Studio, plus exclusive enterprise features"
        className="bg-gradient-to-b from-slate-50 to-white"
        background="bg-slate-50"
      >
        <FeatureVideoStories tier={tierConfig} />

        <div className="my-12">
          <FeatureGrid features={features} gradient={tierConfig.gradient} />
        </div>

        <FeatureExplorer tier={tierConfig} />

        {/* Includes Everything */}
        <div className="mt-12 bg-white rounded-2xl p-8 border border-charcoal-soft/5 shadow-sm">
          <h3 className="font-heading font-bold text-xl text-center mb-6">Plus Everything in Studio</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              'Unlimited Books', 'All 50+ Styles', 'Brand Hub', 'Video Exports',
              'White-Label PDFs', 'Priority Queue', 'Premium Support', '500+ Pages/Book'
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-charcoal-soft/70">
                <Check className="w-4 h-4 text-mint-fresh" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </SectionWrapper >

      {/* How It Works */}
      < SectionWrapper
        id="how"
        title="Your Partnership Journey"
        subtitle="From evaluation to enterprise deployment"
        background="bg-white"
      >
        <DayInLifeTimeline tier={tierConfig} />
        <WorkflowSteps steps={workflowSteps} gradient={tierConfig.gradient} />

        {/* Implementation Timeline */}
        <div className="mt-16 bg-white rounded-2xl p-8 border border-charcoal-soft/5 shadow-lg">
          <h3 className="font-heading font-bold text-xl text-center mb-8">Typical Implementation Timeline</h3>
          <div className="relative">
            <div className="absolute top-6 left-0 right-0 h-1 bg-gradient-to-r from-gold-sunshine to-coral-burst rounded-full" />
            <div className="grid grid-cols-4 relative">
              {[
                { week: 'Week 1', label: 'Discovery & Planning' },
                { week: 'Week 2-3', label: 'Technical Setup' },
                { week: 'Week 4-6', label: 'Integration & Testing' },
                { week: 'Week 7-8', label: 'Launch & Training' }
              ].map((phase, index) => (
                <div key={index} className="text-center">
                  <div className="w-4 h-4 bg-gold-sunshine rounded-full mx-auto mb-4 relative z-10 border-4 border-white" />
                  <div className="text-xs font-bold text-gold-sunshine">{phase.week}</div>
                  <div className="text-xs text-charcoal-soft/70 mt-1">{phase.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionWrapper >

      {/* Who It's For */}
      <SectionWrapper
        id="who"
        title="Who Empire Is For"
        subtitle="Organizations building the future of content"
        className="bg-gradient-to-b from-white to-slate-50"
        background="bg-slate-50"
      >
        <PersonaCards personas={personas} gradient={tierConfig.gradient} />
      </SectionWrapper >

      {/* Case Studies */}
      <SectionWrapper
        id="case-studies"
        title="Enterprise Success Stories"
        subtitle="How global publishers are transforming their business"
        className="bg-slate-50"
        background="bg-slate-50"
      >
        <CaseStudyAccordion caseStudies={caseStudies} gradient={tierConfig.gradient} />
      </SectionWrapper>

      {/* Migration & Commitment */}
      <SectionWrapper
        id="switch"
        title="Enterprise-Grade Transition"
        subtitle="Dedicated support for your migration"
        background="bg-white"
      >
        <PeerComparison tier={tierConfig} />

        <div className="my-20">
          <MigrationAssistant tier={tierConfig} />
        </div>

        <CommitmentCalculator tier={tierConfig} />
      </SectionWrapper>

      {/* Pricing */}
      <SectionWrapper
        id="pricing"
        title="Enterprise Investment"
        subtitle="Transparent pricing with flexible terms"
        className="bg-gradient-to-b from-slate-50 to-white"
        background="bg-slate-50"
      >
        <PricingBreakdown
          tier={tierConfig}
          costPerUnit={costBreakdown}
          competitors={competitors}
        />

        <ROICalculator tier={tierConfig} />

        {/* Custom Pricing Note */}
        <div className="mt-8 text-center">
          <p className="text-charcoal-soft/70">
            Enterprise pricing available for multi-year commitments, volume, and custom requirements.
            <button onClick={handleContactSales} className="text-coral-burst font-semibold ml-2 hover:underline">
              Let's discuss your needs →
            </button>
          </p>
        </div>
      </SectionWrapper >

      {/* Security & Compliance */}
      <SectionWrapper
        id="security"
        title="Enterprise-Grade Security"
        subtitle="Built for the most demanding compliance requirements"
        background="bg-slate-50"
      >
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl p-8 border border-charcoal-soft/5 shadow-sm">
            <h3 className="font-heading font-bold text-xl mb-6 flex items-center gap-2">
              <Shield className="w-6 h-6 text-gold-sunshine" />
              Certifications & Compliance
            </h3>
            <div className="space-y-4">
              {[
                { label: 'SOC 2 Type II', detail: 'Audited annually' },
                { label: 'GDPR Compliant', detail: 'EU data protection' },
                { label: 'HIPAA Ready', detail: 'BAA available' },
                { label: 'CCPA Compliant', detail: 'California privacy' }
              ].map((cert, index) => (
                <div key={index} className="flex items-center justify-between py-3 border-b border-charcoal-soft/5 last:border-0">
                  <span className="font-semibold text-charcoal-soft">{cert.label}</span>
                  <span className="text-charcoal-soft/60 text-sm">{cert.detail}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 border border-charcoal-soft/5 shadow-sm">
            <h3 className="font-heading font-bold text-xl mb-6 flex items-center gap-2">
              <Lock className="w-6 h-6 text-gold-sunshine" />
              Security Features
            </h3>
            <div className="space-y-4">
              {[
                { label: 'SSO/SAML', detail: 'Enterprise identity' },
                { label: 'Audit Logging', detail: 'Full activity tracking' },
                { label: 'Data Encryption', detail: 'At rest and in transit' },
                { label: 'Role-Based Access', detail: 'Granular permissions' }
              ].map((feature, index) => (
                <div key={index} className="flex items-center justify-between py-3 border-b border-charcoal-soft/5 last:border-0">
                  <span className="font-semibold text-charcoal-soft">{feature.label}</span>
                  <span className="text-charcoal-soft/60 text-sm">{feature.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionWrapper >

      {/* Trust Badges */}
      < SectionWrapper
        id="trust"
        title="Enterprise Confidence"
        subtitle="Backed by industry-leading guarantees"
        className="bg-gradient-to-b from-white to-cream-base"
      >
        <TrustBadges badges={trustBadges} />

        <div className="mt-12 text-center">
          <p className="text-charcoal-soft/70 max-w-2xl mx-auto">
            Every Empire engagement begins with a 30-day enterprise pilot. Experience the full platform with your actual use case before making a commitment. Our dedicated team ensures your pilot success.
          </p>
        </div>
      </SectionWrapper >

      {/* FAQ */}
      < SectionWrapper
        id="faq"
        title="Enterprise FAQ"
        subtitle="Everything you need for your procurement process"
      >
        <FAQAccordion faqs={faqs} />

        <div className="mt-12 bg-white rounded-2xl p-8 border border-charcoal-soft/5 text-center">
          <h3 className="font-heading font-bold text-xl mb-4">Need More Information?</h3>
          <p className="text-charcoal-soft/70 mb-6">
            Download our enterprise documentation package including security whitepaper, compliance certifications, and technical specifications.
          </p>
          <button className="px-8 py-4 bg-charcoal-soft text-white rounded-xl font-bold hover:bg-charcoal-soft/90 transition-colors inline-flex items-center gap-2">
            Download Enterprise Package
          </button>
        </div>
      </SectionWrapper >

      {/* Final CTA */}
      < FinalCTA
        tier={tierConfig}
        headline="Ready to Transform Your Organization?"
        onStartTrial={handleContactSales}
        onContactSales={handleContactSales}
        ctaText="Schedule Executive Briefing"
      />

      {/* Footer */}
      < section className="py-12 bg-charcoal-soft text-white" >
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
                    onClick={() => navigate('/tier/studio')}
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Studio ($49.92/mo)
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
                    onClick={() => scrollToSection('security')}
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Security Whitepaper
                  </button>
                </li>
                <li>
                  <a
                    href="mailto:enterprise@genesis.ai?subject=API%20Documentation%20Request"
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    API Documentation
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('case-studies')}
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Enterprise Case Studies
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Contact</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li>
                  <a
                    href="mailto:enterprise@genesis.ai"
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    enterprise@genesis.ai
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:enterprise@genesis.ai?subject=Schedule%20Demo"
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Schedule Demo
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:enterprise@genesis.ai?subject=Request%20Proposal"
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Request Proposal
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-white/60 text-sm">
                <li>
                  <a
                    href="mailto:legal@genesis.ai?subject=Enterprise%20Agreement"
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    Enterprise Agreement
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:legal@genesis.ai?subject=DPA%20Template"
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    DPA Template
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:legal@genesis.ai?subject=BAA%20Template"
                    className="w-full text-left min-h-11 inline-flex items-center hover:text-white transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-soft"
                  >
                    BAA Template
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Enterprise Badge */}
          <div className="mt-12 pt-8 border-t border-white/10 flex flex-wrap items-center justify-center gap-8">
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Shield className="w-5 h-5" />
              SOC 2 Type II
            </div>
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Lock className="w-5 h-5" />
              GDPR Compliant
            </div>
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Fingerprint className="w-5 h-5" />
              HIPAA Ready
            </div>
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Award className="w-5 h-5" />
              99.9% SLA
            </div>
          </div>
        </div>
      </section >
    </div >
  );
};

export default TierDetailEmpire;
