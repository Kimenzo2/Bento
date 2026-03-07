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
      fontFamily: 'var(--font-heading)',
      color: 'var(--color-text, #5a5a5a)',
      scrollMarginTop: '80px',
    };
    if (level === 2) {
      Object.assign(styles, { fontSize: '1.6rem', fontWeight: 700, marginTop: '2.5rem', marginBottom: '0.75rem', lineHeight: 1.3 });
    } else if (level === 3) {
      Object.assign(styles, { fontSize: '1.2rem', fontWeight: 700, marginTop: '2rem', marginBottom: '0.5rem', lineHeight: 1.4 });
    } else {
      Object.assign(styles, { fontSize: '1.05rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.4rem' });
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

  /* Redirect 404 */
  if (!post) return <Navigate to="/blog" replace />;

  const headings = extractHeadings(post.content);
  const canonicalUrl = `/blog/${post.slug}`;
  const fullUrl = `${BASE_URL}${canonicalUrl}`;

  /* SEO */
  // eslint-disable-next-line react-hooks/rules-of-hooks
  usePageSEO({
    title: `${post.title} | Genesis Blog`,
    description: post.excerpt,
    canonical: canonicalUrl,
    ogTitle: post.title,
    ogDescription: post.excerpt,
  });

  /* Reading progress bar */
  // eslint-disable-next-line react-hooks/rules-of-hooks
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
  // eslint-disable-next-line react-hooks/rules-of-hooks
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
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
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
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, text: post.excerpt, url: fullUrl });
      } else {
        await navigator.clipboard.writeText(fullUrl);
        // Simple visual feedback — no toast dependency needed
        alert('Link copied to clipboard!');
      }
    } catch {
      /* user cancelled share — ignore */
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--color-background, #FFF8E7)',
        color: 'var(--color-text, #5a5a5a)',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* ─── Reading progress bar ─── */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 z-50 h-1 transition-all duration-100"
        style={{
          width: `${readingProgress}%`,
          background:
            'linear-gradient(90deg, var(--color-primary-start, #FF9B71), var(--color-primary-end, #FFD93D))',
        }}
      />

      {/* ─── Sticky article nav ─── */}
      <header
        className="sticky top-0 z-40 w-full border-b backdrop-blur-md"
        style={{
          backgroundColor: 'var(--color-background, #FFF8E7)',
          borderColor: 'var(--color-border, #FFE4CC)',
          opacity: 0.97,
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link
            to="/blog"
            className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70 shrink-0 focus-visible:outline-none focus-visible:ring-2 rounded"
            style={{ color: 'var(--color-text-light, #8b7e74)' }}
            aria-label="Back to blog"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">All Posts</span>
          </Link>

          {/* Breadcrumb — hidden on very small screens */}
          <nav
            aria-label="Breadcrumb"
            className="hidden md:flex items-center gap-1.5 text-xs overflow-hidden"
            style={{ color: 'var(--color-text-light, #8b7e74)' }}
          >
            <Link to="/" className="hover:opacity-70 transition-opacity whitespace-nowrap">Genesis</Link>
            <ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />
            <Link to="/blog" className="hover:opacity-70 transition-opacity whitespace-nowrap">Blog</Link>
            <ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="truncate max-w-[160px]" style={{ color: 'var(--color-text, #5a5a5a)' }}>
              {post.title}
            </span>
          </nav>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 shrink-0"
            style={{
              color: 'var(--color-primary-start, #FF9B71)',
              borderColor: 'var(--color-primary-start, #FF9B71)',
            }}
            aria-label="Share this article"
          >
            <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <div
        className="w-full py-16 sm:py-20 px-4 sm:px-6"
        style={{ background: post.coverGradient }}
        role="banner"
      >
        <div className="max-w-3xl mx-auto">
          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-5" role="list" aria-label="Post tags">
            {post.tags.map((tag) => (
              <span
                key={tag}
                role="listitem"
                className="px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.22)',
                  color: '#fff',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6"
            style={{
              fontFamily: 'var(--font-heading)',
              color: '#fff',
              textShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }}
          >
            {post.title}
          </h1>

          {/* Meta row */}
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
            style={{ color: 'rgba(255,255,255,0.88)', fontFamily: 'var(--font-body)' }}
          >
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
              By <strong>{post.author}</strong>
              {post.authorRole ? `, ${post.authorRole}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Body: article + sidebar TOC ─── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 flex gap-10 items-start">
        {/* Main article */}
        <article
          ref={articleRef}
          className="min-w-0 flex-1"
          aria-label="Article content"
        >
          {/* Excerpt / lead */}
          <p
            className="text-lg sm:text-xl leading-relaxed mb-10 pb-8 border-b font-medium"
            style={{
              color: 'var(--color-text, #5a5a5a)',
              borderColor: 'var(--color-border, #FFE4CC)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {post.excerpt}
          </p>

          {/* Markdown body */}
          <div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: HeadingRenderer(2),
                h3: HeadingRenderer(3),
                h4: HeadingRenderer(4),
                p({ children }) {
                  return (
                    <p
                      style={{
                        marginBottom: '1.25rem',
                        lineHeight: '1.8',
                        fontSize: '1.0625rem',
                        color: 'var(--color-text, #5a5a5a)',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {children}
                    </p>
                  );
                },
                strong({ children }) {
                  return (
                    <strong
                      style={{
                        fontWeight: 700,
                        color: 'var(--color-text, #5a5a5a)',
                      }}
                    >
                      {children}
                    </strong>
                  );
                },
                em({ children }) {
                  return (
                    <em style={{ fontStyle: 'italic', color: 'var(--color-text-light, #8b7e74)' }}>
                      {children}
                    </em>
                  );
                },
                blockquote({ children }) {
                  return (
                    <blockquote
                      style={{
                        borderLeft: '4px solid var(--color-primary-start, #FF9B71)',
                        paddingLeft: '1.25rem',
                        margin: '1.75rem 0',
                        color: 'var(--color-text-light, #8b7e74)',
                        fontStyle: 'italic',
                        fontSize: '1.0625rem',
                        lineHeight: '1.75',
                      }}
                    >
                      {children}
                    </blockquote>
                  );
                },
                ul({ children }) {
                  return (
                    <ul
                      style={{
                        margin: '0.75rem 0 1.25rem 1.5rem',
                        listStyleType: 'disc',
                        lineHeight: '1.8',
                        color: 'var(--color-text, #5a5a5a)',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {children}
                    </ul>
                  );
                },
                ol({ children }) {
                  return (
                    <ol
                      style={{
                        margin: '0.75rem 0 1.25rem 1.5rem',
                        listStyleType: 'decimal',
                        lineHeight: '1.8',
                        color: 'var(--color-text, #5a5a5a)',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {children}
                    </ol>
                  );
                },
                li({ children }) {
                  return (
                    <li style={{ marginBottom: '0.35rem', fontSize: '1.0625rem' }}>{children}</li>
                  );
                },
                a({ href, children }) {
                  const isExternal = href?.startsWith('http');
                  return (
                    <a
                      href={href}
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noopener noreferrer' : undefined}
                      style={{
                        color: 'var(--color-primary-start, #FF9B71)',
                        textDecoration: 'underline',
                        textUnderlineOffset: '3px',
                      }}
                    >
                      {children}
                      {isExternal && (
                        <ExternalLink
                          className="inline-block w-3 h-3 ml-0.5 align-baseline"
                          aria-label="(opens in new tab)"
                        />
                      )}
                    </a>
                  );
                },
                hr() {
                  return (
                    <hr
                      style={{
                        margin: '2.5rem 0',
                        borderColor: 'var(--color-border, #FFE4CC)',
                      }}
                    />
                  );
                },
                /* GFM Tables */
                table({ children }) {
                  return (
                    <div style={{ overflowX: 'auto', margin: '1.5rem 0' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: '0.9375rem',
                          fontFamily: 'var(--font-body)',
                          color: 'var(--color-text, #5a5a5a)',
                        }}
                      >
                        {children}
                      </table>
                    </div>
                  );
                },
                thead({ children }) {
                  return (
                    <thead
                      style={{
                        backgroundColor: 'var(--color-surface, #fff)',
                        borderBottom: '2px solid var(--color-border, #FFE4CC)',
                      }}
                    >
                      {children}
                    </thead>
                  );
                },
                th({ children }) {
                  return (
                    <th
                      style={{
                        padding: '0.6rem 1rem',
                        textAlign: 'left',
                        fontWeight: 700,
                        color: 'var(--color-text, #5a5a5a)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {children}
                    </th>
                  );
                },
                td({ children }) {
                  return (
                    <td
                      style={{
                        padding: '0.6rem 1rem',
                        borderBottom: '1px solid var(--color-border, #FFE4CC)',
                        verticalAlign: 'top',
                      }}
                    >
                      {children}
                    </td>
                  );
                },
                tr({ children }) {
                  return (
                    <tr
                      style={{
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          'var(--color-surface, #fff)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      {children}
                    </tr>
                  );
                },
                code({ children, className }) {
                  const isBlock = className?.includes('language-');
                  if (isBlock) {
                    return (
                      <pre
                        style={{
                          backgroundColor: 'var(--color-surface, #fff)',
                          border: '1px solid var(--color-border, #FFE4CC)',
                          borderRadius: '0.75rem',
                          padding: '1.25rem',
                          overflowX: 'auto',
                          margin: '1.5rem 0',
                          fontSize: '0.875rem',
                          lineHeight: '1.65',
                          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                          color: 'var(--color-text, #5a5a5a)',
                        }}
                      >
                        <code>{children}</code>
                      </pre>
                    );
                  }
                  return (
                    <code
                      style={{
                        backgroundColor: 'var(--color-surface, #fff)',
                        border: '1px solid var(--color-border, #FFE4CC)',
                        borderRadius: '4px',
                        padding: '0.15em 0.4em',
                        fontSize: '0.875em',
                        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                        color: 'var(--color-primary-start, #FF9B71)',
                      }}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>

          {/* ─── Author card ─── */}
          <div
            className="mt-12 pt-8 border-t flex items-start gap-4 sm:gap-5"
            style={{ borderColor: 'var(--color-border, #FFE4CC)' }}
          >
            <div
              className="w-14 h-14 rounded-full shrink-0 flex items-center justify-center text-xl font-bold text-white"
              style={{
                background:
                  'linear-gradient(135deg, var(--color-primary-start, #FF9B71), var(--color-primary-end, #FFD93D))',
                fontFamily: 'var(--font-heading)',
              }}
              aria-hidden="true"
            >
              {post.author.charAt(0)}
            </div>
            <div>
              <p
                className="text-sm font-semibold mb-0.5"
                style={{ color: 'var(--color-text, #5a5a5a)', fontFamily: 'var(--font-heading)' }}
              >
                {post.author}
              </p>
              {post.authorRole && (
                <p
                  className="text-xs mb-2"
                  style={{ color: 'var(--color-text-light, #8b7e74)' }}
                >
                  {post.authorRole}
                </p>
              )}
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-light, #8b7e74)' }}>
                Building Genesis — an AI visual storytelling platform for creators who want a finished
                story, not a pile of disconnected images.
              </p>
            </div>
          </div>

          {/* ─── CTA ─── */}
          <div
            className="mt-10 rounded-2xl p-6 sm:p-8 border text-center"
            style={{
              backgroundColor: 'var(--color-surface, #fff)',
              borderColor: 'var(--color-border, #FFE4CC)',
            }}
          >
            <h3
              className="text-xl sm:text-2xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text, #5a5a5a)' }}
            >
              Try Genesis Free
            </h3>
            <p
              className="text-sm mb-5"
              style={{ color: 'var(--color-text-light, #8b7e74)' }}
            >
              Choose a realm. Meet Gen. Create your first illustrated story — no prompt engineering
              required.
            </p>
            <a
              href="https://iamazeyou.me/welcome"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
              style={{
                background:
                  'linear-gradient(90deg, var(--color-primary-start, #FF9B71), var(--color-primary-end, #FFD93D))',
                fontFamily: 'var(--font-body)',
              }}
            >
              Start with Spark (Free)
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>

          {/* ─── Post nav ─── */}
          <div className="mt-8">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-primary-start, #FF9B71)' }}
            >
              <ArrowLeft className="w-4 h-4" />
              All Posts
            </Link>
          </div>
        </article>

        {/* ─── Sticky TOC sidebar (desktop only) ─── */}
        {headings.length > 0 && (
          <aside
            className="hidden xl:block w-60 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto"
            aria-label="Table of contents"
          >
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ color: 'var(--color-text-light, #8b7e74)', fontFamily: 'var(--font-body)' }}
            >
              Contents
            </p>
            <nav>
              <ul className="space-y-1" role="list">
                {headings.map(({ id, text, level }) => (
                  <li key={id} role="listitem">
                    <a
                      href={`#${id}`}
                      className="block py-1 text-sm leading-snug transition-colors duration-150 rounded focus-visible:outline-none focus-visible:ring-1"
                      style={{
                        paddingLeft: level === 3 ? '1rem' : '0',
                        color:
                          activeHeading === id
                            ? 'var(--color-primary-start, #FF9B71)'
                            : 'var(--color-text-light, #8b7e74)',
                        fontWeight: activeHeading === id ? 600 : 400,
                        fontFamily: 'var(--font-body)',
                        fontSize: level === 3 ? '0.8125rem' : '0.875rem',
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

      {/* ─── Footer ─── */}
      <footer
        className="border-t py-8 text-center text-sm mt-6"
        style={{
          borderColor: 'var(--color-border, #FFE4CC)',
          color: 'var(--color-text-light, #8b7e74)',
          fontFamily: 'var(--font-body)',
        }}
      >
        <p>
          © 2026{' '}
          <a
            href={BASE_URL}
            className="underline underline-offset-2 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-primary-start, #FF9B71)' }}
          >
            Genesis
          </a>{' '}
          — AI Visual Storytelling Platform
        </p>
      </footer>
    </div>
  );
};

export default BlogPost;
