import { Calendar, Edit3, Eye, FileText, Share2, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type React from 'react';
import type { SavedBook } from '../types';
import { toast } from './ui/sonner';

interface SavedBookCardProps {
  book: SavedBook;
  onEdit: (book: SavedBook) => void;
  onRead: (book: SavedBook) => void;
  onDelete: (id: string) => void;
  onShare?: (book: SavedBook) => void;
}

const SavedBookCard: React.FC<SavedBookCardProps> = ({
  book,
  onEdit,
  onRead,
  onDelete,
  onShare,
}) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  const pageCount = book.project.chapters.flatMap((c) => c.pages).length;

  return (
    <motion.div
      whileHover={{ scale: 1.015, transition: { duration: 0.2, ease: 'easeOut' } }}
      whileTap={{ scale: 0.98 }}
      className="bg-surface rounded-2xl overflow-hidden transition-all duration-300 border border-peach-soft/50 group outline-none focus:ring-2 focus:ring-coral-burst/50"
      tabIndex={0}
      role="article"
    >
      {/* Cover Image */}
      <div className="relative h-48 bg-linear-to-br from-coral-burst/20 to-gold-sunshine/20 overflow-hidden">
        {book.coverImage ? (
          <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileText className="w-16 h-16 text-coral-burst/30" />
          </div>
        )}

        {/* Hover Overlay - Action Buttons */}
        <div className="absolute inset-0 z-20 bg-black/80 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-300 ease-in-out flex items-center justify-center gap-3  pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto">
          <button
            onClick={() => onEdit(book)}
            className="p-3 bg-surface rounded-full hover:scale-110 active:scale-95 transition-transform border border-peach-soft/50"
            title="Edit"
            aria-label="Edit book"
          >
            <Edit3 className="w-5 h-5 text-coral-burst" />
          </button>
          <button
            onClick={() => onRead(book)}
            className="p-3 bg-surface rounded-full hover:scale-110 active:scale-95 transition-transform border border-peach-soft/50"
            title="Read"
            aria-label="Read book"
          >
            <Eye className="w-5 h-5 text-blue-600" />
          </button>
          {onShare && (
            <button
              onClick={() => onShare(book)}
              className="p-3 bg-surface rounded-full hover:scale-110 active:scale-95 transition-transform border border-peach-soft/50"
              title="Share"
              aria-label="Share book"
            >
              <Share2 className="w-5 h-5 text-green-500" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast(`Delete "${book.title}"?`, {
                description: 'This cannot be undone.',
                action: { label: 'Delete', onClick: () => onDelete(book.id) },
                cancel: { label: 'Cancel', onClick: () => {} },
              });
            }}
            className="p-3 bg-surface rounded-full hover:scale-110 active:scale-95 transition-transform border border-peach-soft/50"
            title="Delete"
            aria-label="Delete book"
          >
            <Trash2 className="w-5 h-5 text-red-600" />
          </button>
        </div>
      </div>

      {/* Book Info */}
      <div className="p-5">
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2 truncate">
          {book.title}
        </h3>
        <p className="text-sm text-cocoa-light line-clamp-2 mb-4 min-h-10">
          {book.synopsis || 'No synopsis available'}
        </p>

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-cocoa-light">
          <div className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            <span>{pageCount} pages</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(book.lastModified)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SavedBookCard;
