import React from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import {
  getArticleBySlug,
  getRelatedArticles,
  LEARN_CATEGORIES,
  type LearnArticle,
} from '../../data/learnContent';
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

const CATEGORY_COLORS: Record<string, string> = {
  'for-teachers': '#2563EB',
  'for-parents': '#7C3AED',
  'for-creators': '#C15F3C',
  'for-developers': '#059669',
  'how-it-works': '#D97706',
  'ai-explained': '#6366F1',
  publishing: '#0891B2',
  'character-design': '#DB2777',
};

function readTime(article: LearnArticle): number {
  const text = [
    article.openAnswer,
    article.whyItMatters,
    article.howGenesisSolves,
    ...(article.steps?.map((s) => s.description) ?? []),
    ...article.faqs.map((f) => `${f.question} ${f.answer}`),
  ].join(' ');
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const LearnArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const article = getArticleBySlug(slug ?? '');

  if (!article) return <Navigate to="/learn" replace />;

  const catInfo = LEARN_CATEGORIES[article.category];
  const catColor = CATEGORY_COLORS[article.category] ?? S.accent;
  const related = getRelatedArticles(article);
  const mins = readTime(article);

  // SEO meta
  usePageSEO({
    title: `${article.metaTitle} | Genesis`,
    description: article.metaDescription,
    canonical: `/learn/${article.slug}`,
    ogTitle: article.metaTitle,
    ogDescription: article.metaDescription,
  });

  // JSON-LD: Article + FAQPage
  React.useEffect(() => {
    const articleId = 'learn-article-jsonld';
    const faqId = 'learn-faq-jsonld';

    function injectJsonLd(id: string, data: object) {
      let el = document.getElementById(id) as HTMLScriptElement | null;
      if (!el) {
        el = document.createElement('script');
        el.id = id;
        el.type = 'application/ld+json';
        document.head.appendChild(el);
      }
      el.textContent = JSON.stringify(data);
    }

    injectJsonLd(articleId, {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.metaDescription,
      url: `${BASE_URL}/learn/${article.slug}`,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt ?? article.publishedAt,
      publisher: { '@type': 'Organization', name: 'Genesis', url: BASE_URL },
    });

    injectJsonLd(faqId, {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: article.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    });

    return () => {
      document.getElementById(articleId)?.remove();
      document.getElementById(faqId)?.remove();
    };
  }, [article]);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: S.bg, color: S.text, fontFamily: S.fontSans }}
    >
      {/* Nav */}
      <header
        className="sticky top-0 z-40 w-full border-b backdrop-blur-md"
        style={{ backgroundColor: 'rgba(250,250,249,0.85)', borderColor: S.border }}
      >
        <div className="max-w-3xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              to="/learn"
              className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-70"
              style={{ color: S.textMuted }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Learn</span>
            </Link>
            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: S.border }} />
            <span
              className="text-base font-normal tracking-tight"
              style={{ fontFamily: S.fontSerif, color: S.text, fontSize: '1.25rem' }}
            >
              Genesis Learn
            </span>
          </div>
          <a
            href="/welcome"
            className="inline-flex items-center px-5 sm:px-6 py-2 rounded-full text-sm font-medium transition-all hover:shadow-lg hover:-translate-y-0.5"
            style={{
              backgroundColor: S.accent,
              color: '#fff',
              boxShadow: '0 4px 14px rgba(193, 95, 60, 0.2)',
            }}
          >
            Try Free
          </a>
        </div>
      </header>

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="border-b"
        style={{ borderColor: S.border, backgroundColor: S.surface }}
      >
        <div
          className="max-w-3xl mx-auto px-5 sm:px-8 py-3 flex items-center gap-1.5 text-xs"
          style={{ color: S.textMuted }}
        >
          <Link to="/" className="hover:underline">
            Home
          </Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/learn" className="hover:underline">
            Learn
          </Link>
          <ChevronRight className="w-3 h-3" />
          <Link to={`/learn?category=${article.category}`} className="hover:underline">
            {catInfo.label}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="truncate max-w-[200px]" style={{ color: S.text }}>
            {article.title}
          </span>
        </div>
      </nav>

      {/* Article */}
      <article className="max-w-3xl mx-auto px-5 sm:px-8 py-12 sm:py-16">
        {/* Header */}
        <span
          className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-4"
          style={{ backgroundColor: `${catColor}14`, color: catColor }}
        >
          {catInfo.icon} {catInfo.label}
        </span>
        <h1
          className="leading-tight mb-4"
          style={{
            fontFamily: S.fontSerif,
            fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
            fontWeight: 400,
            letterSpacing: '-0.01em',
          }}
        >
          {article.title}
        </h1>
        <div className="flex items-center gap-3 text-sm mb-8" style={{ color: S.textMuted }}>
          <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
          <span style={{ color: S.border }}>&middot;</span>
          <span>{mins} min read</span>
        </div>

        {/* Open Answer — MOST IMPORTANT for AEO */}
        <div
          className="rounded-lg p-5 sm:p-6 mb-10 border-l-4"
          style={{ backgroundColor: S.accentBg, borderLeftColor: S.accent }}
        >
          <p className="text-base leading-relaxed" style={{ color: S.text }}>
            {article.openAnswer}
          </p>
        </div>

        {/* Why It Matters */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3" style={{ color: S.text }}>
            Why It Matters
          </h2>
          <p className="leading-relaxed" style={{ color: S.text }}>
            {article.whyItMatters}
          </p>
        </section>

        {/* How Genesis Solves This */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3" style={{ color: S.text }}>
            How Genesis Solves This
          </h2>
          <p className="leading-relaxed" style={{ color: S.text }}>
            {article.howGenesisSolves}
          </p>
        </section>

        {/* Steps */}
        {article.steps && article.steps.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4" style={{ color: S.text }}>
              Step by Step
            </h2>
            <ol className="space-y-4">
              {article.steps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold"
                    style={{ backgroundColor: S.accentBg, color: S.accent }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold mb-0.5" style={{ color: S.text }}>
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: S.textMuted }}>
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* FAQs */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4" style={{ color: S.text }}>
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {article.faqs.map((faq, i) => (
              <details
                key={i}
                className="rounded-lg border p-4 group"
                style={{ borderColor: S.border, backgroundColor: S.surface }}
                open={i === 0}
              >
                <summary
                  className="font-medium cursor-pointer list-none flex items-center justify-between"
                  style={{ color: S.text }}
                >
                  <span>{faq.question}</span>
                  <ChevronRight
                    className="w-4 h-4 transition-transform group-open:rotate-90"
                    style={{ color: S.textMuted }}
                  />
                </summary>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: S.textMuted }}>
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Related */}
        {related.length > 0 && (
          <section className="mb-10 border-t pt-10" style={{ borderColor: S.border }}>
            <h2 className="text-xl font-semibold mb-4" style={{ color: S.text }}>
              Related Guides
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {related.slice(0, 3).map((r) => {
                const rCat = LEARN_CATEGORIES[r.category];
                const rColor = CATEGORY_COLORS[r.category] ?? S.accent;
                return (
                  <Link
                    key={r.slug}
                    to={`/learn/${r.slug}`}
                    className="rounded-lg border p-4 transition-all hover:-translate-y-0.5"
                    style={{ borderColor: S.border, backgroundColor: S.surface }}
                  >
                    <span
                      className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2"
                      style={{ backgroundColor: `${rColor}14`, color: rColor }}
                    >
                      {rCat.icon} {rCat.label}
                    </span>
                    <h3
                      className="text-sm font-semibold leading-snug hover:underline"
                      style={{ color: S.text }}
                    >
                      {r.title}
                    </h3>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="rounded-xl p-8 text-center" style={{ backgroundColor: S.accentBg }}>
          <h2 className="text-xl mb-2" style={{ fontFamily: S.fontSerif, fontWeight: 400 }}>
            Ready to try Genesis?
          </h2>
          <p className="text-sm mb-5" style={{ color: S.textMuted }}>
            No account needed to preview.
          </p>
          <a
            href="/welcome"
            className="inline-flex items-center px-8 py-3 rounded-full text-sm font-medium transition-all hover:shadow-lg hover:-translate-y-0.5"
            style={{
              backgroundColor: S.accent,
              color: '#fff',
              boxShadow: '0 4px 14px rgba(193, 95, 60, 0.2)',
            }}
          >
            Start Free
          </a>
        </section>
      </article>

      {/* Footer */}
      <footer
        className="border-t py-12 text-center text-sm"
        style={{ borderColor: S.border, color: S.textMuted, backgroundColor: S.bg }}
      >
        <div className="max-w-5xl mx-auto px-5">
          <p>
            &copy; 2026{' '}
            <a
              href={BASE_URL}
              className="underline underline-offset-4 transition-colors hover:text-black"
              style={{ color: S.accent }}
            >
              Genesis
            </a>{' '}
            &mdash; AI Visual Storytelling Platform
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LearnArticlePage;
