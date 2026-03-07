import React from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { type BlogPost, formatDate } from '../../lib/blog/posts';

interface BlogCardProps {
  post: BlogPost;
}

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

const BlogCard: React.FC<BlogCardProps> = ({ post }) => {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group block transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ backgroundColor: S.surface }}
      aria-label={`Read: ${post.title}`}
    >
      {/* Cover strip */}
      <div
        className="w-full h-2"
        style={{ background: post.coverGradient }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="p-6 sm:p-7 flex flex-col gap-3">
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {post.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: S.accentBg,
                color: S.accent,
                fontFamily: S.fontSans,
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        <h2
          className="leading-snug line-clamp-3 group-hover:underline underline-offset-2 decoration-1"
          style={{
            fontFamily: S.fontSerif,
            color: S.text,
            fontSize: '1.2rem',
            fontWeight: 400,
            lineHeight: '1.4',
          }}
        >
          {post.title}
        </h2>

        <p
          className="text-sm leading-relaxed line-clamp-3"
          style={{ fontFamily: S.fontSans, color: S.textMuted }}
        >
          {post.excerpt}
        </p>

        <div
          className="flex items-center gap-3 text-xs pt-2 border-t"
          style={{ color: S.textMuted, borderColor: S.border, fontFamily: S.fontSans }}
        >
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" aria-hidden="true" />
            {post.readingTime} min
          </span>
          <span className="ml-auto text-xs font-medium" style={{ color: S.accent }}>Read →</span>
        </div>
      </div>
    </Link>
  );
};

export default BlogCard;
