import React from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { getAllPosts } from '../../lib/blog/posts';
import { usePageSEO } from '../../hooks/usePageSEO';
import BlogCard from './BlogCard';

const BASE_URL = 'https://iamazeyou.me';

/* ── Searchable-inspired design tokens ── */
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

const BlogIndex: React.FC = () => {
  const posts = getAllPosts();

  usePageSEO({
    title: 'Blog | Genesis — AI Visual Storytelling',
    description:
      'Insights on AI visual storytelling, market trends, product updates, and the creator economy from the team building Genesis.',
    canonical: '/blog',
    ogTitle: 'Genesis Blog — AI Visual Storytelling Insights',
    ogDescription:
      'Insights on AI storytelling, market trends, product updates, and the creator economy from the team behind Genesis.',
  });

  React.useEffect(() => {
    const id = 'blog-index-jsonld';
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement('script');
      el.id = id;
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'Genesis Blog',
      description: 'Insights on AI visual storytelling, market trends, and the creator economy.',
      url: `${BASE_URL}/blog`,
      publisher: { '@type': 'Organization', name: 'Genesis', url: BASE_URL },
      blogPost: posts.map((p) => ({
        '@type': 'BlogPosting',
        headline: p.title,
        url: `${BASE_URL}/blog/${p.slug}`,
        datePublished: p.date,
        author: { '@type': 'Person', name: p.author },
        description: p.excerpt,
        keywords: p.tags.join(', '),
      })),
    });
    return () => { document.getElementById(id)?.remove(); };
  }, [posts]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: S.bg, color: S.text, fontFamily: S.fontSans }}>

      {/* ── Nav ── */}
      <header
        className="sticky top-0 z-40 w-full border-b backdrop-blur-md"
        style={{ backgroundColor: 'rgba(250,250,249,0.85)', borderColor: S.border }}
      >
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-70"
              style={{ color: S.textMuted, fontFamily: S.fontSans }}
              aria-label="Back to Genesis"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Genesis</span>
            </Link>

            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: S.border }} aria-hidden="true" />

            <Link
              to="/blog"
              className="text-base font-normal tracking-tight"
              style={{ fontFamily: S.fontSerif, color: S.text, fontSize: '1.25rem' }}
              aria-label="Genesis Blog"
            >
              Genesis Blog
            </Link>
          </div>

          <a
            href="/welcome"
            className="inline-flex items-center px-5 sm:px-6 py-2 rounded-full text-sm font-medium transition-all hover:shadow-lg hover:-translate-y-0.5"
            style={{ backgroundColor: S.accent, color: '#fff', fontFamily: S.fontSans, boxShadow: '0 4px 14px rgba(193, 95, 60, 0.2)' }}
          >
            Try Free
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        className="border-b"
        style={{ borderColor: S.border, backgroundColor: S.surface }}
      >
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: S.accent, fontFamily: S.fontSans }}
          >
            {posts.length} {posts.length === 1 ? 'Article' : 'Articles'}
          </p>
          <h1
            className="leading-tight mb-4"
            style={{
              fontFamily: S.fontSerif,
              color: S.text,
              fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            Genesis Blog
          </h1>
          <p
            className="text-lg leading-relaxed max-w-xl"
            style={{ color: S.textMuted, fontFamily: S.fontSans }}
          >
            Insights on AI visual storytelling, market trends, product updates, and the creator
            economy — from the team building Genesis.
          </p>
        </div>
      </section>

      {/* ── Posts ── */}
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
        {posts.length === 0 ? (
          <p className="text-center py-24" style={{ color: S.textMuted }}>No posts yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer
        className="border-t py-12 text-center text-sm"
        style={{ borderColor: S.border, color: S.textMuted, fontFamily: S.fontSans, backgroundColor: S.surface }}
      >
        <div className="max-w-5xl mx-auto px-5">
          <p>
            © 2026{' '}
            <a href={BASE_URL} className="underline underline-offset-4 transition-colors hover:text-black" style={{ color: S.accent }}>Genesis</a>
            {' '}— AI Visual Storytelling Platform
          </p>
        </div>
      </footer>
    </div>
  );
};

export default BlogIndex;

