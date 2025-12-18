/**
 * Shared Components for Tier Detail Pages
 * Reusable sections, cards, and UI elements across Creator, Studio, and Empire pages
 */

import React, { useState, ReactNode } from 'react';
import {
  Check, ChevronDown, ChevronRight, Play, Download, Calendar,
  Shield, Award, Clock, Users, Zap, Star, ArrowRight, Quote,
  BookOpen, Palette, Lock, Headphones, Sparkles, Building2,
  Calculator, X, ExternalLink, Mail, Phone
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Testimonial {
  name: string;
  role: string;
  company: string;
  avatar: string;
  quote: string;
  metric?: string;
  metricLabel?: string;
}

export interface FeatureCard {
  icon: React.ElementType;
  title: string;
  description: string;
  items: string[];
  highlight?: string;
}

export interface PersonaCard {
  name: string;
  role: string;
  avatar: string;
  quote: string;
  useCase: string;
  results: string;
}

export interface CaseStudy {
  company: string;
  industry: string;
  logo?: string;
  challenge: string;
  solution: string;
  results: { metric: string; label: string }[];
  quote?: string;
  quotePerson?: string;
}

export interface FAQ {
  category: 'technical' | 'usage' | 'licensing' | 'support' | 'comparison' | 'enterprise';
  question: string;
  answer: string;
}

export interface TierConfig {
  name: string;
  tagline: string;
  price: { monthly: number; annual: number };
  gradient: string;
  accentColor: string;
  heroStat: { value: string; label: string };
  customerCount: string;
  bgClass: string;
  blobColors: [string, string];
}

// ============================================================================
// HERO SECTION
// ============================================================================

interface HeroSectionProps {
  tier: TierConfig;
  headline: string;
  subheadline: string;
  heroImage?: string;
  trustLogos: string[];
  onStartTrial: () => void;
  onDownloadPDF: () => void;
  ctaText?: string;
  secondaryCtaText?: string;
  children?: ReactNode;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  tier,
  headline,
  subheadline,
  heroImage,
  trustLogos,
  onStartTrial,
  onDownloadPDF,
  ctaText = 'Start Free Trial',
  secondaryCtaText = 'Download Pricing PDF',
  children
}) => (
  <section className="relative min-h-[90vh] flex items-center overflow-hidden">
    {/* Background Gradient */}
    <div className={`absolute inset-0 bg-gradient-to-br ${tier.gradient} opacity-5`} />
    <div className={`absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-${tier.bgClass.replace('bg-', '')}`} />

    {/* Decorative Elements */}
    <div className={`absolute top-20 right-10 w-72 h-72 ${tier.blobColors[0]} rounded-full blur-3xl`} />
    <div className={`absolute bottom-20 left-10 w-96 h-96 ${tier.blobColors[1]} rounded-full blur-3xl`} />

    <div className="container mx-auto px-[var(--ob-container-padding)] py-12 md:py-20 relative z-10">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Left: Content */}
        <div className="space-y-8">
          {/* Tier Badge */}
          <div className="inline-flex items-center gap-2">
            <span className={`px-4 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r ${tier.gradient} text-white`}>
              {tier.name} Tier
            </span>
            <span className="text-charcoal-soft/60 text-sm">{tier.tagline}</span>
          </div>

          {/* Headline */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-heading font-bold text-charcoal-soft leading-tight break-words">
            {headline.split(' ').map((word, i) => (
              <span key={i} className={i === headline.split(' ').length - 1 ? `bg-gradient-to-r ${tier.gradient} bg-clip-text text-transparent` : ''}>
                {word}{' '}
              </span>
            ))}
          </h1>

          {/* Subheadline */}
          <p className="text-base md:text-lg lg:text-xl text-charcoal-soft/70 max-w-xl break-words">
            {subheadline}
          </p>

          {/* Hero Stat */}
          <div className="flex items-center gap-6">
            <div className={`text-2xl md:text-3xl lg:text-4xl font-heading font-bold bg-gradient-to-r ${tier.gradient} bg-clip-text text-transparent`}>
              {tier.heroStat.value}
            </div>
            <div className="text-sm text-charcoal-soft/60 max-w-[120px]">
              {tier.heroStat.label}
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4">
              <button
                onClick={onStartTrial}
                className={`px-4 sm:px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold text-sm md:text-base text-white bg-gradient-to-r ${tier.gradient} shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2`}
              >
                {ctaText}
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={onDownloadPDF}
                className="px-4 sm:px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold text-sm md:text-base text-charcoal-soft bg-white border-2 border-charcoal-soft/10 hover:border-charcoal-soft/30 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                {secondaryCtaText}
              </button>
            </div>
            {children}
          </div>

          {/* Trust Logos */}
          <div className="pt-8 border-t border-charcoal-soft/10">
            <p className="text-xs text-charcoal-soft/50 mb-4 uppercase tracking-wider">
              Trusted by {tier.customerCount} creators worldwide
            </p>
            <div className="flex flex-wrap gap-2 sm:gap-4 md:gap-6 items-center opacity-50">
              {trustLogos.map((logo, i) => (
                <div key={i} className="h-8 px-4 bg-charcoal-soft/10 rounded-lg flex items-center justify-center text-xs font-medium text-charcoal-soft/70">
                  {logo}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Hero Image */}
        <div className="relative hidden lg:block">
          <div className={`absolute inset-0 bg-gradient-to-br ${tier.gradient} opacity-20 rounded-3xl blur-2xl`} />
          <div className="relative bg-white/50 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/50">
            {heroImage ? (
              <img src={heroImage} alt={`${tier.name} Hero`} className="w-full h-auto rounded-2xl" />
            ) : (
              <div className={`aspect-[4/3] bg-gradient-to-br from-${tier.bgClass.replace('bg-', '')} to-white rounded-2xl flex items-center justify-center`}>
                <Sparkles className="w-24 h-24 text-charcoal-soft/10" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </section>
);

// ============================================================================
// SECTION WRAPPER
// ============================================================================

interface SectionWrapperProps {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  dark?: boolean;
  background?: string;
}

export const SectionWrapper: React.FC<SectionWrapperProps> = ({
  id,
  title,
  subtitle,
  children,
  className = '',
  dark = false,
  background
}) => (
  <section
    id={id}
    className={`py-20 md:py-32 ${dark ? 'bg-charcoal-soft text-white' : (background || 'bg-cream-base')} ${className}`}
  >
    <div className="container mx-auto px-[var(--ob-container-padding)]">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className={`text-3xl md:text-4xl font-heading font-bold mb-4 ${dark ? 'text-white' : 'text-charcoal-soft'}`}>
            {title}
          </h2>
          {subtitle && (
            <p className={`text-lg max-w-2xl mx-auto ${dark ? 'text-white/70' : 'text-charcoal-soft/70'}`}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Section Content */}
        {children}
      </div>
    </div>
  </section>
);

// ============================================================================
// FEATURE GRID
// ============================================================================

interface FeatureGridProps {
  features: FeatureCard[];
  gradient: string;
}

export const FeatureGrid: React.FC<FeatureGridProps> = ({ features, gradient }) => (
  <div
    className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6"
  >
    {features.map((feature, index) => (
      <div
        key={index}
        className="group bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-charcoal-soft/5 hover:border-coral-burst/20"
      >
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 md:mb-4 group-hover:scale-110 transition-transform`}>
          <feature.icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </div>
        <h3 className="font-heading font-bold text-base md:text-lg text-charcoal-soft mb-1.5 md:mb-2">{feature.title}</h3>
        <p className="text-xs md:text-sm text-charcoal-soft/60 mb-3 md:mb-4">{feature.description}</p>

        {feature.highlight && (
          <div className="mb-4 px-3 py-1.5 bg-mint-breeze/50 rounded-lg inline-block">
            <span className="text-xs font-bold text-green-700">{feature.highlight}</span>
          </div>
        )}

        <ul className="space-y-2">
          {feature.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-charcoal-soft/80">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);

// ============================================================================
// TESTIMONIAL CARD
// ============================================================================

export const TestimonialCard: React.FC<{ testimonial: Testimonial; gradient: string }> = ({
  testimonial,
  gradient
}) => (
  <div
    className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-lg border border-charcoal-soft/5"
  >
    <Quote className={`w-8 h-8 mb-4 bg-gradient-to-br ${gradient} bg-clip-text text-coral-burst/30`} />
    <p className="text-charcoal-soft/80 mb-6 italic">"{testimonial.quote}"</p>

    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-coral-burst to-gold-sunshine flex items-center justify-center text-white font-bold">
          {testimonial.name.charAt(0)}
        </div>
        <div>
          <div className="font-bold text-charcoal-soft">{testimonial.name}</div>
          <div className="text-sm text-charcoal-soft/60">{testimonial.role}, {testimonial.company}</div>
        </div>
      </div>

      {testimonial.metric && (
        <div className="text-right">
          <div className={`text-2xl font-heading font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
            {testimonial.metric}
          </div>
          <div className="text-xs text-charcoal-soft/50">{testimonial.metricLabel}</div>
        </div>
      )}
    </div>
  </div>
);

// ============================================================================
// WORKFLOW STEPS
// ============================================================================

interface WorkflowStep {
  number: number;
  title: string;
  description: string;
  image?: string;
}

interface WorkflowStepsProps {
  steps: WorkflowStep[];
  gradient: string;
}

export const WorkflowSteps: React.FC<WorkflowStepsProps> = ({ steps, gradient }) => (
  <div className="space-y-12">
    {steps.map((step, index) => (
      <div
        key={index}
        className={`flex flex-col ${index % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} gap-8 items-center`}
      >
        {/* Content */}
        <div className="flex-1 space-y-4">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br ${gradient} text-white font-bold text-lg`}>
            {step.number}
          </div>
          <h3 className="text-2xl font-heading font-bold text-charcoal-soft">{step.title}</h3>
          <p className="text-charcoal-soft/70">{step.description}</p>
        </div>

        {/* Image */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-charcoal-soft/5">
            {step.image ? (
              <img src={step.image} alt={step.title} className="w-full rounded-xl" />
            ) : (
              <div className="aspect-video bg-gradient-to-br from-cream-base to-peach-soft rounded-xl flex items-center justify-center">
                <Play className="w-16 h-16 text-coral-burst/30" />
              </div>
            )}
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ============================================================================
// PERSONA CARDS
// ============================================================================

interface PersonaCardsProps {
  personas: PersonaCard[];
  gradient: string;
}

export const PersonaCards: React.FC<PersonaCardsProps> = ({ personas, gradient }) => (
  <div className="grid md:grid-cols-2 gap-3 md:gap-6">
    {personas.map((persona, index) => (
      <div
        key={index}
        className="bg-white rounded-xl md:rounded-2xl overflow-hidden shadow-lg border border-charcoal-soft/5 hover:shadow-xl transition-shadow"
      >
        <div className={`h-1.5 md:h-2 bg-gradient-to-r ${gradient}`} />
        <div className="p-4 md:p-6">
          <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br from-coral-burst/20 to-gold-sunshine/20 flex items-center justify-center text-xl md:text-2xl font-bold text-coral-burst flex-shrink-0">
              {persona.name.charAt(0)}
            </div>
            <div>
              <h4 className="font-heading font-bold text-base md:text-lg text-charcoal-soft">{persona.name}</h4>
              <p className="text-xs md:text-sm text-charcoal-soft/60">{persona.role}</p>
            </div>
          </div>

          <p className="text-charcoal-soft/70 italic mb-3 md:mb-4 text-sm md:text-base">"{persona.quote}"</p>

          <div className="space-y-3 pt-4 border-t border-charcoal-soft/10">
            <div>
              <span className="text-xs font-bold text-charcoal-soft/50 uppercase">Use Case</span>
              <p className="text-sm text-charcoal-soft">{persona.useCase}</p>
            </div>
            <div>
              <span className="text-xs font-bold text-charcoal-soft/50 uppercase">Results</span>
              <p className={`text-sm font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
                {persona.results}
              </p>
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ============================================================================
// CASE STUDY ACCORDION
// ============================================================================

interface CaseStudyAccordionProps {
  caseStudies: CaseStudy[];
  gradient: string;
}

export const CaseStudyAccordion: React.FC<CaseStudyAccordionProps> = ({ caseStudies, gradient }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-4">
      {caseStudies.map((study, index) => (
        <div
          key={index}
          className="bg-white rounded-xl md:rounded-2xl overflow-hidden shadow-sm border border-charcoal-soft/5"
        >
          {/* Header */}
          <button
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="w-full px-4 md:px-6 py-3 md:py-5 flex items-center justify-between hover:bg-cream-base/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-charcoal-soft/5 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-charcoal-soft/50" />
              </div>
              <div className="text-left">
                <h4 className="font-heading font-bold text-charcoal-soft">{study.company}</h4>
                <p className="text-sm text-charcoal-soft/60">{study.industry}</p>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-charcoal-soft/50 transition-transform ${openIndex === index ? 'rotate-180' : ''}`} />
          </button>

          {/* Content */}
          {openIndex === index && (
            <div className="overflow-hidden">
              <div className="px-3 sm:px-4 md:px-6 pb-4 md:pb-6 space-y-4 md:space-y-6">
                {/* Challenge, Solution */}
                <div className="grid md:grid-cols-2 gap-3 md:gap-4">
                  <div className="p-3 md:p-4 bg-red-50 rounded-lg md:rounded-xl">
                    <h5 className="font-bold text-red-700 mb-1.5 md:mb-2 text-sm md:text-base">Challenge</h5>
                    <p className="text-xs md:text-sm text-red-900/70 break-words">{study.challenge}</p>
                  </div>
                  <div className="p-3 md:p-4 bg-green-50 rounded-lg md:rounded-xl">
                    <h5 className="font-bold text-green-700 mb-1.5 md:mb-2 text-sm md:text-base">Solution</h5>
                    <p className="text-xs md:text-sm text-green-900/70 break-words">{study.solution}</p>
                  </div>
                </div>

                {/* Results */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-4">
                  {study.results.map((result, i) => (
                    <div key={i} className="text-center p-2 sm:p-3 md:p-4 bg-cream-base rounded-lg md:rounded-xl overflow-hidden">
                      <div className={`text-base sm:text-lg md:text-2xl font-heading font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent truncate`}>
                        {result.metric}
                      </div>
                      <div className="text-[9px] sm:text-[10px] md:text-xs text-charcoal-soft/60 line-clamp-2">{result.label}</div>
                    </div>
                  ))}
                </div>

                {/* Quote */}
                {study.quote && (
                  <div className="p-3 md:p-4 bg-charcoal-soft/5 rounded-lg md:rounded-xl">
                    <p className="text-xs sm:text-sm md:text-base text-charcoal-soft/80 italic break-words">"{study.quote}"</p>
                    {study.quotePerson && (
                      <p className="text-sm text-charcoal-soft/50 mt-2">— {study.quotePerson}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

};

// ============================================================================
// PRICING BREAKDOWN
// ============================================================================

interface PricingBreakdownProps {
  tier: TierConfig;
  costPerUnit: { label: string; value: string }[];
  competitors: { name: string; price: string; features: string }[];
}

export const PricingBreakdown: React.FC<PricingBreakdownProps> = ({
  tier,
  costPerUnit,
  competitors
}) => (
  <div className="grid lg:grid-cols-2 gap-4 md:gap-8">
    {/* Main Price Card */}
    <div
      className={`bg-gradient-to-br ${tier.gradient} rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 text-white`}
    >
      <h3 className="text-base sm:text-lg md:text-xl font-bold mb-1.5 md:mb-2">Genesis {tier.name}</h3>
      <div className="flex items-baseline gap-1.5 md:gap-2 mb-4 md:mb-6">
        <span className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold">${tier.price.annual}</span>
        <span className="text-white/70 text-sm md:text-base">/month</span>
      </div>
      <div className="bg-white/20 rounded-lg md:rounded-xl p-3 md:p-4 mb-4 md:mb-6">
        <div className="text-xs md:text-sm">Billed annually at ${Math.round(tier.price.annual * 12)}/year</div>
        <div className="text-sm md:text-lg font-bold">Save ${Math.round((tier.price.monthly - tier.price.annual) * 12)}/year</div>
      </div>

      {/* Cost Per Unit */}
      <div className="space-y-3">
        <h4 className="font-bold text-white/80">Cost Breakdown</h4>
        {costPerUnit.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-white/70">{item.label}</span>
            <span className="font-bold">{item.value}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Comparison */}
    <div className="space-y-3 md:space-y-4">
      <h3 className="font-heading font-bold text-base sm:text-lg md:text-xl text-charcoal-soft mb-2 md:mb-4">Compare Alternatives</h3>

      {competitors.map((comp, i) => (
        <div key={i} className="flex items-center justify-between p-3 md:p-4 bg-white rounded-lg md:rounded-xl border border-charcoal-soft/10">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-charcoal-soft text-sm md:text-base truncate">{comp.name}</div>
            <div className="text-[10px] md:text-xs text-charcoal-soft/50 truncate">{comp.features}</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-charcoal-soft">{comp.price}</div>
          </div>
        </div>
      ))}

      <div className={`flex items-center justify-between p-3 md:p-4 bg-gradient-to-r ${tier.gradient} rounded-lg md:rounded-xl text-white`}>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm md:text-base">Genesis {tier.name}</div>
          <div className="text-[10px] md:text-xs text-white/70">Everything included</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-bold text-sm md:text-base">${tier.price.annual}/mo</div>
          <div className="text-[10px] md:text-xs text-white/70">Best Value ✓</div>
        </div>
      </div>
    </div>
  </div>
);

// ============================================================================
// FAQ ACCORDION
// ============================================================================

interface FAQAccordionProps {
  faqs: FAQ[];
}

const categoryIcons: Record<FAQ['category'], React.ElementType> = {
  technical: Zap,
  usage: BookOpen,
  licensing: Lock,
  support: Headphones,
  comparison: Star,
  enterprise: Building2
};

const categoryLabels: Record<FAQ['category'], string> = {
  technical: 'Technical',
  usage: 'Usage',
  licensing: 'Licensing',
  support: 'Support',
  comparison: 'Comparison',
  enterprise: 'Enterprise'
};

export const FAQAccordion: React.FC<FAQAccordionProps> = ({ faqs }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<FAQ['category'] | 'all'>('all');

  const categories = ['all', ...new Set(faqs.map(f => f.category))] as (FAQ['category'] | 'all')[];
  const filteredFaqs = filter === 'all' ? faqs : faqs.filter(f => f.category === filter);

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 justify-center">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filter === cat
              ? 'bg-coral-burst text-white'
              : 'bg-white text-charcoal-soft/70 hover:bg-charcoal-soft/5'
              }`}
          >
            {cat === 'all' ? 'All Questions' : categoryLabels[cat]}
          </button>
        ))}
      </div>

      {/* FAQ List */}
      <div className="space-y-3 max-w-3xl mx-auto">
        {filteredFaqs.map((faq, index) => {
          const Icon = categoryIcons[faq.category];
          return (
            <div
              key={index}
              className="bg-white rounded-xl overflow-hidden border border-charcoal-soft/5"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 flex items-center gap-4 text-left hover:bg-cream-base/50 transition-colors"
              >
                <Icon className="w-5 h-5 text-coral-burst flex-shrink-0" />
                <span className="flex-1 font-medium text-charcoal-soft">{faq.question}</span>
                <ChevronDown className={`w-5 h-5 text-charcoal-soft/50 transition-transform ${openIndex === index ? 'rotate-180' : ''}`} />
              </button>

              {openIndex === index && (
                <div className="overflow-hidden">
                  <div className="px-6 pb-4 pl-16 text-charcoal-soft/70">
                    {faq.answer}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// TRUST BADGES
// ============================================================================

interface TrustBadgesProps {
  badges: { icon: React.ElementType; label: string; detail: string }[];
}

export const TrustBadges: React.FC<TrustBadgesProps> = ({ badges }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {badges.map((badge, index) => (
      <div
        key={index}
        className="bg-white rounded-xl p-4 text-center border border-charcoal-soft/5"
      >
        <badge.icon className="w-8 h-8 mx-auto mb-2 text-coral-burst" />
        <div className="font-bold text-charcoal-soft text-sm">{badge.label}</div>
        <div className="text-xs text-charcoal-soft/50">{badge.detail}</div>
      </div>
    ))}
  </div>
);

// ============================================================================
// FINAL CTA
// ============================================================================

interface FinalCTAProps {
  tier: TierConfig;
  headline: string;
  onStartTrial: () => void;
  onContactSales: () => void;
  ctaText?: string;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({
  tier,
  headline,
  onStartTrial,
  onContactSales,
  ctaText = 'Start Your 14-Day Free Trial'
}) => (
  <section className={`py-12 md:py-20 bg-gradient-to-br ${tier.gradient}`}>
    <div className="container mx-auto px-[var(--ob-container-padding)]">
      <div className="max-w-3xl mx-auto text-center text-white">
        <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-heading font-bold mb-4 md:mb-6 break-words">
          {headline}
        </h2>

        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-2 sm:gap-4 mb-6 md:mb-8">
          <button
            onClick={onStartTrial}
            className="px-4 sm:px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold text-sm md:text-base bg-white text-charcoal-soft shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2">
            <span className="truncate">{ctaText}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={onContactSales}
            className="px-4 sm:px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold text-sm md:text-base bg-white/20 text-white border-2 border-white/30 hover:bg-white/30 transition-all flex items-center justify-center gap-2"
          >
            <Phone className="w-5 h-5" />
            Talk to Our Team
          </button>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 md:gap-6 text-xs sm:text-sm text-white/70">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            No credit card required
          </span>
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            Cancel anytime
          </span>
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            30-day money-back guarantee
          </span>
        </div>
      </div>
    </div>
  </section>
);

// ============================================================================
// BACK BUTTON
// ============================================================================

export const BackToPricing: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <button
    onClick={onBack}
    className="fixed top-4 left-2 sm:top-6 sm:left-6 z-50 px-2 sm:px-4 py-1.5 sm:py-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-charcoal-soft/10 flex items-center gap-1 sm:gap-2 text-charcoal-soft hover:bg-white transition-colors"
  >
    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 rotate-180" />
    <span className="text-xs sm:text-sm font-medium">Back to Pricing</span>
  </button>
);
