import React from 'react';
import { SavedBook } from '../types';
import { Edit3, Eye, Trash2, Calendar, FileText, Share2 } from 'lucide-react';

interface SavedBookCardProps {
    book: SavedBook;
    onEdit: (book: SavedBook) => void;
    onRead: (book: SavedBook) => void;
    onDelete: (id: string) => void;
    onShare?: (book: SavedBook) => void;
}

const SavedBookCard: React.FC<SavedBookCardProps> = ({ book, onEdit, onRead, onDelete, onShare }) => {
    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }).format(new Date(date));
    };

    const pageCount = book.project.chapters.flatMap(c => c.pages).length;

    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-soft-md hover:shadow-soft-lg transition-all border border-peach-soft/50 group">
            {/* Cover Image */}
            <div className="relative h-48 bg-gradient-to-br from-coral-burst/20 to-gold-sunshine/20 overflow-hidden">
                {book.coverImage ? (
                    <img
                        src={book.coverImage}
                        alt={book.title}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-16 h-16 text-coral-burst/30" />
                    </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-charcoal-soft/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                        onClick={() => onEdit(book)}
                        className="p-3 bg-white rounded-full hover:scale-110 transition-transform shadow-lg"
                        title="Edit"
                    >
                        <Edit3 className="w-5 h-5 text-coral-burst" />
                    </button>
                    <button
                        onClick={() => onRead(book)}
                        className="p-3 bg-white rounded-full hover:scale-110 transition-transform shadow-lg"
                        title="Read"
                    >
                        <Eye className="w-5 h-5 text-blue-600" />
                    </button>
                    {onShare && (
                        <button
                            onClick={() => onShare(book)}
                            className="p-3 bg-white rounded-full hover:scale-110 transition-transform shadow-lg"
                            title="Share"
                        >
                            <Share2 className="w-5 h-5 text-green-500" />
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (window.confirm(`Delete "${book.title}"? This cannot be undone.`)) {
                                onDelete(book.id);
                            }
                        }}
                        className="p-3 bg-white rounded-full hover:scale-110 transition-transform shadow-lg"
                        title="Delete"
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
                <p className="text-sm text-cocoa-light line-clamp-2 mb-4 min-h-[40px]">
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
        </div>
    );
};

export default SavedBookCard;
