import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    Image as ImageIcon, 
    BookOpen, 
    BarChart3, 
    Trash2, 
    Download, 
    Eye, 
    Calendar,
    Loader2,
    FolderOpen,
    Sparkles,
    X,
    ZoomIn,
    ZoomOut,
    Maximize2
} from 'lucide-react';
import { getAllBooks, deleteBook } from '../../services/storageService';
import { getAllInfographics, deleteInfographic, getAllImages, deleteImage, SavedInfographic, SavedImage } from '../../services/libraryService';
import { SavedBook } from '../../types';

type LibraryTab = 'books' | 'infographics' | 'images';

interface LibraryPanelProps {
    onViewBook?: (book: SavedBook) => void;
    onNavigate?: (mode: string) => void;
}

const LibraryPanel: React.FC<LibraryPanelProps> = ({ onViewBook, onNavigate }) => {
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
                getAllImages()
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
        if (!confirm('Are you sure you want to delete this book?')) return;
        setDeletingId(id);
        try {
            await deleteBook(id);
            setBooks(prev => prev.filter(b => b.id !== id));
        } catch (error) {
            console.error('Failed to delete book:', error);
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteInfographic = async (id: string) => {
        if (!confirm('Are you sure you want to delete this infographic?')) return;
        setDeletingId(id);
        try {
            await deleteInfographic(id);
            setInfographics(prev => prev.filter(i => i.id !== id));
        } catch (error) {
            console.error('Failed to delete infographic:', error);
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteImage = async (id: string) => {
        if (!confirm('Are you sure you want to delete this image?')) return;
        setDeletingId(id);
        try {
            await deleteImage(id);
            setImages(prev => prev.filter(i => i.id !== id));
        } catch (error) {
            console.error('Failed to delete image:', error);
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const TabButton = ({ id, icon: Icon, label, count }: { id: LibraryTab; icon: any; label: string; count: number }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                activeTab === id
                    ? 'bg-gradient-to-r from-coral-burst to-gold-sunshine text-white shadow-md'
                    : 'bg-cream-soft text-cocoa-light hover:bg-peach-soft/50 hover:text-charcoal-soft'
            }`}
        >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                activeTab === id ? 'bg-white/20' : 'bg-peach-soft'
            }`}>
                {count}
            </span>
        </button>
    );

    const EmptyState = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-cream-soft flex items-center justify-center mb-4">
                <Icon className="w-10 h-10 text-cocoa-light/50" />
            </div>
            <h4 className="font-heading font-bold text-lg text-charcoal-soft mb-2">{title}</h4>
            <p className="text-cocoa-light text-sm max-w-xs">{description}</p>
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-coral-burst animate-spin" />
            </div>
        );
    }

    return (
        <div className="animate-fadeIn space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-heading font-bold text-xl md:text-2xl text-charcoal-soft flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-gold-sunshine" />
                        My Library
                    </h3>
                    <p className="text-cocoa-light text-sm mt-1">Your saved creations in one place</p>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-bold text-charcoal-soft">{books.length + infographics.length + images.length}</p>
                    <p className="text-xs text-cocoa-light">Total Items</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2">
                <TabButton id="books" icon={BookOpen} label="Books" count={books.length} />
                <TabButton id="infographics" icon={BarChart3} label="Infographics" count={infographics.length} />
                <TabButton id="images" icon={ImageIcon} label="Images" count={images.length} />
            </div>

            {/* Content Area */}
            <div className="min-h-[300px]">
                {/* Books Tab */}
                {activeTab === 'books' && (
                    <div className="space-y-4">
                        {books.length === 0 ? (
                            <EmptyState 
                                icon={BookOpen}
                                title="No books yet"
                                description="Create your first storybook and it will appear here"
                            />
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {books.map((book) => (
                                    <div 
                                        key={book.id}
                                        className="group bg-cream-soft rounded-2xl p-4 border border-peach-soft/30 hover:border-coral-burst/30 hover:shadow-lg transition-all cursor-pointer"
                                        onClick={() => onViewBook?.(book)}
                                    >
                                        <div className="flex gap-4">
                                            {/* Cover */}
                                            <div className="w-20 h-28 rounded-xl bg-gradient-to-br from-coral-burst/20 to-gold-sunshine/20 flex-shrink-0 overflow-hidden">
                                                {book.coverImage ? (
                                                    <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <BookOpen className="w-8 h-8 text-coral-burst/50" />
                                                    </div>
                                                )}
                                            </div>
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-heading font-bold text-charcoal-soft truncate">{book.title}</h4>
                                                <p className="text-xs text-cocoa-light mt-1 line-clamp-2">{book.synopsis || 'No description'}</p>
                                                <div className="flex items-center gap-1 mt-2 text-xs text-cocoa-light">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(book.savedAt)}
                                                </div>
                                                {/* Actions */}
                                                <div className="flex gap-2 mt-3">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onViewBook?.(book); }}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-white rounded-lg text-xs font-bold text-coral-burst hover:bg-coral-burst hover:text-white transition-colors"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        View
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteBook(book.id); }}
                                                        disabled={deletingId === book.id}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-white rounded-lg text-xs font-bold text-red-500 hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50"
                                                    >
                                                        {deletingId === book.id ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-3 h-3" />
                                                        )}
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Infographics Tab */}
                {activeTab === 'infographics' && (
                    <div className="space-y-4">
                        {infographics.length === 0 ? (
                            <EmptyState 
                                icon={BarChart3}
                                title="No infographics yet"
                                description="Create an infographic and save it to see it here"
                            />
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {infographics.map((infographic) => (
                                    <div 
                                        key={infographic.id}
                                        className="group bg-cream-soft rounded-2xl p-4 border border-peach-soft/30 hover:border-coral-burst/30 hover:shadow-lg transition-all cursor-pointer"
                                        onClick={() => setViewingInfographic(infographic)}
                                    >
                                        <div className="flex gap-4">
                                            {/* Thumbnail */}
                                            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 flex-shrink-0 flex items-center justify-center">
                                                <BarChart3 className="w-8 h-8 text-purple-500/50" />
                                            </div>
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-heading font-bold text-charcoal-soft truncate">{infographic.title}</h4>
                                                <p className="text-xs text-cocoa-light mt-1">{infographic.topic}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full text-[10px] font-bold uppercase">
                                                        {infographic.type}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 mt-2 text-xs text-cocoa-light">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(infographic.savedAt)}
                                                </div>
                                                {/* Actions */}
                                                <div className="flex gap-2 mt-3">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setViewingInfographic(infographic); }}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-white rounded-lg text-xs font-bold text-purple-600 hover:bg-purple-600 hover:text-white transition-colors"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        View
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteInfographic(infographic.id); }}
                                                        disabled={deletingId === infographic.id}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-white rounded-lg text-xs font-bold text-red-500 hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50"
                                                    >
                                                        {deletingId === infographic.id ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-3 h-3" />
                                                        )}
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Images Tab */}
                {activeTab === 'images' && (
                    <div className="space-y-4">
                        {images.length === 0 ? (
                            <EmptyState 
                                icon={ImageIcon}
                                title="No images yet"
                                description="Save images from Visual Studio to build your collection"
                            />
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {images.map((image) => (
                                    <div 
                                        key={image.id}
                                        className="group relative rounded-2xl overflow-hidden border border-peach-soft/30 hover:border-coral-burst/30 hover:shadow-lg transition-all aspect-square cursor-pointer"
                                        onClick={() => setViewingImage(image)}
                                    >
                                        <img 
                                            src={image.imageUrl} 
                                            alt={image.title} 
                                            className="w-full h-full object-cover"
                                        />
                                        {/* Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                            <p className="text-white text-sm font-bold truncate">{image.title}</p>
                                            <p className="text-white/70 text-xs truncate">{image.prompt}</p>
                                            <div className="flex gap-2 mt-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setViewingImage(image); }}
                                                    className="flex items-center gap-1 px-2 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-xs text-white hover:bg-white/30 transition-colors"
                                                >
                                                    <Eye className="w-3 h-3" />
                                                </button>
                                                <a 
                                                    href={image.imageUrl}
                                                    download={`${image.title}.png`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex items-center gap-1 px-2 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-xs text-white hover:bg-white/30 transition-colors"
                                                >
                                                    <Download className="w-3 h-3" />
                                                </a>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteImage(image.id); }}
                                                    disabled={deletingId === image.id}
                                                    className="flex items-center gap-1 px-2 py-1 bg-red-500/80 backdrop-blur-sm rounded-lg text-xs text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                                                >
                                                    {deletingId === image.id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-3 h-3" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Image Viewer Modal */}
            {viewingImage && createPortal(
                <div 
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center animate-fadeIn"
                    onClick={() => { setViewingImage(null); setImageZoom(1); }}
                >
                    {/* Close button */}
                    <button 
                        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
                        onClick={() => { setViewingImage(null); setImageZoom(1); }}
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* Zoom controls */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 z-10">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setImageZoom(z => Math.max(0.5, z - 0.25)); }}
                            className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
                        >
                            <ZoomOut className="w-5 h-5" />
                        </button>
                        <span className="text-white text-sm font-bold min-w-[60px] text-center">{Math.round(imageZoom * 100)}%</span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setImageZoom(z => Math.min(3, z + 0.25)); }}
                            className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
                        >
                            <ZoomIn className="w-5 h-5" />
                        </button>
                        <div className="w-px h-6 bg-white/30 mx-1"></div>
                        <a 
                            href={viewingImage.imageUrl}
                            download={`${viewingImage.title}.png`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 hover:bg-white/20 rounded-full text-white transition-colors"
                        >
                            <Download className="w-5 h-5" />
                        </a>
                    </div>

                    {/* Image info */}
                    <div className="absolute top-4 left-4 max-w-md z-10">
                        <h3 className="text-white font-bold text-lg">{viewingImage.title}</h3>
                        <p className="text-white/70 text-sm mt-1">{viewingImage.prompt}</p>
                        <p className="text-white/50 text-xs mt-2">{viewingImage.style} • {formatDate(viewingImage.savedAt)}</p>
                    </div>

                    {/* Image */}
                    <div 
                        className="max-w-[90vw] max-h-[80vh] overflow-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img 
                            src={viewingImage.imageUrl} 
                            alt={viewingImage.title}
                            className="rounded-lg shadow-2xl transition-transform duration-300"
                            style={{ transform: `scale(${imageZoom})`, transformOrigin: 'center' }}
                        />
                    </div>
                </div>,
                document.body
            )}

            {/* Infographic Viewer Modal */}
            {viewingInfographic && createPortal(
                <div 
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center animate-fadeIn overflow-auto"
                    onClick={() => setViewingInfographic(null)}
                >
                    {/* Close button */}
                    <button 
                        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
                        onClick={() => setViewingInfographic(null)}
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* Infographic info */}
                    <div className="absolute top-4 left-4 max-w-md z-10">
                        <h3 className="text-white font-bold text-lg">{viewingInfographic.title}</h3>
                        <p className="text-white/70 text-sm mt-1">{viewingInfographic.topic}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 rounded-full text-xs font-bold uppercase">
                                {viewingInfographic.type}
                            </span>
                            <span className="text-white/50 text-xs">{formatDate(viewingInfographic.savedAt)}</span>
                        </div>
                    </div>

                    {/* Content card */}
                    <div 
                        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 my-16 p-8 max-h-[80vh] overflow-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="text-center border-b border-gray-100 pb-6">
                                <h2 className="font-heading font-bold text-2xl text-charcoal-soft">{viewingInfographic.data.title}</h2>
                                <p className="text-cocoa-light mt-2">{viewingInfographic.data.content.intro}</p>
                            </div>

                            {/* Main Points */}
                            {viewingInfographic.data.content.mainPoints && viewingInfographic.data.content.mainPoints.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-lg text-charcoal-soft mb-3">Key Points</h3>
                                    <ul className="space-y-2">
                                        {viewingInfographic.data.content.mainPoints.map((point, idx) => (
                                            <li key={idx} className="flex items-start gap-3">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-coral-burst to-gold-sunshine text-white text-xs font-bold flex items-center justify-center">
                                                    {idx + 1}
                                                </span>
                                                <span className="text-cocoa-light">{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Steps (for process type) */}
                            {viewingInfographic.data.content.steps && viewingInfographic.data.content.steps.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-lg text-charcoal-soft mb-3">Steps</h3>
                                    <div className="space-y-3">
                                        {viewingInfographic.data.content.steps.map((step, idx) => (
                                            <div key={idx} className="flex gap-4 p-4 bg-cream-soft rounded-xl">
                                                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 text-white font-bold flex items-center justify-center">
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

                            {/* Timeline Events */}
                            {viewingInfographic.data.content.timelineEvents && viewingInfographic.data.content.timelineEvents.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-lg text-charcoal-soft mb-3">Timeline</h3>
                                    <div className="relative pl-6 border-l-2 border-purple-200 space-y-4">
                                        {viewingInfographic.data.content.timelineEvents.map((event, idx) => (
                                            <div key={idx} className="relative">
                                                <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-purple-500 border-2 border-white"></div>
                                                <div className="bg-cream-soft rounded-xl p-4">
                                                    <span className="text-xs font-bold text-purple-600">{event.date}</span>
                                                    <h4 className="font-bold text-charcoal-soft mt-1">{event.title}</h4>
                                                    <p className="text-sm text-cocoa-light mt-1">{event.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Fun Fact */}
                            {viewingInfographic.data.content.funFact && (
                                <div className="bg-gradient-to-r from-gold-sunshine/10 to-coral-burst/10 rounded-xl p-4 border border-gold-sunshine/20">
                                    <h3 className="font-bold text-charcoal-soft flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-gold-sunshine" />
                                        Fun Fact
                                    </h3>
                                    <p className="text-cocoa-light mt-2">{viewingInfographic.data.content.funFact}</p>
                                </div>
                            )}

                            {/* Key Term */}
                            {viewingInfographic.data.content.keyTerm && (
                                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                    <h3 className="font-bold text-blue-800">📚 {viewingInfographic.data.content.keyTerm.term}</h3>
                                    <p className="text-blue-700 text-sm mt-1">{viewingInfographic.data.content.keyTerm.definition}</p>
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

export default LibraryPanel;
