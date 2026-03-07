import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { type BlogPost, formatDate } from '../../lib/blog/posts';

interface BlogCardProps {
  post: BlogPost;
}

const BlogCard: React.FC<BlogCardProps> = ({ post }) => {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group block rounded-2xl overflow-hidden border transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        backgroundColor: 'var(--color-surface, #ffffff)',
        borderColor: 'var(--color-border, #FFE4CC)',
        boxShadow: '0 2px 8px rgba(var(--color-shadow, 255,155,113), 0.08)',
      }}
      aria-label={`Read: ${post.title}`}
    >
      {/* Cover gradient */}
      <div
        className="w-full h-44 sm:h-48 flex items-end p-4"
        style={{ background: post.coverGradient }}
      >
        <div className="flex flex-wrap gap-1.5">
          {post.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold backdrop-blur-sm"
              style={{
                backgroundColor: 'rgba(0,0,0,0.25)',
                color: '#fff',
                fontFamily: 'var(--font-body)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col gap-3">
        <h2
          className="text-lg sm:text-xl font-bold leading-snug line-clamp-3 group-hover:opacity-80 transition-opacity"
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'var(--color-text, #5a5a5a)',
          }}
        >
          {post.title}
        </h2>

        <p
          className="text-sm leading-relaxed line-clamp-3"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-light, #8b7e74)',
          }}
        >
          {post.excerpt}
        </p>

        {/* Footer */}
        <div
          className="flex items-center justify-between mt-1 pt-3 border-t"
          style={{ borderColor: 'var(--color-border, #FFE4CC)' }}
        >
          <div
            className="flex items-center gap-3 text-xs"
            style={{ color: 'var(--color-text-light, #8b7e74)', fontFamily: 'var(--font-body)' }}
          >
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" aria-hidden="true" />
              {post.readingTime} min read
            </span>
          </div>
          <span
            className="flex items-center gap-1 text-xs font-semibold transition-gap group-hover:gap-2"
            style={{ color: 'var(--color-primary-start, #FF9B71)', fontFamily: 'var(--font-body)' }}
            aria-hidden="true"
          >
            Read
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
};

export default BlogCard;
