import React, { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Search } from 'lucide-react';
import { getAllArticles, searchArticles, LEARN_CATEGORIES, type LearnCategory } from '../../data/learnContent';
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
  fontSerif: '"Instrument Serif", Georgia, serif',
  fontSans: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
} as const;

const CATEGORY_COLORS: Record<LearnCategory, string> = {
  'for-teachers': '#2563EB',
  'for-parents': '#7C3AED',
  'for-creators': '#C15F3C',
  'for-developers': '#059669',
  'how-it-works': '#D97706',
  'ai-explained': '#6366F1',
  'publishing': '#0891B2',
  'character-design': '#DB2777',
};

function readTime(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

const LearnPage: React.FC = () => {
  const allArticles = getAllArticles();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<LearnCategory | 'all'>('all');

  usePageSEO({
    title: 'Learn | Genesis \u2014 AI Visual Storytelling',
    description: 'Guides and answers on AI visual storytelling, children\'s book creation, classroom tools, character design, and publishing with Genesis.',
    canonical: '/learn',
    ogTitle: 'Learn \u2014 Genesis',
    ogDescription: 'AEO content hub for AI visual storytelling, education, publishing, and character design.',
  });

  React.useEffect(() => {
    const id = 'learn-index-jsonld';
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement('script');
      el.id = id;
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Learn \u2014 Genesis',
      description: 'AEO and SEO content hub covering AI visual storytelling, children\'s book creation, classroom tools, and character design.',
      url: `${BASE_URL}/learn`,
      publisher: { '@type': 'Organization', name: 'Genesis', url: BASE_URL },
    });
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  const usedCategories = useMemo(() => {
    const cats = new Set(allArticles.map(a => a.category));
    return (Object.keys(LEARN_CATEGORIES) as LearnCategory[]).filter(c => cats.has(c));
  }, [allArticles]);

  const filtered = useMemo(() => {
    let results = query.trim() ? searchArticles(query) : allArticles;
    if (activeCategory !== 'all') {
      results = results.filter(a => a.category === activeCategory);
    }
    return results;
  }, [query, activeCategory, allArticles]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: S.bg, color: S.text, fontFamily: S.fontSans }}>

      {/* Nav */}
      <header
        className="sticky top-0 z-40 w-full border-b backdrop-blur-md"
        style={{ backgroundColor: 'rgba(250,250,249,0.85)', borderColor: S.border }}
      >
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/" className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-70" style={{ color: S.textMuted }}>
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Genesis</span>
            </Link>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: S.border }} />
            <Link to="/learn" className="text-base font-normal tracking-tight" style={{ fontFamily: S.fontSerif, color: S.text, fontSize: '1.25rem' }}>
              Genesis Learn
            </Link>
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
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: S.accent }}>
            {allArticles.length} {allArticles.length === 1 ? 'Guide' : 'Guides'}
          </p>
          <h1 className="leading-tight mb-4" style={{ fontFamily: S.fontSerif, color: S.text, fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', fontWeight: 400, letterSpacing: '-0.01em' }}>
            Learn
          </h1>
          <p className="text-lg leading-relaxed max-w-xl" style={{ color: S.textMuted }}>
            Answers to the questions people actually ask about AI visual storytelling, classroom tools, publishing, and character design.
          </p>

          {/* Search */}
          <div className="relative mt-8 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: S.textMuted }} />
            <input
              type="text"
              placeholder="Search guides..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm outline-none transition-colors focus:ring-2"
              style={{ borderColor: S.border, backgroundColor: S.surface, fontFamily: S.fontSans, color: S.text }}
            />
          </div>
        </div>
      </section>

      {/* Category tabs */}
      <div className="border-b overflow-x-auto" style={{ borderColor: S.border, backgroundColor: S.surface }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 flex gap-1">
          <button
            onClick={() => setActiveCategory('all')}
            className="px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
            style={{
              borderColor: activeCategory === 'all' ? S.accent : 'transparent',
              color: activeCategory === 'all' ? S.accent : S.textMuted,
            }}
          >
            All
          </button>
          {usedCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
              style={{
                borderColor: activeCategory === cat ? CATEGORY_COLORS[cat] : 'transparent',
                color: activeCategory === cat ? CATEGORY_COLORS[cat] : S.textMuted,
              }}
            >
              {LEARN_CATEGORIES[cat].icon} {LEARN_CATEGORIES[cat].label}
            </button>
          ))}
        </div>
      </div>

      {/* Article grid */}
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
        {filtered.length === 0 ? (
          <p className="text-center py-24" style={{ color: S.textMuted }}>
            {query.trim() ? 'No guides match your search.' : 'No guides in this category yet.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filtered.map(article => {
              const catInfo = LEARN_CATEGORIES[article.category];
              const catColor = CATEGORY_COLORS[article.category];
              const wordCount = [article.openAnswer, article.whyItMatters, article.howGenesisSolves, ...article.faqs.map(f => f.answer)].join(' ');
              const mins = readTime(wordCount);
              return (
                <Link
                  key={article.slug}
                  to={`/learn/${article.slug}`}
                  className="group rounded-xl border p-6 transition-all hover:-translate-y-1"
                  style={{ backgroundColor: S.surface, borderColor: S.border }}
                >
                  <span
                    className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-3"
                    style={{ backgroundColor: `${catColor}14`, color: catColor }}
                  >
                    {catInfo.icon} {catInfo.label}
                  </span>
                  <h3 className="text-base font-semibold leading-snug mb-2 group-hover:underline" style={{ color: S.text }}>
                    {article.title}
                  </h3>
                  <p className="text-sm leading-relaxed mb-3 line-clamp-2" style={{ color: S.textMuted }}>
                    {article.metaDescription}
                  </p>
                  <div className="flex items-center gap-3 text-xs" style={{ color: S.textMuted }}>
                    <span>{mins} min read</span>
                    <span style={{ color: S.border }}>&middot;</span>
                    <span>{article.tags.slice(0, 3).join(', ')}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* CTA */}
      <section className="border-t" style={{ borderColor: S.border, backgroundColor: S.surface }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 text-center">
          <h2 className="text-2xl mb-3" style={{ fontFamily: S.fontSerif, fontWeight: 400 }}>Ready to create your own story?</h2>
          <p className="mb-6" style={{ color: S.textMuted }}>Start free. No account needed to preview.</p>
          <a
            href="/welcome"
            className="inline-flex items-center px-8 py-3 rounded-full text-sm font-medium transition-all hover:shadow-lg hover:-translate-y-0.5"
            style={{ backgroundColor: S.accent, color: '#fff', boxShadow: '0 4px 14px rgba(193, 95, 60, 0.2)' }}
          >
            Start Free
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 text-center text-sm" style={{ borderColor: S.border, color: S.textMuted, backgroundColor: S.bg }}>
        <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-center gap-4">
          <p>&copy; 2026 <a href={BASE_URL} className="underline underline-offset-4 transition-colors hover:text-black" style={{ color: S.accent }}>Genesis</a> &mdash; AI Visual Storytelling Platform</p>
          <span className="hidden sm:inline" style={{ color: S.border }}>&middot;</span>
          <div className="flex gap-4">
            <Link to="/blog" className="hover:underline" style={{ color: S.textMuted }}>Blog</Link>
            <Link to="/transparency" className="hover:underline" style={{ color: S.textMuted }}>Transparency</Link>
            <Link to="/legal/privacy" className="hover:underline" style={{ color: S.textMuted }}>Privacy</Link>
            <Link to="/legal/terms" className="hover:underline" style={{ color: S.textMuted }}>Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LearnPage;
