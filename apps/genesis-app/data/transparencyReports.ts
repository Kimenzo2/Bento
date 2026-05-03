// data/transparencyReports.ts
// Weekly AI search visibility reports from Searchable.
// Developer adds reports here each week. Set isPublic: true to show publicly.

export interface SiteAudit {
  aeoScore: number;
  contentScore: number;
  technicalScore: number;
  pagesAudited: number;
  issues: {
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    pagesAffected: number;
  }[];
}

export interface TrackedPrompt {
  query: string;
  intent: 'informational' | 'commercial' | 'transactional';
  brandMentioned: boolean;
}

export interface EngineSentiment {
  engine: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'not mentioned';
}

export interface Competitor {
  name: string;
  domain: string;
  isDirect: boolean;
}

export interface WeeklyReport {
  id: string;
  weekEnding: string;
  title: string;
  headline: string;
  summary: string;
  metrics: {
    aiMentions?: number;
    aiMentionsChange?: number;
    organicClicks?: number;
    organicClicksChange?: number;
    shareOfVoice?: number;
    topQueryRanked?: string;
    citedByEngines?: string[];
  };
  highlights: string[];
  siteAudit?: SiteAudit;
  trackedPrompts?: TrackedPrompt[];
  engineSentiment?: EngineSentiment[];
  enginesMonitored?: string[];
  topCompetitors?: Competitor[];
  sourceUrl?: string;
  isPublic: boolean;
}

export const TRANSPARENCY_REPORTS: WeeklyReport[] = [
  {
    id: 'week-2026-10',
    weekEnding: '2026-03-08',
    title: 'Genesis Week 10 — First AI Search Visibility Data',
    headline: 'Genesis appeared in AI search results for the first time this week',
    summary:
      'The first week of tracked AI search visibility for Genesis. Early data shows strong signals for educator and parent-focused queries across ChatGPT and Perplexity.',
    metrics: {
      aiMentions: 12,
      aiMentionsChange: 0,
      organicClicks: 0,
      shareOfVoice: 7.6,
      citedByEngines: [
        'ChatGPT',
        'Perplexity',
        'Google AI Mode',
        'Google AI Overview',
        'Copilot',
        'DeepSeek',
      ],
      topQueryRanked: "AI tools for illustrated children's books",
    },
    highlights: [
      "First appearance in Perplexity for children's book AI query",
      'Cell realm content indexed by Google within 48 hours of publish',
      'Three FAQ answers extracted by ChatGPT from homepage content',
    ],
    siteAudit: {
      aeoScore: 81,
      contentScore: 60,
      technicalScore: 88,
      pagesAudited: 2,
      issues: [
        { title: 'Content-to-code ratio is too low', severity: 'medium', pagesAffected: 1 },
        { title: 'Render-blocking resources detected', severity: 'medium', pagesAffected: 1 },
      ],
    },
    trackedPrompts: [
      {
        query: "iAmAZeYou.me's themed realms for character creation",
        intent: 'informational',
        brandMentioned: true,
      },
      {
        query: 'how does iAmAZeYou.me support character consistency',
        intent: 'informational',
        brandMentioned: true,
      },
      {
        query: 'compare iAmAZeYou.me with other ai storytelling tools',
        intent: 'informational',
        brandMentioned: true,
      },
      {
        query: 'how does iAmAZeYou.me integrate ai in design',
        intent: 'informational',
        brandMentioned: true,
      },
      {
        query: 'iAmAZeYou.me vs storyboardhero.ai for character design',
        intent: 'informational',
        brandMentioned: true,
      },
      {
        query: 'what makes iAmAZeYou.me unique for ai-driven storytelling',
        intent: 'informational',
        brandMentioned: true,
      },
      {
        query: 'how does iAmAZeYou.me enhance character design with ai',
        intent: 'informational',
        brandMentioned: true,
      },
      {
        query: "iAmAZeYou.me's character design capabilities explained",
        intent: 'informational',
        brandMentioned: true,
      },
      {
        query: 'AI visual storytelling platforms with pre-built themed worlds',
        intent: 'informational',
        brandMentioned: true,
      },
      {
        query: 'Compare iamazeyou.me vs other AI visual storytelling tools',
        intent: 'commercial',
        brandMentioned: true,
      },
      {
        query: 'Looking for guided AI tool to create story visuals',
        intent: 'transactional',
        brandMentioned: true,
      },
      {
        query: 'why is my ai character design not saving properly',
        intent: 'informational',
        brandMentioned: true,
      },
      {
        query: 'i want to create characters with iAmAZeYou.me',
        intent: 'transactional',
        brandMentioned: true,
      },
      {
        query: "iAmAZeYou.me's impact on visual storytelling",
        intent: 'informational',
        brandMentioned: true,
      },
    ],
    engineSentiment: [
      { engine: 'ChatGPT', sentiment: 'positive' },
      { engine: 'Copilot', sentiment: 'neutral' },
      { engine: 'DeepSeek', sentiment: 'neutral' },
      { engine: 'Google AI Mode', sentiment: 'positive' },
      { engine: 'Google AI Overview', sentiment: 'positive' },
      { engine: 'Perplexity', sentiment: 'positive' },
    ],
    enginesMonitored: [
      'ChatGPT',
      'Copilot',
      'DeepSeek',
      'Google AI Mode',
      'Google AI Overview',
      'Perplexity',
    ],
    topCompetitors: [
      { name: 'Midjourney', domain: 'midjourney.com', isDirect: true },
      { name: 'Character.AI', domain: 'character.ai', isDirect: true },
      { name: 'Leonardo.ai', domain: 'leonardo.ai', isDirect: true },
      { name: 'Adobe Firefly', domain: 'adobe.com', isDirect: true },
      { name: 'DALL-E 3', domain: 'dalle3.ai', isDirect: true },
      { name: 'LTX', domain: 'ltx.studio', isDirect: true },
      { name: 'Runway', domain: 'runwayml.com', isDirect: true },
      { name: 'OpenArt', domain: 'openart.ai', isDirect: true },
      { name: 'Artbreeder', domain: 'artbreeder.com', isDirect: true },
      { name: 'Shai Creative', domain: 'shaicreative.ai', isDirect: true },
      { name: 'StoryboardHero', domain: 'storyboardhero.ai', isDirect: true },
      { name: 'Boords', domain: 'boords.com', isDirect: true },
      { name: 'NovelAI', domain: 'novelai.net', isDirect: true },
      { name: 'ImagineArt', domain: 'imagine.art', isDirect: true },
    ],
    sourceUrl: 'https://app.searchable.com/share/report/gxBl6fdLS85K',
    isPublic: true,
  },
];

export function getPublicReports(): WeeklyReport[] {
  return TRANSPARENCY_REPORTS.filter((r) => r.isPublic).sort((a, b) =>
    b.weekEnding.localeCompare(a.weekEnding)
  );
}

export function getAllReports(): WeeklyReport[] {
  return [...TRANSPARENCY_REPORTS].sort((a, b) => b.weekEnding.localeCompare(a.weekEnding));
}
