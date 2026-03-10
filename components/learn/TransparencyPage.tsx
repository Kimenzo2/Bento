import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Globe, BarChart3, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Search, Shield, FileText, Activity } from 'lucide-react';
import { getPublicReports, type WeeklyReport } from '../../data/transparencyReports';
import { usePageSEO } from '../../hooks/usePageSEO';

const BASE_URL = 'https://iamazeyou.me';

const S = {
  bg: '#FAFAF9',
  surface: '#FFFFFF',
  text: '#1C1917',
  textMuted: '#78716C',
  border: '#E7E5E4',
  accent: '#C15F3C',
  accentBg: '#FDF3EE',
  green: '#059669',
  greenBg: '#ECFDF5',
  red: '#DC2626',
  yellow: '#D97706',
  yellowBg: '#FFFBEB',
  fontSerif: '"Instrument Serif", Georgia, serif',
  fontSans: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
} as const;

function formatWeek(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={radius} fill="none" stroke={S.border} strokeWidth="6" />
        <circle
          cx="38" cy="38" r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 38 38)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="38" y="42" textAnchor="middle" fontSize="18" fontWeight="600" fill={S.text}>{score}</text>
      </svg>
      <p className="text-xs font-medium" style={{ color: S.textMuted }}>{label}</p>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    positive: { bg: S.greenBg, color: S.green, label: 'Positive' },
    neutral: { bg: '#F5F5F4', color: S.textMuted, label: 'Neutral' },
    negative: { bg: '#FEF2F2', color: S.red, label: 'Negative' },
    'not mentioned': { bg: '#F5F5F4', color: S.textMuted, label: 'Not mentioned' },
  };
  const s = map[sentiment] || map.neutral;
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function CollapsibleSection({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-t" style={{ borderColor: S.border }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 sm:p-8 text-left hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <h3 className="text-sm font-semibold" style={{ color: S.text }}>{title}</h3>
        </div>
        {open ? <ChevronUp className="w-4 h-4" style={{ color: S.textMuted }} /> : <ChevronDown className="w-4 h-4" style={{ color: S.textMuted }} />}
      </button>
      {open && <div className="px-6 sm:px-8 pb-6 sm:pb-8">{children}</div>}
    </div>
  );
}

function ReportCard({ report }: { report: WeeklyReport }) {
  const mentionedCount = report.trackedPrompts?.filter(p => p.brandMentioned).length ?? 0;
  const totalPrompts = report.trackedPrompts?.length ?? 0;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: S.border, backgroundColor: S.surface }}>
      {/* Report header */}
      <div className="p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: S.accent }}>
          Week of {formatWeek(report.weekEnding)}
        </p>
        <h2 className="text-xl sm:text-2xl font-semibold mb-2" style={{ fontFamily: S.fontSerif, fontWeight: 400 }}>
          {report.headline}
        </h2>
        <p className="leading-relaxed" style={{ color: S.textMuted }}>{report.summary}</p>
      </div>

      {/* Metrics strip */}
      <div className="border-t border-b px-6 sm:px-8 py-4 flex flex-wrap gap-6" style={{ borderColor: S.border, backgroundColor: S.bg }}>
        {report.metrics.shareOfVoice != null && (
          <div>
            <p className="text-lg font-semibold" style={{ color: S.text }}>{report.metrics.shareOfVoice}%</p>
            <p className="text-xs" style={{ color: S.textMuted }}>Share of Voice</p>
          </div>
        )}
        {report.metrics.aiMentions != null && (
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" style={{ color: S.accent }} />
            <div>
              <p className="text-lg font-semibold" style={{ color: S.text }}>{report.metrics.aiMentions}</p>
              <p className="text-xs" style={{ color: S.textMuted }}>AI Mentions</p>
            </div>
            {report.metrics.aiMentionsChange != null && report.metrics.aiMentionsChange !== 0 && (
              <span className="text-xs font-medium flex items-center gap-0.5" style={{ color: report.metrics.aiMentionsChange > 0 ? S.green : S.red }}>
                {report.metrics.aiMentionsChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {report.metrics.aiMentionsChange > 0 ? '+' : ''}{report.metrics.aiMentionsChange}%
              </span>
            )}
          </div>
        )}
        {report.metrics.organicClicks != null && (
          <div>
            <p className="text-lg font-semibold" style={{ color: S.text }}>{report.metrics.organicClicks}</p>
            <p className="text-xs" style={{ color: S.textMuted }}>Organic Clicks</p>
          </div>
        )}
        {report.metrics.topQueryRanked && (
          <div>
            <p className="text-sm font-medium" style={{ color: S.text }}>"{report.metrics.topQueryRanked}"</p>
            <p className="text-xs" style={{ color: S.textMuted }}>Top Query</p>
          </div>
        )}
        {report.metrics.citedByEngines && report.metrics.citedByEngines.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {report.metrics.citedByEngines.map(engine => (
              <span key={engine} className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: S.accentBg, color: S.accent }}>{engine}</span>
            ))}
            <p className="text-xs ml-1" style={{ color: S.textMuted }}>Cited by</p>
          </div>
        )}
      </div>

      {/* Highlights */}
      <div className="p-6 sm:p-8">
        <h3 className="text-sm font-semibold mb-3" style={{ color: S.text }}>Highlights</h3>
        <ul className="space-y-2">
          {report.highlights.map((h, j) => (
            <li key={j} className="flex items-start gap-2 text-sm leading-relaxed" style={{ color: S.textMuted }}>
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: S.accent }} />
              {h}
            </li>
          ))}
        </ul>
      </div>

      {/* Site Audit Scores */}
      {report.siteAudit && (
        <CollapsibleSection
          title={`Site Audit — ${report.siteAudit.pagesAudited} pages audited`}
          icon={<Shield className="w-4 h-4" style={{ color: S.accent }} />}
          defaultOpen
        >
          <div className="flex flex-wrap gap-8 mb-6">
            <ScoreRing score={report.siteAudit.aeoScore} label="AEO Score" color={report.siteAudit.aeoScore >= 80 ? S.green : report.siteAudit.aeoScore >= 50 ? S.yellow : S.red} />
            <ScoreRing score={report.siteAudit.contentScore} label="Content" color={report.siteAudit.contentScore >= 80 ? S.green : report.siteAudit.contentScore >= 50 ? S.yellow : S.red} />
            <ScoreRing score={report.siteAudit.technicalScore} label="Technical" color={report.siteAudit.technicalScore >= 80 ? S.green : report.siteAudit.technicalScore >= 50 ? S.yellow : S.red} />
          </div>
          {report.siteAudit.issues.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: S.textMuted }}>Issues Found</p>
              <div className="space-y-2">
                {report.siteAudit.issues.map((issue, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm p-3 rounded-lg" style={{ backgroundColor: S.bg }}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: issue.severity === 'critical' || issue.severity === 'high' ? S.red : S.yellow }} />
                    <span style={{ color: S.text }}>{issue.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full ml-auto flex-shrink-0" style={{ backgroundColor: S.yellowBg, color: S.yellow }}>
                      {issue.severity}
                    </span>
                    <span className="text-xs" style={{ color: S.textMuted }}>{issue.pagesAffected} page{issue.pagesAffected !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Tracked Prompts */}
      {report.trackedPrompts && report.trackedPrompts.length > 0 && (
        <CollapsibleSection
          title={`Tracked Prompts — ${mentionedCount}/${totalPrompts} mentioned Genesis`}
          icon={<Search className="w-4 h-4" style={{ color: S.accent }} />}
          defaultOpen
        >
          <div className="space-y-2">
            {report.trackedPrompts.map((prompt, i) => (
              <div key={i} className="flex items-start gap-3 text-sm p-3 rounded-lg" style={{ backgroundColor: S.bg }}>
                {prompt.brandMentioned
                  ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: S.green }} />
                  : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: S.red }} />
                }
                <span className="flex-1" style={{ color: S.text }}>{prompt.query}</span>
                <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: S.accentBg, color: S.accent }}>
                  {prompt.intent}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Engine Sentiment */}
      {report.engineSentiment && report.engineSentiment.length > 0 && (
        <CollapsibleSection
          title={`AI Engine Sentiment — ${report.enginesMonitored?.length ?? 0} engines`}
          icon={<Activity className="w-4 h-4" style={{ color: S.accent }} />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {report.engineSentiment.map((es, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: S.bg }}>
                <span className="text-sm font-medium" style={{ color: S.text }}>{es.engine}</span>
                <SentimentBadge sentiment={es.sentiment} />
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Top Competitors */}
      {report.topCompetitors && report.topCompetitors.length > 0 && (
        <CollapsibleSection
          title={`Competitive Landscape — ${report.topCompetitors.filter(c => c.isDirect).length} direct competitors`}
          icon={<FileText className="w-4 h-4" style={{ color: S.accent }} />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {report.topCompetitors.filter(c => c.isDirect).map((comp, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg text-sm" style={{ backgroundColor: S.bg }}>
                <span className="font-medium" style={{ color: S.text }}>{comp.name}</span>
                <span style={{ color: S.textMuted }}>{comp.domain}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Source link */}
      {report.sourceUrl && (
        <div className="border-t px-6 sm:px-8 py-4 flex items-center justify-between" style={{ borderColor: S.border, backgroundColor: S.bg }}>
          <p className="text-xs" style={{ color: S.textMuted }}>Data sourced from Searchable</p>
          <a
            href={report.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-70"
            style={{ color: S.accent }}
          >
            View on Searchable <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

const TransparencyPage: React.FC = () => {
  const reports = getPublicReports();

  usePageSEO({
    title: 'Transparency — Genesis AI Search Performance',
    description: 'Weekly reports on how Genesis performs in AI search engines including ChatGPT, Perplexity, and Google AI Overviews.',
    canonical: '/transparency',
    ogTitle: 'Transparency — Genesis AI Search Performance',
    ogDescription: 'Weekly AI search visibility reports from Genesis. Published every Monday.',
  });

  React.useEffect(() => {
    const id = 'transparency-jsonld';
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement('script');
      el.id = id;
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Transparency — Genesis AI Search Performance',
      description: 'Weekly reports on how Genesis performs in AI search engines.',
      url: `${BASE_URL}/transparency`,
      publisher: { '@type': 'Organization', name: 'Genesis', url: BASE_URL },
    });
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: S.bg, color: S.text, fontFamily: S.fontSans }}>

      {/* Nav */}
      <header className="sticky top-0 z-40 w-full border-b backdrop-blur-md" style={{ backgroundColor: 'rgba(250,250,249,0.85)', borderColor: S.border }}>
        <div className="max-w-4xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/" className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-70" style={{ color: S.textMuted }}>
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Genesis</span>
            </Link>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: S.border }} />
            <span className="text-base font-normal tracking-tight" style={{ fontFamily: S.fontSerif, color: S.text, fontSize: '1.25rem' }}>
              Transparency
            </span>
          </div>
          <a
            href="/welcome"
            className="inline-flex items-center px-5 sm:px-6 py-2 rounded-full text-sm font-medium transition-all hover:shadow-lg hover:-translate-y-0.5"
            style={{ backgroundColor: S.accent, color: '#fff', boxShadow: '0 4px 14px rgba(193, 95, 60, 0.2)' }}
          >
            Try Free
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b" style={{ borderColor: S.border, backgroundColor: S.surface }}>
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5" style={{ color: S.accent }} />
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: S.accent }}>Weekly Reports</p>
          </div>
          <h1 className="leading-tight mb-4" style={{ fontFamily: S.fontSerif, fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', fontWeight: 400, letterSpacing: '-0.01em' }}>
            Genesis Transparency
          </h1>
          <p className="text-lg leading-relaxed max-w-xl" style={{ color: S.textMuted }}>
            Weekly AI search visibility reports &mdash; published every Monday. We track how Genesis appears in ChatGPT, Perplexity, Google AI Overviews, and organic search.
          </p>
        </div>
      </section>

      {/* Reports */}
      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
        {reports.length === 0 ? (
          <div className="text-center py-24 rounded-xl border" style={{ borderColor: S.border, backgroundColor: S.surface }}>
            <BarChart3 className="w-10 h-10 mx-auto mb-4" style={{ color: S.border }} />
            <p className="text-lg font-medium mb-2" style={{ color: S.text }}>Reports publish every Monday</p>
            <p style={{ color: S.textMuted }}>Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {reports.map(report => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-12 text-center text-sm" style={{ borderColor: S.border, color: S.textMuted, backgroundColor: S.bg }}>
        <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-center gap-4">
          <p>&copy; 2026 <a href={BASE_URL} className="underline underline-offset-4 transition-colors hover:text-black" style={{ color: S.accent }}>Genesis</a> &mdash; AI Visual Storytelling Platform</p>
          <span className="hidden sm:inline" style={{ color: S.border }}>&middot;</span>
          <div className="flex gap-4">
            <Link to="/learn" className="hover:underline" style={{ color: S.textMuted }}>Learn</Link>
            <Link to="/blog" className="hover:underline" style={{ color: S.textMuted }}>Blog</Link>
            <Link to="/legal/privacy" className="hover:underline" style={{ color: S.textMuted }}>Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TransparencyPage;
