import { IcoBook, IcoPen } from './IconscoutIcons';
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Clock, Download, Lock, User } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { shareService, type ShareSettings } from '../services/shareService';
import type { BookProject, Page } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SharedBookViewerProps {
  shortCode?: string;
  onClose?: () => void;
}

const SharedBookViewer: React.FC<SharedBookViewerProps> = ({
  shortCode: propShortCode,
  onClose,
}) => {
  // Get shortCode from URL params or props
  const params = useParams<{ shortCode: string }>();
  const navigate = useNavigate();
  const shortCode = propShortCode || params.shortCode || '';

  const [book, setBook] = useState<BookProject | null>(null);
  const [pendingBook, setPendingBook] = useState<BookProject | null>(null);
  const [shareInfo, setShareInfo] = useState<{
    settings: ShareSettings;
    sharerName: string;
    shareId: string;
  } | null>(null);
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

  const loadSharedBook = useCallback(async () => {
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
  }, [shortCode, isPasswordCorrect]);

  useEffect(() => {
    if (shortCode) {
      loadSharedBook();
    }
  }, [shortCode, loadSharedBook]);

  const [_passwordError, setPasswordError] = useState<string | null>(null);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    // TODO: SECURITY — Password verification should be server-side.
    // Currently the password is sent to the client. Move to a Supabase RPC
    // that accepts (shareId, password) and returns the book only if correct.
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
      setPasswordError('Incorrect password. Please try again.');
    }
  };

  const handleDownload = () => {
    if (!book) return;

    const element = document.createElement('a');
    const file = new Blob([JSON.stringify(book, null, 2)], { type: 'application/json' });
    element.href = URL.createObjectURL(file);
    element.download = `${book.title.replace(/\s+/g, '-')}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-surface/50  flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-coral-burst mx-auto mb-4"></div>
          <p className="text-cocoa-light ">Loading shared book...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-surface/50  flex items-center justify-center z-50 p-4">
        <div className="bg-surface  p-8 rounded-2xl border border-peach-soft max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100  rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-charcoal-soft  mb-2">
            Unable to View Book
          </h2>
          <p className="text-cocoa-light  mb-6">{error}</p>
          <Button
            variant="default"
            onClick={handleClose}
            className="px-6 py-2 bg-gray-900  text-white  font-medium hover:opacity-90 transition-opacity"
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (isPasswordRequired) {
    return (
      <div className="fixed inset-0 bg-surface/50  flex items-center justify-center z-50 p-4">
        <div className="bg-surface  p-8 rounded-2xl border border-peach-soft max-w-md w-full">
          <div className="w-16 h-16 bg-amber-100  rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-charcoal-soft  mb-2 text-center">
            Password Protected
          </h2>
          <p className="text-cocoa-light  mb-6 text-center">
            This book is password protected. Please enter the password to view it.
          </p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter password"
              className="py-3 border-peach-soft  focus:ring-2 focus:ring-coral-burst bg-surface/50  text-charcoal-soft "
              autoFocus
            />
            <Button
              variant="primary"
              size="lg"
              type="submit"
              className="w-full py-3 bg-coral-burst text-white font-medium hover:bg-coral-burst/90"
            >
              Unlock Book
            </Button>
          </form>
          <Button
            variant="ghost"
            onClick={handleClose}
            className="w-full mt-4 py-2 text-cocoa-light  hover:text-charcoal-soft :text-white"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (!book) return null;

  // Flatten all pages from all chapters
  const pages: Page[] = book.chapters?.flatMap((chapter) => chapter.pages || []) || [];
  const currentPage = pages[currentPageIndex];

  const nextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex((prev) => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-peach-soft/30  flex flex-col">
      {/* Header */}
      <div className="bg-surface  border-b border-peach-soft  px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="p-2 hover:bg-peach-soft/30 :bg-gray-700 rounded-full"
          >
            <ArrowLeft className="w-5 h-5 text-cocoa-light " />
          </Button>
          <div>
            <h1 className="font-bold text-charcoal-soft  flex items-center gap-2">
              <IcoBook className="w-5 h-5 text-coral-burst" />
              {book.title}
            </h1>
            <div className="flex items-center gap-3 text-xs text-cocoa-light ">
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
            <Button
              variant="ghost"
              onClick={handleDownload}
              className="p-2 text-cocoa-light  hover:bg-peach-soft/30 :bg-gray-700 flex"
              title="Download Book"
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline text-sm">Download</span>
            </Button>
          )}
          <div className="h-6 w-px bg-peach-light/50  mx-2"></div>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-coral-burst/10 text-coral-burst rounded-lg hover:bg-coral-burst/20 transition-colors text-sm font-medium"
          >
            <IcoPen className="w-4 h-4" />
            Create Your Own
          </a>
        </div>
      </div>

      {/* Book Content */}
      <div className="flex-1 overflow-hidden relative flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-5xl h-full flex flex-col">
          {/* Page Viewer */}
          <div className="flex-1 bg-surface  rounded-2xl border border-peach-soft overflow-hidden relative flex flex-col md:flex-row">
            {/* Image Section */}
            <div className="w-full md:w-1/2 h-1/2 md:h-full bg-peach-soft/30  relative">
              {currentPage?.imageUrl ? (
                <img
                  src={currentPage.imageUrl}
                  alt={`Page ${currentPageIndex + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-cocoa-light/60">
                  <div className="text-center">
                    <IcoBook className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No image available</p>
                  </div>
                </div>
              )}

              {/* Page Number Badge */}
              <div className="absolute bottom-4 right-4 bg-black/50  text-white px-3 py-1 rounded-full text-sm font-medium">
                {currentPageIndex + 1} / {pages.length}
              </div>
            </div>

            {/* Text Section */}
            <div className="w-full md:w-1/2 h-1/2 md:h-full p-8 md:p-12 overflow-y-auto flex flex-col justify-center">
              <div className="prose  max-w-none">
                <p className="text-lg md:text-xl leading-relaxed text-charcoal-soft  font-serif whitespace-pre-wrap">
                  {currentPage?.text}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex justify-between items-center mt-6 px-4">
            <Button
              variant="outline"
              size="lg"
              onClick={prevPage}
              disabled={currentPageIndex === 0}
              className={`
                                flex px-6 py-3
                                ${
                                  currentPageIndex === 0
                                    ? 'bg-peach-light/50  text-cocoa-light/60 cursor-not-allowed'
                                    : 'bg-surface  text-charcoal-soft  border border-peach-soft hover:border-coral-burst hover:-translate-y-1'
                                }
                            `}
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </Button>

            {/* Progress Dots */}
            <div className="flex gap-2">
              {pages.map((_: Page, idx: number) => (
                <Button
                  variant="ghost"
                  size="icon"
                  key={idx}
                  onClick={() => setCurrentPageIndex(idx)}
                  className={`
                                        w-2.5 h-2.5 rounded-full
                                        ${
                                          idx === currentPageIndex
                                            ? 'bg-coral-burst w-8'
                                            : 'bg-gray-300  hover:bg-gray-400'
                                        }
                                    `}
                />
              ))}
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={nextPage}
              disabled={currentPageIndex === pages.length - 1}
              className={`
                                flex px-6 py-3
                                ${
                                  currentPageIndex === pages.length - 1
                                    ? 'bg-peach-light/50  text-cocoa-light/60 cursor-not-allowed'
                                    : 'bg-surface  text-charcoal-soft  border border-peach-soft hover:border-coral-burst hover:-translate-y-1'
                                }
                            `}
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharedBookViewer;
