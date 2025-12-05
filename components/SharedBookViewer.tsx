import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    BookOpen, ChevronLeft, ChevronRight, Share2, Download, 
    User, Clock, ArrowLeft, Sparkles, X, Lock, AlertCircle
} from 'lucide-react';
import { BookProject } from '../types';
import { shareService, ShareLink, ShareSettings } from '../services/shareService';

interface SharedBookViewerProps {
    shortCode?: string;
    onClose?: () => void;
}

const SharedBookViewer: React.FC<SharedBookViewerProps> = ({ shortCode: propShortCode, onClose }) => {
    // Get shortCode from URL params or props
    const params = useParams<{ shortCode: string }>();
    const navigate = useNavigate();
    const shortCode = propShortCode || params.shortCode || '';
    
    const [book, setBook] = useState<BookProject | null>(null);
    const [pendingBook, setPendingBook] = useState<BookProject | null>(null);
    const [shareInfo, setShareInfo] = useState<{ settings: ShareSettings, sharerName: string, shareId: string } | null>(null);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [passwordInput, setPasswordInput] = useState('');
    const [isPasswordRequired, setIsPasswordRequired] = useState(false);
    const [isPasswordCorrect, setIsPasswordCorrect] = useState(false);

    // Handle close - navigate to home if no onClose provided
    const handleClose = () => {
        if (onClose) {
            onClose();
        } else {
            navigate('/');
        }
    };

    useEffect(() => {
        if (shortCode) {
            loadSharedBook();
        }
    }, [shortCode]);

    const loadSharedBook = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await shareService.getSharedBook(shortCode);

            if (!result) {
                setError('This shared link is invalid or has expired.');
                setIsLoading(false);
                return;
            }

            const { book, settings, sharerName, shareId } = result;

            // Check expiration
            if (settings.expiresAt && new Date(settings.expiresAt) < new Date()) {
                setError('This shared link has expired.');
                setIsLoading(false);
                return;
            }

            // Check password
            if (settings.password && !isPasswordCorrect) {
                setIsPasswordRequired(true);
                setShareInfo({ settings, sharerName, shareId });
                setPendingBook(book);
                setIsLoading(false);
                return;
            }

            setBook(book);
            setShareInfo({ settings, sharerName, shareId });

            // Increment view count
            shareService.incrementViewCount(shareId);

        } catch (err) {
            console.error(err);
            setError('Failed to load shared book. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (shareInfo && shareInfo.settings.password === passwordInput) {
            setIsPasswordCorrect(true);
            setIsPasswordRequired(false);
            if (pendingBook) {
                setBook(pendingBook);
                setPendingBook(null);
                // Increment view count now that they have access
                shareService.incrementViewCount(shareInfo.shareId);
            }
        } else {
            alert('Incorrect password');
        }
    };

    const handleDownload = () => {
        if (!book) return;
        
        const element = document.createElement("a");
        const file = new Blob([JSON.stringify(book, null, 2)], {type: 'application/json'});
        element.href = URL.createObjectURL(file);
        element.download = `${book.title.replace(/\s+/g, '-')}.json`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 flex items-center justify-center z-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-coral-burst mx-auto mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400">Loading shared book...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Unable to View Book</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
                    <button
                        onClick={handleClose}
                        className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium hover:opacity-90 transition-opacity"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    if (isPasswordRequired) {
        return (
            <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-8 h-8 text-amber-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">Password Protected</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 text-center">
                        This book is password protected. Please enter the password to view it.
                    </p>
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <input
                            type="password"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder="Enter password"
                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-coral-burst bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="w-full py-3 bg-coral-burst text-white rounded-xl font-medium hover:bg-coral-burst/90 transition-colors"
                        >
                            Unlock Book
                        </button>
                    </form>
                    <button
                        onClick={handleClose}
                        className="w-full mt-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    if (!book) return null;

    const pages = book.pages || [];
    const currentPage = pages[currentPageIndex];

    const nextPage = () => {
        if (currentPageIndex < pages.length - 1) {
            setCurrentPageIndex(prev => prev + 1);
        }
    };

    const prevPage = () => {
        if (currentPageIndex > 0) {
            setCurrentPageIndex(prev => prev - 1);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-gray-100 dark:bg-gray-900 flex flex-col">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                    <div>
                        <h1 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-coral-burst" />
                            {book.title}
                        </h1>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                by {shareInfo?.sharerName || 'Unknown Author'}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {pages.length} pages
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {shareInfo?.settings.allowDownload && (
                        <button 
                            onClick={handleDownload}
                            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
                            title="Download Book"
                        >
                            <Download className="w-5 h-5" />
                            <span className="hidden sm:inline text-sm">Download</span>
                        </button>
                    )}
                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>
                    <a 
                        href="/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-coral-burst/10 text-coral-burst rounded-lg hover:bg-coral-burst/20 transition-colors text-sm font-medium"
                    >
                        <Sparkles className="w-4 h-4" />
                        Create Your Own
                    </a>
                </div>
            </div>

            {/* Book Content */}
            <div className="flex-1 overflow-hidden relative flex items-center justify-center p-4 sm:p-8">
                <div className="w-full max-w-5xl h-full flex flex-col">
                    {/* Page Viewer */}
                    <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden relative flex flex-col md:flex-row">
                        {/* Image Section */}
                        <div className="w-full md:w-1/2 h-1/2 md:h-full bg-gray-100 dark:bg-gray-900 relative">
                            {currentPage?.imageUrl ? (
                                <img 
                                    src={currentPage.imageUrl} 
                                    alt={`Page ${currentPageIndex + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <div className="text-center">
                                        <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                        <p>No image available</p>
                                    </div>
                                </div>
                            )}
                            
                            {/* Page Number Badge */}
                            <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">
                                {currentPageIndex + 1} / {pages.length}
                            </div>
                        </div>

                        {/* Text Section */}
                        <div className="w-full md:w-1/2 h-1/2 md:h-full p-8 md:p-12 overflow-y-auto flex flex-col justify-center">
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-lg md:text-xl leading-relaxed text-gray-800 dark:text-gray-200 font-serif whitespace-pre-wrap">
                                    {currentPage?.content}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Controls */}
                    <div className="flex justify-between items-center mt-6 px-4">
                        <button
                            onClick={prevPage}
                            disabled={currentPageIndex === 0}
                            className={`
                                flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
                                ${currentPageIndex === 0
                                    ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg hover:shadow-xl hover:-translate-y-1'
                                }
                            `}
                        >
                            <ChevronLeft className="w-5 h-5" />
                            Previous
                        </button>

                        {/* Progress Dots */}
                        <div className="flex gap-2">
                            {pages.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentPageIndex(idx)}
                                    className={`
                                        w-2.5 h-2.5 rounded-full transition-all
                                        ${idx === currentPageIndex 
                                            ? 'bg-coral-burst w-8' 
                                            : 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400'
                                        }
                                    `}
                                />
                            ))}
                        </div>

                        <button
                            onClick={nextPage}
                            disabled={currentPageIndex === pages.length - 1}
                            className={`
                                flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
                                ${currentPageIndex === pages.length - 1
                                    ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg hover:shadow-xl hover:-translate-y-1'
                                }
                            `}
                        >
                            Next
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SharedBookViewer;
