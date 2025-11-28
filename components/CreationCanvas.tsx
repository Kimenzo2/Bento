import React, { useState, useEffect } from 'react';
import { Sparkles, Wand2, Palette, BookType, Users, Clock, Briefcase, GitFork, ChevronRight, Star, Leaf, Building2, Rocket } from 'lucide-react';
import { ArtStyle, BookTone, GenerationSettings, BrandProfile, SavedBook, UserTier } from '../types';
import { getAllBooks, deleteBook } from '../services/storageService';
import SavedBookCard from './SavedBookCard';
import { getAvailableStyles, canUseStyle } from '../services/tierLimits';
import InfographicWizard from './infographic/InfographicWizard';

interface CreationCanvasProps {
    onGenerate: (settings: GenerationSettings) => void;
    isGenerating: boolean;
    generationStatus?: string;
    onEditBook?: (book: SavedBook) => void;
    onReadBook?: (book: SavedBook) => void;
    userTier?: UserTier;
}

const CreationCanvas: React.FC<CreationCanvasProps> = ({
    onGenerate,
    isGenerating,
    generationStatus,
    onEditBook,
    onReadBook,
    userTier = UserTier.SPARK
}) => {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState<ArtStyle>(ArtStyle.WATERCOLOR);
    const [tone, setTone] = useState<BookTone>(BookTone.PLAYFUL);
    const [audience, setAudience] = useState('Children 4-6');
    const [pageCount, setPageCount] = useState(10);

    const [isBranching, setIsBranching] = useState(false);
    const [educational, setEducational] = useState(false);
    const [showBrandPanel, setShowBrandPanel] = useState(false);
    const [brandName, setBrandName] = useState('');
    const [brandGuidelines, setBrandGuidelines] = useState('');
    const [brandColors, setBrandColors] = useState('#FF9B71, #FFF4A3');
    const [brandSample, setBrandSample] = useState('');

    // Saved Books
    const [savedBooks, setSavedBooks] = useState<SavedBook[]>([]);
    const [isLoadingBooks, setIsLoadingBooks] = useState(true);

    // Load saved books on mount
    useEffect(() => {
        loadSavedBooks();
    }, []);

    const loadSavedBooks = async () => {
        setIsLoadingBooks(true);
        try {
            const books = await getAllBooks();
            setSavedBooks(books);
        } catch (error) {
            console.error('Failed to load books:', error);
        } finally {
            setIsLoadingBooks(false);
        }
    };

    const handleDeleteBook = async (id: string) => {
        try {
            await deleteBook(id);
            await loadSavedBooks(); // Refresh the list
        } catch (error) {
            console.error('Failed to delete book:', error);
            alert('Failed to delete book. Please try again.');
        }
    };

    const allStyles = Object.values(ArtStyle);
    const availableStyles = getAvailableStyles(userTier);
    const tones = Object.values(BookTone);

    const handleGenerate = () => {
        if (!prompt.trim()) return;

        let brandProfile: BrandProfile | undefined = undefined;
        if (showBrandPanel && brandName) {
            brandProfile = {
                name: brandName,
                guidelines: brandGuidelines,
                colors: brandColors.split(',').map(c => c.trim()),
                sampleText: brandSample
            };
        }

        onGenerate({
            prompt,
            style,
            tone,
            audience,
            pageCount,
            isBranching,
            educational,
            brandProfile
        });
    };

    const [creationMode, setCreationMode] = useState<'book' | 'feature'>('book');

    // Quick Start Card Component
    const QuickStartCard = ({ icon: Icon, title, desc, colorClass, onClick }: any) => (
        <button
            onClick={onClick}
            className="bg-white p-8 rounded-3xl shadow-soft-md hover:shadow-soft-lg hover:-translate-y-2 transition-all duration-300 text-left group flex flex-col h-full border border-transparent hover:border-peach-soft relative overflow-hidden"
        >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorClass} opacity-10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700`}></div>
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colorClass} flex items-center justify-center text-white shadow-md mb-6 group-hover:rotate-12 transition-transform`}>
                <Icon className="w-8 h-8" />
            </div>
            <h3 className="font-heading font-bold text-xl text-charcoal-soft mb-2">{title}</h3>
            <p className="font-body text-cocoa-light text-sm leading-relaxed mb-6 flex-1">{desc}</p>
            <div className="flex items-center text-coral-burst font-heading font-bold text-sm group-hover:gap-2 transition-all">
                Start Creating <ChevronRight className="w-4 h-4" />
            </div>
        </button>
    );

    const handleQuickStartClick = (action: () => void) => {
        setCreationMode('book');
        action();
    };

    return (
        <div className="w-full flex flex-col items-center pb-32 animate-fadeIn">

            {/* Hero Header */}
            <div className="text-center space-y-4 mb-12 mt-8 md:mt-16">
                <h1 className="font-heading font-bold text-5xl md:text-6xl text-charcoal-soft mb-4">
                    Create Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-coral-burst to-gold-sunshine">Masterpiece</span>
                </h1>
                <p className="font-body text-xl text-cocoa-light max-w-2xl mx-auto">
                    Describe your story idea, choose a style, and let Genesis weave a magical tale just for you.
                </p>
            </div>

            {/* Quick Starts */}
            {!prompt && creationMode === 'book' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full px-4 mb-16">
                    <QuickStartCard
                        icon={Star}
                        title="Children's Story"
                        desc="Create a magical tale with vibrant illustrations and moral lessons."
                        colorClass="from-gold-sunshine to-orange-400"
                        onClick={() => handleQuickStartClick(() => {
                            setPrompt("A magical adventure about a shy dragon who loves to bake cookies.");
                            setAudience("Children 4-6");
                            setStyle(ArtStyle.WATERCOLOR);
                        })}
                    />
                    <QuickStartCard
                        icon={Rocket}
                        title="Sci-Fi Novel"
                        desc="Build a futuristic world with deep lore and complex characters."
                        colorClass="from-purple-400 to-coral-burst"
                        onClick={() => handleQuickStartClick(() => {
                            setPrompt("A cyberpunk detective solving crimes in a neon-lit underwater city.");
                            setAudience("Young Adult");
                            setStyle(ArtStyle.CYBERPUNK);
                            setTone(BookTone.DRAMATIC);
                        })}
                    />
                    <QuickStartCard
                        icon={Building2}
                        title="Brand Story"
                        desc="Generate a professional company history or annual report."
                        colorClass="from-mint-breeze to-emerald-400"
                        onClick={() => handleQuickStartClick(() => {
                            setPrompt("Our company journey from a garage startup to a global eco-friendly leader.");
                            setAudience("Stakeholders");
                            setStyle(ArtStyle.CORPORATE);
                            setShowBrandPanel(true);
                        })}
                    />
                </div>
            )}

            {/* Saved Books Section */}
            {savedBooks.length > 0 && !prompt && creationMode === 'book' && (
                <div className="w-full max-w-6xl px-4 mb-16">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="font-heading font-bold text-3xl text-charcoal-soft">My Saved Books</h2>
                            <p className="text-cocoa-light text-sm mt-1">{savedBooks.length} {savedBooks.length === 1 ? 'book' : 'books'} saved</p>
                        </div>
                    </div>

                    {isLoadingBooks ? (
                        <div className="text-center py-12">
                            <div className="inline-block w-8 h-8 border-4 border-coral-burst/30 border-t-coral-burst rounded-full animate-spin"></div>
                            <p className="text-cocoa-light mt-4">Loading your books...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {savedBooks.map((book) => (
                                <SavedBookCard
                                    key={book.id}
                                    book={book}
                                    onEdit={(book) => onEditBook?.(book)}
                                    onRead={(book) => onReadBook?.(book)}
                                    onDelete={handleDeleteBook}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Main Wizard Card */}
            <div className="w-full max-w-4xl px-4">
                <div className="bg-white rounded-[32px] shadow-soft-lg p-8 md:p-12 border border-white/50 relative overflow-hidden">

                    {/* Loading Overlay */}
                    {isGenerating && (
                        <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center animate-fadeIn">
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-coral-burst rounded-full animate-ping opacity-20"></div>
                                <div className="w-20 h-20 bg-gradient-to-br from-coral-burst to-gold-sunshine rounded-full flex items-center justify-center shadow-lg animate-bounce-slow relative z-10">
                                    <Sparkles className="w-10 h-10 text-white animate-pulse" />
                                </div>
                            </div>
                            <h3 className="font-heading font-bold text-2xl text-charcoal-soft mb-2">Weaving Magic...</h3>
                            <p className="text-cocoa-light text-center max-w-md px-4 animate-pulse">
                                {generationStatus || "Crafting your story, characters, and world..."}
                            </p>
                        </div>
                    )}

                    {/* Mode Toggle */}
                    <div className="flex justify-center mb-8">
                        <div className="bg-cream-soft p-1 rounded-full flex items-center shadow-inner">
                            <button
                                onClick={() => setCreationMode('book')}
                                className={`px-6 py-2 rounded-full font-heading font-bold text-sm transition-all ${creationMode === 'book'
                                    ? 'bg-white text-coral-burst shadow-sm'
                                    : 'text-cocoa-light hover:text-charcoal-soft'
                                    }`}
                            >
                                Create Book
                            </button>
                            <button
                                onClick={() => setCreationMode('feature')}
                                className={`px-6 py-2 rounded-full font-heading font-bold text-sm transition-all relative ${creationMode === 'feature'
                                    ? 'bg-white text-coral-burst shadow-sm'
                                    : 'text-cocoa-light hover:text-charcoal-soft'
                                    }`}
                            >
                                Infographics
                                <span className="absolute -top-1 -right-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">BETA</span>
                            </button>
                        </div>
                    </div>

                    {creationMode === 'book' ? (
                        <>

                            <div className="mb-10">
                                <label className="block font-heading font-bold text-lg text-charcoal-soft mb-3 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-gold-sunshine" />
                                    Tell us about your book idea
                                </label>
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Once upon a time, in a land made of candy..."
                                    className="w-full bg-cream-soft border-2 border-peach-soft rounded-3xl p-6 text-lg font-body text-charcoal-soft placeholder-cocoa-light/50 focus:outline-none focus:border-coral-burst focus:ring-4 focus:ring-coral-burst/10 transition-all resize-none h-40 shadow-inner"
                                />
                            </div>

                            {/* Configuration Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">

                                {/* Style */}
                                <div className="space-y-3">
                                    <label className="block font-heading font-bold text-sm text-cocoa-light uppercase tracking-wide">Visual Style</label>
                                    <div className="relative">
                                        <select
                                            value={style}
                                            onChange={(e) => {
                                                const selectedStyle = e.target.value as ArtStyle;
                                                if (canUseStyle(userTier, selectedStyle)) {
                                                    setStyle(selectedStyle);
                                                } else {
                                                    alert(`This style is locked. Upgrade to ${userTier === UserTier.SPARK ? 'Creator' : 'Studio'} to unlock all styles!`);
                                                }
                                            }}
                                            className="w-full appearance-none bg-white border-2 border-peach-soft rounded-2xl p-4 font-body text-charcoal-soft focus:outline-none focus:border-coral-burst cursor:pointer hover:border-coral-burst/50 transition-colors"
                                        >
                                            {allStyles.map(s => (
                                                <option
                                                    key={s}
                                                    value={s}
                                                    disabled={!canUseStyle(userTier, s)}
                                                >
                                                    {s} {!canUseStyle(userTier, s) ? '🔒' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <Palette className="absolute right-4 top-1/2 -translate-y-1/2 text-coral-burst w-5 h-5 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Tone */}
                                <div className="space-y-3">
                                    <label className="block font-heading font-bold text-sm text-cocoa-light uppercase tracking-wide">Narrative Tone</label>
                                    <div className="relative">
                                        <select
                                            value={tone}
                                            onChange={(e) => setTone(e.target.value as BookTone)}
                                            className="w-full appearance-none bg-white border-2 border-peach-soft rounded-2xl p-4 font-body text-charcoal-soft focus:outline-none focus:border-coral-burst cursor:pointer hover:border-coral-burst/50 transition-colors"
                                        >
                                            {tones.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <BookType className="absolute right-4 top-1/2 -translate-y-1/2 text-coral-burst w-5 h-5 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Audience */}
                                <div className="space-y-3">
                                    <label className="block font-heading font-bold text-sm text-cocoa-light uppercase tracking-wide">Target Audience</label>
                                    <div className="relative">
                                        <select
                                            value={audience}
                                            onChange={(e) => setAudience(e.target.value)}
                                            className="w-full appearance-none bg-white border-2 border-peach-soft rounded-2xl p-4 font-body text-charcoal-soft focus:outline-none focus:border-coral-burst cursor:pointer hover:border-coral-burst/50 transition-colors"
                                        >
                                            <option>Toddlers 1-3</option>
                                            <option>Children 4-6</option>
                                            <option>Children 7-9</option>
                                            <option>Pre-teens 10-12</option>
                                            <option>Young Adult</option>
                                            <option>Stakeholders</option>
                                        </select>
                                        <Users className="absolute right-4 top-1/2 -translate-y-1/2 text-coral-burst w-5 h-5 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Length */}
                                <div className="space-y-3">
                                    <label className="block font-heading font-bold text-sm text-cocoa-light uppercase tracking-wide">Length: {pageCount} Pages</label>
                                    <div className="flex items-center gap-4 bg-white border-2 border-peach-soft rounded-2xl p-4">
                                        <Clock className="text-coral-burst w-5 h-5" />
                                        <input
                                            type="range"
                                            min="4"
                                            max="50"
                                            step="2"
                                            value={pageCount}
                                            onChange={(e) => setPageCount(parseInt(e.target.value))}
                                            className="w-full accent-coral-burst h-2 bg-peach-soft rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Advanced Toggles */}
                            <div className="flex flex-col md:flex-row gap-4 mb-10">
                                <button
                                    onClick={() => setIsBranching(!isBranching)}
                                    className={`flex-1 p-4 rounded-2xl border-2 transition-all flex items-center gap-4 group ${isBranching
                                        ? 'border-gold-sunshine bg-yellow-butter/20'
                                        : 'border-peach-soft bg-white hover:border-gold-sunshine/50'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isBranching ? 'bg-gold-sunshine text-white' : 'bg-cream-base text-cocoa-light'}`}>
                                        <GitFork className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-heading font-bold text-charcoal-soft">Interactive Mode</div>
                                        <div className="text-xs text-cocoa-light">Choose-your-own-adventure</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setShowBrandPanel(!showBrandPanel)}
                                    className={`flex-1 p-4 rounded-2xl border-2 transition-all flex items-center gap-4 group ${showBrandPanel
                                        ? 'border-mint-breeze bg-mint-breeze/20'
                                        : 'border-peach-soft bg-white hover:border-mint-breeze/50'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${showBrandPanel ? 'bg-mint-breeze text-emerald-600' : 'bg-cream-base text-cocoa-light'}`}>
                                        <Briefcase className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-heading font-bold text-charcoal-soft">Brand Voice</div>
                                        <div className="text-xs text-cocoa-light">Custom guidelines & style</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setEducational(!educational)}
                                    className={`flex-1 p-4 rounded-2xl border-2 transition-all flex items-center gap-4 group ${educational
                                        ? 'border-blue-400 bg-blue-50'
                                        : 'border-peach-soft bg-white hover:border-blue-400/50'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${educational ? 'bg-blue-400 text-white' : 'bg-cream-base text-cocoa-light'}`}>
                                        <Leaf className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-heading font-bold text-charcoal-soft">Educational</div>
                                        <div className="text-xs text-cocoa-light">Learning & Vocabulary</div>
                                    </div>
                                </button>
                            </div>

                            {/* Brand Panel Expansion */}
                            {showBrandPanel && (
                                <div className="bg-mint-breeze/10 border-2 border-mint-breeze/30 rounded-3xl p-8 mb-10 animate-fadeIn">
                                    <div className="flex items-center gap-2 text-emerald-600 mb-6">
                                        <Briefcase className="w-5 h-5" />
                                        <h3 className="font-heading font-bold text-lg">Brand Intelligence</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-cocoa-light uppercase mb-2">Brand Name</label>
                                            <input
                                                type="text"
                                                value={brandName}
                                                onChange={(e) => setBrandName(e.target.value)}
                                                className="w-full bg-white border border-mint-breeze rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-mint-breeze"
                                                placeholder="Acme Corp"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-cocoa-light uppercase mb-2">Brand Colors</label>
                                            <input
                                                type="text"
                                                value={brandColors}
                                                onChange={(e) => setBrandColors(e.target.value)}
                                                className="w-full bg-white border border-mint-breeze rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-mint-breeze"
                                                placeholder="#FF9B71, #FFF4A3"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-cocoa-light uppercase mb-2">Voice & Guidelines</label>
                                            <textarea
                                                value={brandGuidelines}
                                                onChange={(e) => setBrandGuidelines(e.target.value)}
                                                className="w-full bg-white border border-mint-breeze rounded-xl p-3 text-sm h-20 focus:outline-none focus:ring-2 focus:ring-mint-breeze"
                                                placeholder="Professional, witty, empathetic..."
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-cocoa-light uppercase mb-2">Sample Content</label>
                                            <textarea
                                                value={brandSample}
                                                onChange={(e) => setBrandSample(e.target.value)}
                                                className="w-full bg-white border border-mint-breeze rounded-xl p-3 text-sm h-20 focus:outline-none focus:ring-2 focus:ring-mint-breeze font-serif italic"
                                                placeholder="Paste existing text to match tone..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                        </>
                    ) : (
                        <InfographicWizard onClose={() => setCreationMode('book')} />
                    )}

                    {/* Action Button - Only show in book mode for now */}
                    {creationMode === 'book' && (
                        <div className="flex justify-end mt-10">
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !prompt.trim()}
                                className={`px-12 py-4 rounded-full font-heading font-bold text-lg transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center gap-3
                                ${isGenerating
                                        ? 'bg-cocoa-light cursor-not-allowed text-white opacity-70'
                                        : 'bg-gradient-to-r from-coral-burst to-gold-sunshine text-white hover:scale-105'
                                    }`}
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Creating Magic...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="w-5 h-5" />
                                        Generate Masterpiece
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreationCanvas;
