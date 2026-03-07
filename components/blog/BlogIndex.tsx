import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Rss } from 'lucide-react';
import { getAllPosts } from '../../lib/blog/posts';
import { usePageSEO } from '../../hooks/usePageSEO';
import BlogCard from './BlogCard';

const BASE_URL = 'https://iamazeyou.me';

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

  /* JSON-LD Blog list schema */
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
      publisher: {
        '@type': 'Organization',
        name: 'Genesis',
        url: BASE_URL,
      },
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
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [posts]);

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--color-background, #FFF8E7)',
        color: 'var(--color-text, #5a5a5a)',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* ─── Top nav bar ─── */}
      <header
        className="sticky top-0 z-40 w-full border-b backdrop-blur-md"
        style={{
          backgroundColor: 'var(--color-background, #FFF8E7)',
          borderColor: 'var(--color-border, #FFE4CC)',
          opacity: 0.97,
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 rounded"
            style={{ color: 'var(--color-text-light, #8b7e74)' }}
            aria-label="Back to Genesis app"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Genesis</span>
          </Link>

          <Link
            to="/blog"
            className="flex items-center gap-2 font-bold text-base tracking-tight"
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'var(--color-text, #5a5a5a)',
            }}
            aria-label="Genesis Blog home"
          >
            <Rss className="w-4 h-4" style={{ color: 'var(--color-primary-start, #FF9B71)' }} />
            Genesis Blog
          </Link>

          <a
            href="/welcome"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
            style={{
              background:
                'linear-gradient(90deg, var(--color-primary-start, #FF9B71), var(--color-primary-end, #FFD93D))',
              color: '#fff',
              fontFamily: 'var(--font-body)',
            }}
          >
            Try Genesis Free
          </a>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-10 sm:pt-20 sm:pb-14">
        <div className="max-w-2xl">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5 border"
            style={{
              color: 'var(--color-primary-start, #FF9B71)',
              borderColor: 'var(--color-primary-start, #FF9B71)',
              backgroundColor: 'transparent',
              fontFamily: 'var(--font-body)',
            }}
          >
            <Rss className="w-3 h-3" aria-hidden="true" />
            {posts.length} {posts.length === 1 ? 'Article' : 'Articles'}
          </div>

          <h1
            className="text-4xl sm:text-5xl font-bold leading-tight mb-4"
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'var(--color-text, #5a5a5a)',
            }}
          >
            Genesis Blog
          </h1>

          <p
            className="text-lg sm:text-xl leading-relaxed"
            style={{
              color: 'var(--color-text-light, #8b7e74)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Insights on AI visual storytelling, market trends, product updates, and the creator
            economy — from the team building Genesis.
          </p>
        </div>
      </section>

      {/* ─── Posts grid ─── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        {posts.length === 0 ? (
          <div
            className="text-center py-24"
            style={{ color: 'var(--color-text-light, #8b7e74)' }}
          >
            <p className="text-lg">No posts yet — check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </main>

      {/* ─── Footer ─── */}
      <footer
        className="border-t py-8 text-center text-sm"
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

export default BlogIndex;
