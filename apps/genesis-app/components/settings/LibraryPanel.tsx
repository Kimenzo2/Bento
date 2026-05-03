import {
  BookOpen,
  BarChart3,
  Calendar,
  Download,
  Eye,
  ImageIcon,
  Lightbulb,
  Loader2,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  Library,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  type SavedImage,
  type SavedInfographic,
  deleteImage,
  deleteInfographic,
  getAllImages,
  getAllInfographics,
} from '../../services/libraryService';
import { deleteBook, getAllBooks } from '../../services/storageService';
import type { SavedBook } from '../../types';
import { Button } from '../ui/button';
import { toast } from '../ui/sonner';

type LibraryTab = 'books' | 'infographics' | 'images';

interface LibraryPanelProps {
  onViewBook?: (book: SavedBook) => void;
  onNavigate?: (mode: string) => void;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({ onViewBook, onNavigate: _onNavigate }) => {
  const [activeTab, setActiveTab] = useState<LibraryTab>('books');
  const [books, setBooks] = useState<SavedBook[]>([]);
  const [infographics, setInfographics] = useState<SavedInfographic[]>([]);
  const [images, setImages] = useState<SavedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Viewer states
  const [viewingInfographic, setViewingInfographic] = useState<SavedInfographic | null>(null);
  const [viewingImage, setViewingImage] = useState<SavedImage | null>(null);
  const [imageZoom, setImageZoom] = useState(1);

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    setIsLoading(true);
    try {
      const [booksData, infographicsData, imagesData] = await Promise.all([
        getAllBooks(),
        getAllInfographics(),
        getAllImages(),
      ]);
      setBooks(booksData);
      setInfographics(infographicsData);
      setImages(imagesData);
    } catch (error) {
      console.error('Failed to load library:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBook = async (id: string) => {
    const book = books.find((b) => b.id === id);
    toast(`Delete "${book?.title || 'this book'}"?`, {
      description: 'This cannot be undone.',
      action: {
        label: 'Delete',
        onClick: async () => {
          setDeletingId(id);
          try {
            await deleteBook(id);
            setBooks((prev) => prev.filter((b) => b.id !== id));
          } catch (error) {
            console.error('Failed to delete book:', error);
          } finally {
            setDeletingId(null);
          }
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  const handleDeleteInfographic = async (id: string) => {
    toast('Delete this infographic?', {
      description: 'This cannot be undone.',
      action: {
        label: 'Delete',
        onClick: async () => {
          setDeletingId(id);
          try {
            await deleteInfographic(id);
            setInfographics((prev) => prev.filter((i) => i.id !== id));
          } catch (error) {
            console.error('Failed to delete infographic:', error);
          } finally {
            setDeletingId(null);
          }
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  const handleDeleteImage = async (id: string) => {
    toast('Delete this image?', {
      description: 'This cannot be undone.',
      action: {
        label: 'Delete',
        onClick: async () => {
          setDeletingId(id);
          try {
            await deleteImage(id);
            setImages((prev) => prev.filter((i) => i.id !== id));
          } catch (error) {
            console.error('Failed to delete image:', error);
          } finally {
            setDeletingId(null);
          }
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const tabs: { id: LibraryTab; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'books', label: 'Books', icon: BookOpen, count: books.length },
    { id: 'infographics', label: 'Infographics', icon: BarChart3, count: infographics.length },
    { id: 'images', label: 'Images', icon: ImageIcon, count: images.length },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-coral-burst animate-spin" />
      </div>
    );
  }

  const totalItems = books.length + infographics.length + images.length;

  return (
    <div className="animate-fadeIn space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-bold text-xl md:text-2xl text-charcoal-soft flex items-center gap-2">
            <Library className="w-6 h-6 text-gold-sunshine" />
            My Library
          </h3>
          <p className="text-cocoa-light text-sm mt-1">Your saved creations in one place</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-charcoal-soft">{totalItems}</p>
          <p className="text-xs text-cocoa-light">Total Items</p>
        </div>
      </div>

      {/* Tab Navigation — segmented control style */}
      <div className="inline-flex bg-cream-soft p-1 rounded-xl border border-peach-soft/50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-surface text-charcoal-soft shadow-sm border border-peach-soft/50'
                  : 'text-cocoa-light hover:text-charcoal-soft'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-xs font-bold ${
                  isActive
                    ? 'bg-coral-burst/10 text-coral-burst'
                    : 'bg-peach-soft/50 text-cocoa-light'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="min-h-75">
        {/* Books Tab */}
        {activeTab === 'books' &&
          (books.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No books yet"
              description="Create your first storybook and it will appear here"
            />
          ) : (
            <div className="space-y-3">
              {books.map((book) => (
                <div
                  key={book.id}
                  className="group flex items-center gap-4 bg-surface rounded-xl p-3 border border-peach-soft/30 hover:border-coral-burst/20 hover:shadow-sm transition-all"
                >
                  {/* Cover thumbnail */}
                  <div className="w-14 h-20 rounded-lg bg-linear-to-br from-coral-burst/10 to-gold-sunshine/10 shrink-0 overflow-hidden border border-peach-soft/30">
                    {book.coverImage ? (
                      <img
                        src={book.coverImage}
                        alt={book.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-coral-burst/40" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-heading font-semibold text-sm text-charcoal-soft truncate">
                      {book.title}
                    </h4>
                    <p className="text-xs text-cocoa-light mt-0.5 line-clamp-1">
                      {book.synopsis || 'No description'}
                    </p>
                    <div className="flex items-center gap-1 mt-1.5 text-[11px] text-cocoa-light/70">
                      <Calendar className="w-3 h-3" />
                      {formatDate(book.savedAt)}
                    </div>
                  </div>

                  {/* Actions — right-aligned, spaced apart */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewBook?.(book);
                      }}
                      className="h-8 w-8 text-cocoa-light hover:text-coral-burst hover:bg-coral-burst/10"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBook(book.id);
                      }}
                      disabled={deletingId === book.id}
                      className="h-8 w-8 text-cocoa-light hover:text-red-500 hover:bg-red-50"
                      title="Delete"
                    >
                      {deletingId === book.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {/* Infographics Tab */}
        {activeTab === 'infographics' &&
          (infographics.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No infographics yet"
              description="Create an infographic and save it to see it here"
            />
          ) : (
            <div className="space-y-3">
              {infographics.map((infographic) => (
                <div
                  key={infographic.id}
                  className="group flex items-center gap-4 bg-surface rounded-xl p-3 border border-peach-soft/30 hover:border-purple-200 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => setViewingInfographic(infographic)}
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-lg bg-linear-to-br from-purple-50 to-blue-50 shrink-0 flex items-center justify-center border border-purple-100">
                    <BarChart3 className="w-6 h-6 text-purple-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-heading font-semibold text-sm text-charcoal-soft truncate">
                      {infographic.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px] font-bold uppercase border border-purple-100">
                        {infographic.type}
                      </span>
                      <span className="text-[11px] text-cocoa-light/70 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(infographic.savedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingInfographic(infographic);
                      }}
                      className="h-8 w-8 text-cocoa-light hover:text-purple-600 hover:bg-purple-50"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteInfographic(infographic.id);
                      }}
                      disabled={deletingId === infographic.id}
                      className="h-8 w-8 text-cocoa-light hover:text-red-500 hover:bg-red-50"
                      title="Delete"
                    >
                      {deletingId === infographic.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {/* Images Tab */}
        {activeTab === 'images' &&
          (images.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="No images yet"
              description="Save images from Visual Studio to build your collection"
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="group relative rounded-xl overflow-hidden border border-peach-soft/30 hover:border-coral-burst/20 hover:shadow-sm transition-all aspect-square cursor-pointer"
                  onClick={() => setViewingImage(image)}
                >
                  <img
                    src={image.imageUrl}
                    alt={image.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Hover overlay with actions */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2.5">
                    <p className="text-white text-xs font-semibold truncate">{image.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingImage(image);
                        }}
                        className="h-7 w-7 bg-white/15 hover:bg-white/25 text-white"
                        title="View"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <a
                        href={image.imageUrl}
                        download={`${image.title}.png`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center h-7 w-7 bg-white/15 hover:bg-white/25 text-white rounded-md transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImage(image.id);
                        }}
                        disabled={deletingId === image.id}
                        className="h-7 w-7 bg-white/15 hover:bg-red-500/80 text-white"
                        title="Delete"
                      >
                        {deletingId === image.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>

      {/* Image Viewer Modal */}
      {viewingImage &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center animate-fadeIn"
            onClick={() => {
              setViewingImage(null);
              setImageZoom(1);
            }}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white z-10"
              onClick={() => {
                setViewingImage(null);
                setImageZoom(1);
              }}
            >
              <X className="w-6 h-6" />
            </Button>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setImageZoom((z) => Math.max(0.5, z - 0.25));
                }}
                className="p-2 hover:bg-white/20 text-white"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>
              <span className="text-white text-sm font-bold min-w-[60px] text-center">
                {Math.round(imageZoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setImageZoom((z) => Math.min(3, z + 0.25));
                }}
                className="p-2 hover:bg-white/20 text-white"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>
              <div className="w-px h-6 bg-white/30 mx-1" />
              <a
                href={viewingImage.imageUrl}
                download={`${viewingImage.title}.png`}
                onClick={(e) => e.stopPropagation()}
                className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
              >
                <Download className="w-5 h-5" />
              </a>
            </div>

            <div className="absolute top-4 left-4 max-w-md z-10">
              <h3 className="text-white font-bold text-lg">{viewingImage.title}</h3>
              <p className="text-white/70 text-sm mt-1">{viewingImage.prompt}</p>
              <p className="text-white/50 text-xs mt-2">
                {viewingImage.style} &middot; {formatDate(viewingImage.savedAt)}
              </p>
            </div>

            <div
              className="max-w-[90vw] max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={viewingImage.imageUrl}
                alt={viewingImage.title}
                className="rounded-lg transition-transform duration-300"
                style={{ transform: `scale(${imageZoom})`, transformOrigin: 'center' }}
              />
            </div>
          </div>,
          document.body
        )}

      {/* Infographic Viewer Modal */}
      {viewingInfographic &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center animate-fadeIn overflow-auto"
            onClick={() => setViewingInfographic(null)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white z-10"
              onClick={() => setViewingInfographic(null)}
            >
              <X className="w-6 h-6" />
            </Button>

            <div className="absolute top-4 left-4 max-w-md z-10">
              <h3 className="text-white font-bold text-lg">{viewingInfographic.title}</h3>
              <p className="text-white/70 text-sm mt-1">{viewingInfographic.topic}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 rounded-full text-xs font-bold uppercase">
                  {viewingInfographic.type}
                </span>
                <span className="text-white/50 text-xs">
                  {formatDate(viewingInfographic.savedAt)}
                </span>
              </div>
            </div>

            <div
              className="bg-surface rounded-2xl border border-peach-soft max-w-3xl w-full mx-4 my-16 p-8 max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-6">
                <div className="text-center border-b border-peach-soft/50 pb-6">
                  <h2 className="font-heading font-bold text-2xl text-charcoal-soft">
                    {viewingInfographic.data.title}
                  </h2>
                  <p className="text-cocoa-light mt-2">{viewingInfographic.data.content.intro}</p>
                </div>

                {viewingInfographic.data.content.mainPoints &&
                  viewingInfographic.data.content.mainPoints.length > 0 && (
                    <div>
                      <h3 className="font-bold text-lg text-charcoal-soft mb-3">Key Points</h3>
                      <ul className="space-y-2">
                        {viewingInfographic.data.content.mainPoints.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-linear-to-r from-coral-burst to-gold-sunshine text-white text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-cocoa-light">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {viewingInfographic.data.content.steps &&
                  viewingInfographic.data.content.steps.length > 0 && (
                    <div>
                      <h3 className="font-bold text-lg text-charcoal-soft mb-3">Steps</h3>
                      <div className="space-y-3">
                        {viewingInfographic.data.content.steps.map((step, idx) => (
                          <div key={idx} className="flex gap-4 p-4 bg-cream-soft rounded-xl">
                            <span className="shrink-0 w-8 h-8 rounded-full bg-purple-500 text-white font-bold flex items-center justify-center">
                              {step.order}
                            </span>
                            <div>
                              <h4 className="font-bold text-charcoal-soft">{step.title}</h4>
                              <p className="text-sm text-cocoa-light mt-1">{step.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {viewingInfographic.data.content.timelineEvents &&
                  viewingInfographic.data.content.timelineEvents.length > 0 && (
                    <div>
                      <h3 className="font-bold text-lg text-charcoal-soft mb-3">Timeline</h3>
                      <div className="relative pl-6 border-l-2 border-purple-200 space-y-4">
                        {viewingInfographic.data.content.timelineEvents.map((event, idx) => (
                          <div key={idx} className="relative">
                            <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-purple-500 border border-white" />
                            <div className="bg-cream-soft rounded-xl p-4">
                              <span className="text-xs font-bold text-purple-600">
                                {event.date}
                              </span>
                              <h4 className="font-bold text-charcoal-soft mt-1">{event.title}</h4>
                              <p className="text-sm text-cocoa-light mt-1">{event.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {viewingInfographic.data.content.funFact && (
                  <div className="bg-linear-to-r from-gold-sunshine/10 to-coral-burst/10 rounded-xl p-4 border border-gold-sunshine/20">
                    <h3 className="font-bold text-charcoal-soft flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-gold-sunshine" />
                      Fun Fact
                    </h3>
                    <p className="text-cocoa-light mt-2">
                      {viewingInfographic.data.content.funFact}
                    </p>
                  </div>
                )}

                {viewingInfographic.data.content.keyTerm && (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <h3 className="font-bold text-blue-800">
                      {viewingInfographic.data.content.keyTerm.term}
                    </h3>
                    <p className="text-blue-700 text-sm mt-1">
                      {viewingInfographic.data.content.keyTerm.definition}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

const EmptyState = ({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-16 h-16 rounded-full bg-peach-soft/30 flex items-center justify-center mb-4">
      <Icon className="w-8 h-8 text-cocoa-light/50" />
    </div>
    <h4 className="font-heading font-semibold text-base text-charcoal-soft mb-1">{title}</h4>
    <p className="text-cocoa-light text-sm max-w-xs">{description}</p>
  </div>
);

export default LibraryPanel;
