import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Clock, Calendar, ChevronRight, Share2, ExternalLink } from 'lucide-react';
import {
  getPostBySlug,
  formatDate,
  extractHeadings,
  slugifyHeading,
} from '../../lib/blog/posts';
import { usePageSEO } from '../../hooks/usePageSEO';

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
  fontSans: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
} as const;

/* ─────────────────────────────────────────────────────────────
   Heading renderer: injects stable id so TOC anchor links work
───────────────────────────────────────────────────────────────*/
function HeadingRenderer(level: 2 | 3 | 4) {
  const Tag = `h${level}` as 'h2' | 'h3' | 'h4';
  // eslint-disable-next-line react/display-name
  return function Heading({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    const text = typeof children === 'string' ? children : '';
    const id = slugifyHeading(text);
    const styles: React.CSSProperties = {
      fontFamily: S.fontSerif,
      color: S.text,
      fontWeight: 400,
      scrollMarginTop: '80px',
    };
    if (level === 2) {
      Object.assign(styles, { fontSize: '1.65rem', marginTop: '2.75rem', marginBottom: '0.75rem', lineHeight: 1.25, letterSpacing: '-0.01em' });
    } else if (level === 3) {
      Object.assign(styles, { fontSize: '1.25rem', marginTop: '2rem', marginBottom: '0.5rem', lineHeight: 1.35 });
    } else {
      Object.assign(styles, { fontSize: '1.05rem', fontWeight: 500, marginTop: '1.5rem', marginBottom: '0.4rem' });
    }
    return (
      <Tag id={id} style={styles} {...props}>
        {children}
      </Tag>
    );
  };
}

/* ─────────────────────────────────────────────────────────────
   BlogPost component
───────────────────────────────────────────────────────────────*/
const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;
  const [readingProgress, setReadingProgress] = useState(0);
  const [activeHeading, setActiveHeading] = useState('');
  const articleRef = useRef<HTMLElement>(null);
  const tocObserverRef = useRef<IntersectionObserver | null>(null);

  const headings = post ? extractHeadings(post.content) : [];
  const canonicalUrl = post ? '/blog/' + post.slug : '/blog';
  const fullUrl = BASE_URL + canonicalUrl;
  const seoTitle = post ? post.title + ' | Genesis Blog' : 'Genesis Blog';
  const seoDescription =
    post?.excerpt ?? 'Insights on AI storytelling, product design, and creative workflows from Genesis.';

  /* SEO */
  usePageSEO({
    title: seoTitle,
    description: seoDescription,
    canonical: canonicalUrl,
    ogTitle: post?.title,
    ogDescription: seoDescription,
  });

  /* Reading progress bar */
  useEffect(() => {
    const onScroll = () => {
      const el = articleRef.current;
      if (!el) return;
      const { top, height } = el.getBoundingClientRect();
      const viewH = window.innerHeight;
      const scrolled = Math.max(0, viewH - top);
      const pct = Math.min(100, (scrolled / (height + viewH)) * 100);
      setReadingProgress(pct);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Active TOC heading observer */
  useEffect(() => {
    if (!headings.length) return;
    tocObserverRef.current?.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveHeading(entry.target.id);
        }
      },
      { rootMargin: '-20% 0px -75% 0px' }
    );
    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    tocObserverRef.current = observer;
    return () => observer.disconnect();
  }, [headings]);

  /* JSON-LD BlogPosting schema */
  useEffect(() => {
    if (!post) return;

    const id = `blog-post-jsonld-${post.slug}`;
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement('script');
      el.id = id;
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt,
      url: fullUrl,
      datePublished: post.date,
      dateModified: post.date,
      author: {
        '@type': 'Person',
        name: post.author,
        jobTitle: post.authorRole,
      },
      publisher: {
        '@type': 'Organization',
        name: 'Genesis',
        url: BASE_URL,
        logo: {
          '@type': 'ImageObject',
          url: `${BASE_URL}/genesis-icon.jpg`,
        },
      },
      keywords: post.tags.join(', '),
      timeRequired: `PT${post.readingTime}M`,
      mainEntityOfPage: { '@type': 'WebPage', '@id': fullUrl },
    });
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [post, fullUrl]);

  const handleShare = async () => {
    if (!post) return;

    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, text: post.excerpt, url: fullUrl });
      } else {
        await navigator.clipboard.writeText(fullUrl);
        alert('Link copied to clipboard!');
      }
    } catch {
      /* user cancelled share — ignore */
    }
  };

  if (!post) return <Navigate to="/blog" replace />;

  return (
    <div className="min-h-screen" style={{ backgroundColor: S.bg, color: S.text, fontFamily: S.fontSans }}>

      {/* ── Reading progress bar ── */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 z-50 h-0.5 transition-all duration-100"
        style={{ width: `${readingProgress}%`, backgroundColor: S.accent }}
      />

      {/* ── Sticky nav ── */}
      <header
        className="sticky top-0 z-40 w-full border-b backdrop-blur-md"
        style={{ backgroundColor: 'rgba(250,250,249,0.85)', borderColor: S.border }}
      >
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <Link
              to="/blog"
              className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 shrink-0 focus-visible:outline-none focus-visible:ring-2 rounded-full"
              style={{ color: S.textMuted }}
              aria-label="Back to blog"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">All Posts</span>
            </Link>

            <div className="w-px h-4 hidden sm:block" style={{ backgroundColor: S.border }} aria-hidden="true" />

            <nav
              aria-label="Breadcrumb"
              className="hidden md:flex items-center gap-2 text-xs overflow-hidden"
              style={{ color: S.textMuted }}
            >
              <Link to="/" className="hover:text-black transition-colors whitespace-nowrap">Genesis</Link>
              <ChevronRight className="w-3 h-3 shrink-0 opacity-50" aria-hidden="true" />
              <Link to="/blog" className="hover:text-black transition-colors whitespace-nowrap">Blog</Link>
              <ChevronRight className="w-3 h-3 shrink-0 opacity-50" aria-hidden="true" />
              <span className="truncate max-w-[200px] font-medium" style={{ color: S.text }}>{post.title}</span>
            </nav>
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full transition-all hover:shadow hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 shrink-0"
            style={{ color: S.accent, backgroundColor: S.accentBg }}
            aria-label="Share this article"
          >
            <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="border-b" style={{ borderColor: S.border, backgroundColor: S.surface }}>
        {/* Thin accent bar from post's cover gradient */}
        <div className="w-full h-2" style={{ background: post.coverGradient }} aria-hidden="true" />

        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-14 sm:py-20" role="banner">
          {/* Tags */}
          <div className="flex flex-wrap gap-2.5 mb-6" role="list" aria-label="Post tags">
            {post.tags.map((tag) => (
              <span
                key={tag}
                role="listitem"
                className="px-3 py-1 rounded-full text-[11px] font-medium tracking-wide uppercase"
                style={{ backgroundColor: S.accentBg, color: S.accent, fontFamily: S.fontSans }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1
            className="leading-tight mb-6"
            style={{
              fontFamily: S.fontSerif,
              color: S.text,
              fontSize: 'clamp(1.9rem, 4.5vw, 2.75rem)',
              fontWeight: 400,
              letterSpacing: '-0.015em',
              lineHeight: 1.2,
            }}
          >
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm" style={{ color: S.textMuted }}>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <time dateTime={post.date}>{formatDate(post.date)}</time>
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {post.readingTime} min read
            </span>
            <span aria-hidden="true">·</span>
            <span>
              By <span style={{ color: S.text, fontWeight: 500 }}>{post.author}</span>
              {post.authorRole ? `, ${post.authorRole}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ── Body: article + TOC ── */}
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-16 flex flex-col xl:flex-row gap-12 xl:gap-16 items-start">

        {/* Article */}
        <article ref={articleRef} className="min-w-0 flex-1 max-w-[65ch]" aria-label="Article content">

          {/* Lead / excerpt */}
          <p
            className="leading-relaxed mb-10 pb-8 border-b"
            style={{
              color: S.text,
              borderColor: S.border,
              fontFamily: S.fontSerif,
              fontSize: '1.2rem',
              fontWeight: 400,
              lineHeight: 1.7,
            }}
          >
            {post.excerpt}
          </p>

          {/* Markdown body */}
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: HeadingRenderer(2),
              h3: HeadingRenderer(3),
              h4: HeadingRenderer(4),
              p({ children }) {
                return (
                  <p style={{ marginBottom: '1.35rem', lineHeight: '1.8', fontSize: '1.0625rem', color: S.text, fontFamily: S.fontSans }}>
                    {children}
                  </p>
                );
              },
              strong({ children }) {
                return <strong style={{ fontWeight: 600, color: S.text }}>{children}</strong>;
              },
              em({ children }) {
                return <em style={{ fontStyle: 'italic', color: S.textMuted }}>{children}</em>;
              },
              blockquote({ children }) {
                return (
                  <blockquote
                    style={{
                      borderLeft: `3px solid ${S.accent}`,
                      paddingLeft: '1.25rem',
                      margin: '1.75rem 0',
                      color: S.textMuted,
                      fontFamily: S.fontSerif,
                      fontSize: '1.1rem',
                      lineHeight: '1.75',
                    }}
                  >
                    {children}
                  </blockquote>
                );
              },
              ul({ children }) {
                return (
                  <ul style={{ margin: '0.75rem 0 1.35rem 1.5rem', listStyleType: 'disc', lineHeight: '1.8', color: S.text }}>
                    {children}
                  </ul>
                );
              },
              ol({ children }) {
                return (
                  <ol style={{ margin: '0.75rem 0 1.35rem 1.5rem', listStyleType: 'decimal', lineHeight: '1.8', color: S.text }}>
                    {children}
                  </ol>
                );
              },
              li({ children }) {
                return <li style={{ marginBottom: '0.4rem', fontSize: '1.0625rem' }}>{children}</li>;
              },
              a({ href, children }) {
                const isExternal = href?.startsWith('http');
                return (
                  <a
                    href={href}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    style={{ color: S.accent, textDecoration: 'underline', textUnderlineOffset: '3px' }}
                  >
                    {children}
                    {isExternal && <ExternalLink className="inline-block w-3 h-3 ml-0.5 align-baseline" aria-label="(opens in new tab)" />}
                  </a>
                );
              },
              hr() {
                return <hr style={{ margin: '2.5rem 0', borderColor: S.border }} />;
              },
              table({ children }) {
                return (
                  <div style={{ overflowX: 'auto', margin: '1.5rem 0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9375rem', fontFamily: S.fontSans, color: S.text, border: `1px solid ${S.border}` }}>
                      {children}
                    </table>
                  </div>
                );
              },
              thead({ children }) {
                return <thead style={{ backgroundColor: S.bg, borderBottom: `2px solid ${S.border}` }}>{children}</thead>;
              },
              th({ children }) {
                return <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 600, color: S.text, whiteSpace: 'nowrap', fontFamily: S.fontSans }}>{children}</th>;
              },
              td({ children }) {
                return <td style={{ padding: '0.6rem 1rem', borderBottom: `1px solid ${S.border}`, verticalAlign: 'top' }}>{children}</td>;
              },
              tr({ children }) {
                return (
                  <tr
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = S.bg; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    {children}
                  </tr>
                );
              },
              code({ children, className }) {
                const isBlock = className?.includes('language-');
                if (isBlock) {
                  return (
                    <pre style={{ backgroundColor: S.bg, border: `1px solid ${S.border}`, borderRadius: '8px', padding: '1.25rem', overflowX: 'auto', margin: '1.5rem 0', fontSize: '0.875rem', lineHeight: '1.65', fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: S.text }}>
                      <code>{children}</code>
                    </pre>
                  );
                }
                return (
                  <code style={{ backgroundColor: S.accentBg, borderRadius: '4px', padding: '0.15em 0.4em', fontSize: '0.875em', fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: S.accent }}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {post.content}
          </ReactMarkdown>

          {/* ── Author card ── */}
          <div
            className="mt-12 pt-8 border-t flex items-start gap-4 sm:gap-5"
            style={{ borderColor: S.border }}
          >
            <div
              className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-lg font-semibold text-white"
              style={{ backgroundColor: S.accent }}
              aria-hidden="true"
            >
              {post.author.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: S.text, fontFamily: S.fontSans }}>
                {post.author}
              </p>
              {post.authorRole && (
                <p className="text-xs mb-2" style={{ color: S.textMuted }}>{post.authorRole}</p>
              )}
              <p className="text-sm leading-relaxed" style={{ color: S.textMuted }}>
                Building Genesis — an AI visual storytelling platform for creators who want a finished
                story, not a pile of disconnected images.
              </p>
            </div>
          </div>

          {/* ── CTA ── */}
          <div
            className="mt-12 rounded-2xl p-8 sm:p-10 border text-center transition-shadow"
            style={{ backgroundColor: S.surface, borderColor: S.border, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}
          >
            <h3
              className="mb-3"
              style={{ fontFamily: S.fontSerif, color: S.text, fontSize: '1.6rem', fontWeight: 400 }}
            >
              Try Genesis Free
            </h3>
            <p className="text-[15px] leading-relaxed mb-8 max-w-md mx-auto" style={{ color: S.textMuted }}>
              Choose a realm. Meet Gen. Create your first illustrated story — no prompt engineering required.
            </p>
            <a
              href="https://iamazeyou.me/welcome"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[15px] font-medium text-white transition-all hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2"
              style={{ backgroundColor: S.accent, boxShadow: '0 4px 14px rgba(193, 95, 60, 0.2)' }}
            >
              Start with Spark (Free)
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-10">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-sm transition-opacity hover:opacity-70 px-4 py-2 rounded-full border"
              style={{ color: S.text, borderColor: S.border, backgroundColor: S.surface }}
            >
              <ArrowLeft className="w-4 h-4" />
              All Posts
            </Link>
          </div>
        </article>

        {/* ── Sticky TOC (desktop only) ── */}
        {headings.length > 0 && (
          <aside
            className="hidden xl:block w-72 shrink-0 sticky top-28 self-start max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl p-6"
            style={{
              backgroundColor: S.surface,
              border: `1px solid ${S.border}`,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
            }}
            aria-label="Table of contents"
          >
            <style>{`
              aside::-webkit-scrollbar {
                width: 4px;
              }
              aside::-webkit-scrollbar-track {
                background: transparent;
              }
              aside::-webkit-scrollbar-thumb {
                background-color: ${S.border};
                border-radius: 10px;
              }
              aside:hover::-webkit-scrollbar-thumb {
                background-color: #d6d3d1; /* stone-300 */
              }
            `}</style>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-5"
              style={{ color: S.textMuted, fontFamily: S.fontSans }}
            >
              Contents
            </p>
            <nav>
              <ul className="space-y-1.5" role="list">
                {headings.map(({ id, text, level }) => (
                  <li key={id} role="listitem">
                    <a
                      href={`#${id}`}
                      className="block py-1 text-sm leading-snug transition-colors duration-150 focus-visible:outline-none rounded-r"
                      style={{
                        paddingLeft: level === 3 ? '1.5rem' : '0.75rem',
                        color: activeHeading === id ? S.text : S.textMuted,
                        fontWeight: activeHeading === id ? 500 : 400,
                        fontFamily: S.fontSans,
                        fontSize: level === 3 ? '0.8125rem' : '0.875rem',
                        borderLeft: activeHeading === id ? `2px solid ${S.accent}` : '2px solid transparent',
                        backgroundColor: activeHeading === id ? S.bg : 'transparent',
                      }}
                    >
                      {text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}
      </div>

      {/* ── Footer ── */}
      <footer
        className="border-t py-12 text-center text-sm mt-8"
        style={{ borderColor: S.border, color: S.textMuted, fontFamily: S.fontSans, backgroundColor: S.surface }}
      >
        <div className="max-w-5xl mx-auto px-5">
          <p>
            © 2026{' '}
            <a href={BASE_URL} className="underline underline-offset-4 transition-colors hover:text-black" style={{ color: S.accent }}>
              Genesis
            </a>
            {' '}— AI Visual Storytelling Platform
          </p>
        </div>
      </footer>
    </div>
  );
};

export default BlogPost;
