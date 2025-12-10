import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Sparkles, Wand2, Palette, BookType, Users, Clock, Briefcase, GitFork, ChevronRight, Star, Leaf, Building2, Rocket, LayoutTemplate, Grid, MessageCircle, ArrowLeft } from 'lucide-react';
import { ArtStyle, BookTone, GenerationSettings, BrandProfile, SavedBook, UserTier, Character } from '../types';
import { getAllBooks, deleteBook } from '../services/storageService';
import SavedBookCard from './SavedBookCard';
import { getAvailableStyles, canUseStyle } from '../services/tierLimits';
import InfographicWizard from './infographic/InfographicWizard';
import { getDefaultArtStyle } from '../hooks/useUserSettings';

// New Components
import TemplateLibrary, { BookTemplate } from './TemplateLibrary';
import { StylePresetPicker } from './StylePresets';
import { BookCardSkeleton } from './SkeletonLoaders';
import { useBulkSelection, BulkActionsBar, DeleteConfirmModal, SelectableCard } from './BulkActions';
import BookSharingPkg from './BookSharing';
const { ShareModal } = BookSharingPkg;

// Teaching Characters Data
import { TEACHING_CHARACTERS } from '../src/data/teachingCharacters';

// Conversation Mode for natural story creation
import ConversationMode from './ConversationMode';

// ===== OPTIMIZED MASCOT COMPONENT =====
interface MascotProps {
    src: string;
    alt: string;
    position: 'header-left' | 'header-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-right';
    delay?: string;
}

const Mascot = memo(({ src, alt, position, delay = '0s' }: MascotProps) => {
    const positionClasses = useMemo(() => {
        const positions = {
            'header-left': 'hidden lg:block absolute left-4 xl:left-12 top-8 w-28 xl:w-36',
            'header-right': 'hidden lg:block absolute right-4 xl:right-12 top-8 w-28 xl:w-36',
            'middle-left': 'hidden xl:block absolute left-4 2xl:left-16 top-[65%] w-32 2xl:w-44',
            'middle-right': 'hidden xl:block absolute right-4 2xl:right-16 top-[65%] w-32 2xl:w-44',
            'bottom-left': 'hidden xl:block absolute left-8 2xl:left-20 bottom-20 w-28 2xl:w-36',
            'bottom-right': 'hidden xl:block absolute right-8 2xl:right-20 bottom-20 w-28 2xl:w-36',
        };
        return positions[position];
    }, [position]);

    return (
        <div className={`${positionClasses} pointer-events-none z-10 opacity-90 hover:opacity-100 transition-all duration-500 hover:scale-105`}>
            <img
                src={src}
                alt={alt}
                loading="lazy"
                decoding="async"
                className="w-full h-auto drop-shadow-xl animate-float"
                style={{ animationDelay: delay }}
            />
        </div>
    );
});

Mascot.displayName = 'Mascot';

interface CreationCanvasProps {
    onGenerate: (settings: GenerationSettings) => void;
    isGenerating: boolean;
    generationStatus?: string;
    onEditBook?: (book: SavedBook) => void;
    onReadBook?: (book: SavedBook) => void;
    userTier?: UserTier;
    shouldFocusCreation?: boolean;
}

const CreationCanvas: React.FC<CreationCanvasProps> = ({
    onGenerate,
    isGenerating,
    generationStatus,
    onEditBook,
    onReadBook,
    userTier = UserTier.SPARK,
    shouldFocusCreation = false
}) => {
    const promptSectionRef = React.useRef<HTMLDivElement>(null);

    // Scroll to creation section when shouldFocusCreation becomes true
    useEffect(() => {
        if (shouldFocusCreation && promptSectionRef.current) {
            // Small delay to ensure render is complete
            setTimeout(() => {
                promptSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Also ensure we're in book mode if that's what we want
                setCreationMode('book');
            }, 100);
        }
    }, [shouldFocusCreation]);

    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState<ArtStyle>(() => {
        // Initialize with user's preferred art style from settings
        const savedStyle = getDefaultArtStyle();
        return savedStyle && Object.values(ArtStyle).includes(savedStyle as ArtStyle)
            ? (savedStyle as ArtStyle)
            : ArtStyle.WATERCOLOR;
    });
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

    // Brand Story Configuration
    const [brandContentType, setBrandContentType] = useState<'brand-story' | 'annual-report' | 'company-history' | 'product-launch' | 'investor-pitch'>('brand-story');
    const [brandIndustry, setBrandIndustry] = useState('Technology');
    const [brandFounded, setBrandFounded] = useState('');
    const [brandHeadquarters, setBrandHeadquarters] = useState('');
    const [brandDescription, setBrandDescription] = useState('');
    const [brandTone, setBrandTone] = useState<'professional' | 'inspiring' | 'conversational' | 'formal' | 'bold'>('professional');
    const [brandFiscalYear, setBrandFiscalYear] = useState(new Date().getFullYear().toString());
    const [brandSections, setBrandSections] = useState({
        cover: true,
        ceoLetter: true,
        originStory: true,
        missionValues: true,
        milestones: true,
        achievements: true,
        financials: false,
        esg: false,
        team: true,
        futureOutlook: true,
        callToAction: true
    });

    // New Feature State
    const [isTemplateLibraryOpen, setIsTemplateLibraryOpen] = useState(false);
    const [isStylePresetsOpen, setIsStylePresetsOpen] = useState(false);
    const [isConversationModeOpen, setIsConversationModeOpen] = useState(false);

    // Learning Goals State
    const [learningSubject, setLearningSubject] = useState('Math');
    const [learningObjectives, setLearningObjectives] = useState('');
    const [integrationMode, setIntegrationMode] = useState<'integrated' | 'after-chapter' | 'dedicated-section'>('integrated');
    const [learningDifficulty, setLearningDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
    const [selectedTeacher, setSelectedTeacher] = useState<Character | null>(null);

    // Teaching Characters - Deep psychology profiles for educational guidance
    const teachingCharacters: Character[] = useMemo(() => {
        const originals: Character[] = [
            {
                id: 'teacher-luna',
                name: 'Luna the Moon Fairy',
                role: 'Gentle Guide',
                description: 'A nurturing fairy who teaches through metaphors and starlight wisdom',
                visualTraits: 'Translucent wings, silver hair, soft blue glow',
                imageUrl: '/assets/characters/Demo Character 1.jpeg',
                traits: ['ethereal', 'nurturing', 'wise', 'gentle'],
                psychologicalProfile: {
                    openness: 85,
                    conscientiousness: 70,
                    extraversion: 35,
                    agreeableness: 95,
                    neuroticism: 55
                },
                voiceProfile: {
                    tone: 'Warm, melodic, with an undercurrent of ancient wisdom',
                    vocabulary: 'sophisticated',
                    catchphrases: ['Little one...', 'Every star was once a wish that came true', 'The night holds many secrets...'],
                    nonverbalTics: ['Wings flutter when excited', 'Glow dims when sad'],
                    laughStyle: 'Soft, musical, like distant bells'
                },
                teachingStyle: {
                    subjectsExpertise: ['Science', 'Reading', 'SEL', 'Art'],
                    teachingApproach: 'nurturing',
                    encouragementStyle: 'Celebrates with gentle warmth: "How beautifully you understood that, little one!"',
                    correctionStyle: 'Validates effort first: "A wonderful try! Let us explore this together..."',
                    exampleStyle: 'Nature and celestial metaphors'
                }
            },
            {
                id: 'teacher-blaze',
                name: 'Blaze the Dragon',
                role: 'Enthusiastic Coach',
                description: 'An eager young dragon who makes learning exciting and celebrates every win',
                visualTraits: 'Red-orange scales, oversized wings, big amber eyes, smoke puffs',
                imageUrl: '/assets/characters/Demo character 2.jpeg',
                traits: ['enthusiastic', 'clumsy', 'loyal', 'brave'],
                psychologicalProfile: {
                    openness: 75,
                    conscientiousness: 85,
                    extraversion: 70,
                    agreeableness: 90,
                    neuroticism: 75
                },
                voiceProfile: {
                    tone: 'Eager, slightly squeaky, with nervous energy',
                    vocabulary: 'simple',
                    catchphrases: ['Oh! Oh! I know this one!', 'That wasn\'t as bad as usual!', 'Wait, really? You got it!'],
                    nonverbalTics: ['Tail wags when happy', 'Smoke puffs increase with emotion'],
                    laughStyle: 'Surprised snorty laugh with small flame bursts'
                },
                teachingStyle: {
                    subjectsExpertise: ['Math', 'Science', 'Physical Education'],
                    teachingApproach: 'playful',
                    encouragementStyle: 'Bursts with joy: "YES! [smoke puff] You did it! I knew you could!"',
                    correctionStyle: 'Relates to struggles: "That\'s okay! I mess up ALL the time. Let\'s try again!"',
                    exampleStyle: 'Counting treasure, dragon adventures, real-world scenarios'
                }
            },
            {
                id: 'teacher-aurora',
                name: 'Aurora the Princess',
                role: 'Challenger',
                description: 'A warrior princess who pushes students to discover their potential',
                visualTraits: 'Athletic build, wild auburn hair, green eyes, practical dress',
                imageUrl: '/assets/characters/Demo character 3.jpeg',
                traits: ['rebellious', 'courageous', 'compassionate', 'stubborn'],
                psychologicalProfile: {
                    openness: 80,
                    conscientiousness: 65,
                    extraversion: 70,
                    agreeableness: 55,
                    neuroticism: 50
                },
                voiceProfile: {
                    tone: 'Bold and assertive, with hidden warmth',
                    vocabulary: 'moderate',
                    catchphrases: ['A real challenge? Now we\'re talking!', 'Think about it - what would YOU do?', 'Don\'t give up now!'],
                    nonverbalTics: ['Eyebrow raise of skepticism', 'Crosses arms when defensive'],
                    laughStyle: 'Surprised, unguarded laugh'
                },
                teachingStyle: {
                    subjectsExpertise: ['History', 'Reading', 'Leadership', 'Strategy'],
                    teachingApproach: 'socratic',
                    encouragementStyle: 'Proud acknowledgment: "See? I knew you had it in you all along."',
                    correctionStyle: 'Challenges growth: "Not quite - but you\'re closer than you think. What else could it be?"',
                    exampleStyle: 'Historical examples, strategic thinking, real-life applications'
                }
            },
            {
                id: 'teacher-silverhook',
                name: 'Captain Silverhook',
                role: 'Storyteller Sage',
                description: 'A reformed pirate who teaches through tales of adventure and hard-won wisdom',
                visualTraits: 'Silver hook hand, weathered kind face, tricorn hat, warm smile',
                imageUrl: '/assets/characters/Demo character 4.jpeg',
                traits: ['reformed', 'wise', 'haunted', 'generous'],
                psychologicalProfile: {
                    openness: 60,
                    conscientiousness: 75,
                    extraversion: 55,
                    agreeableness: 65,
                    neuroticism: 60
                },
                voiceProfile: {
                    tone: 'Deep, weathered, warm—like a crackling fire on a cold night',
                    vocabulary: 'moderate',
                    catchphrases: ['Every tide turns, lad/lass', 'Now that\'s a tale worth telling...', 'Let me tell you about a time...'],
                    nonverbalTics: ['Rubs hook when thinking', 'Tips hat respectfully'],
                    laughStyle: 'A surprised bark of laughter'
                },
                teachingStyle: {
                    subjectsExpertise: ['Math', 'Geography', 'History', 'Ethics'],
                    teachingApproach: 'storytelling',
                    encouragementStyle: 'Warm acknowledgment: "Aye, now you\'re thinking like a true captain!"',
                    correctionStyle: 'Uses personal experience: "I made that same mistake once, cost me three gold coins. Here\'s what I learned..."',
                    exampleStyle: 'Pirate adventures, treasure counting, navigation stories'
                }
            }
        ];

        return [...originals, ...TEACHING_CHARACTERS];
    }, []);

    // Template State
    const [selectedTemplateStructure, setSelectedTemplateStructure] = useState<any[] | undefined>(undefined);

    // Saved Books
    const [savedBooks, setSavedBooks] = useState<SavedBook[]>([]);
    const [isLoadingBooks, setIsLoadingBooks] = useState(true);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [sharingBook, setSharingBook] = useState<SavedBook | null>(null);

    // Bulk Selection
    const {
        selectedIds,
        selectedCount,
        isSelectionMode,
        toggle,
        selectAll,
        clearSelection,
        isSelected,
        enterSelectionMode,
        hasSelection,
        isAllSelected
    } = useBulkSelection(savedBooks);

    // Load saved books on mount
    useEffect(() => {
        loadSavedBooks();
    }, []);

    const loadSavedBooks = useCallback(async () => {
        setIsLoadingBooks(true);
        try {
            const books = await getAllBooks();
            setSavedBooks(books);
        } catch (error) {
            console.error('Failed to load books:', error);
        } finally {
            setIsLoadingBooks(false);
        }
    }, []);

    const handleDeleteBook = useCallback(async (id: string) => {
        try {
            await deleteBook(id);
            await loadSavedBooks(); // Refresh the list
        } catch (error) {
            console.error('Failed to delete book:', error);
            alert('Failed to delete book. Please try again.');
        }
    }, [loadSavedBooks]);

    const handleBulkDelete = async () => {
        setIsDeleting(true);
        try {
            await Promise.all(Array.from(selectedIds).map(id => deleteBook(id)));
            await loadSavedBooks();
            clearSelection();
            setIsDeleteModalOpen(false);
        } catch (error) {
            console.error('Failed to delete books:', error);
            alert('Failed to delete some books.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleTemplateSelect = (template: BookTemplate) => {
        setPrompt(template.samplePrompt);
        setPageCount(template.pageCount);
        setSelectedTemplateStructure(template.structure);

        // Map template category to audience/tone if needed
        if (template.category === 'bedtime') {
            setTone(BookTone.CALM);
            setAudience('Toddlers 1-3');
        } else if (template.category === 'adventure') {
            setTone(BookTone.ADVENTUROUS);
            setAudience('Children 7-9');
        }
        // Could also set structure if we had a way to pass it
    };

    // Memoize expensive computations
    const allStyles = useMemo(() => Object.values(ArtStyle), []);
    const availableStyles = useMemo(() => getAvailableStyles(userTier), [userTier]);
    const tones = useMemo(() => Object.values(BookTone), []);

    const handleGenerate = useCallback(() => {
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

        // Build brandStoryConfig for professional brand content
        const brandStoryConfig = showBrandPanel && brandName ? {
            contentType: brandContentType,
            companyInfo: {
                name: brandName,
                tagline: '',
                industry: brandIndustry,
                founded: brandFounded,
                headquarters: brandHeadquarters,
                description: brandDescription
            },
            sections: [
                { type: 'cover' as const, enabled: brandSections.cover, order: 1 },
                { type: 'ceo-letter' as const, enabled: brandSections.ceoLetter, order: 2 },
                { type: 'origin-story' as const, enabled: brandSections.originStory, order: 3 },
                { type: 'mission-values' as const, enabled: brandSections.missionValues, order: 4 },
                { type: 'milestones' as const, enabled: brandSections.milestones, order: 5 },
                { type: 'achievements' as const, enabled: brandSections.achievements, order: 6 },
                { type: 'financials' as const, enabled: brandSections.financials, order: 7 },
                { type: 'esg' as const, enabled: brandSections.esg, order: 8 },
                { type: 'team' as const, enabled: brandSections.team, order: 9 },
                { type: 'future-outlook' as const, enabled: brandSections.futureOutlook, order: 10 },
                { type: 'call-to-action' as const, enabled: brandSections.callToAction, order: 11 }
            ],
            tone: brandTone,
            visualStyle: 'corporate-clean' as const,
            colorScheme: brandColors.split(',').map(c => c.trim()),
            fiscalYear: brandFiscalYear
        } : undefined;

        onGenerate({
            prompt,
            style,
            tone,
            audience,
            pageCount,
            isBranching,
            educational,
            learningConfig: educational ? {
                subject: learningSubject,
                objectives: learningObjectives,
                integrationMode,
                difficulty: learningDifficulty,
                teacherCharacterId: selectedTeacher?.id
            } : undefined,
            teacherCharacter: educational && selectedTeacher ? selectedTeacher : undefined,
            brandProfile,
            brandStoryConfig,
            templateStructure: selectedTemplateStructure
        });
    }, [prompt, style, tone, audience, pageCount, isBranching, educational, showBrandPanel, brandName, brandGuidelines, brandColors, brandSample, learningSubject, learningObjectives, integrationMode, learningDifficulty, selectedTeacher, onGenerate, selectedTemplateStructure, brandContentType, brandIndustry, brandFounded, brandHeadquarters, brandDescription, brandTone, brandSections, brandFiscalYear]);

    const [creationMode, setCreationMode] = useState<'book' | 'feature'>('book');

    // Quick Start Card Component with Vercel-style cursor glow effect
    const QuickStartCard = ({ icon: Icon, title, desc, colorClass, glowColor = 'rgba(255, 155, 113, 0.35)', onClick }: any) => {
        const cardRef = React.useRef<HTMLButtonElement>(null);
        const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });
        const [isHovered, setIsHovered] = React.useState(false);

        const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
            if (!cardRef.current) return;
            const rect = cardRef.current.getBoundingClientRect();
            setMousePosition({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            });
        };

        return (
            <button
                ref={cardRef}
                onClick={onClick}
                onMouseMove={handleMouseMove}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="relative bg-white p-8 rounded-3xl shadow-soft-md hover:shadow-soft-lg hover:-translate-y-2 transition-all duration-300 text-left group flex flex-col h-full border border-transparent hover:border-peach-soft overflow-hidden"
            >
                {/* Cursor Glow Effect - Vercel Marketplace Style */}
                <div
                    className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
                    style={{
                        opacity: isHovered ? 1 : 0,
                        background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, ${glowColor}, transparent 40%)`,
                    }}
                />

                {/* Corner Gradient Decoration */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorClass} opacity-25 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700 z-0`}></div>

                {/* Card Content */}
                <div className="relative z-10">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colorClass} flex items-center justify-center text-white shadow-md mb-6 group-hover:rotate-12 transition-transform`}>
                        <Icon className="w-8 h-8" />
                    </div>
                    <h3 className="font-heading font-bold text-xl text-charcoal-soft mb-2">{title}</h3>
                    <p className="font-body text-cocoa-light text-sm leading-relaxed mb-6 flex-1">{desc}</p>
                    <div className="flex items-center text-coral-burst font-heading font-bold text-sm group-hover:gap-2 transition-all">
                        Start Creating <ChevronRight className="w-4 h-4" />
                    </div>
                </div>
            </button>
        );
    };

    const handleQuickStartClick = useCallback((action: () => void) => {
        setCreationMode('book');
        action();
    }, []);

    const resetForm = useCallback(() => {
        setPrompt('');
        setShowBrandPanel(false);
        setEducational(false);
        setIsBranching(false);
        setAudience('Children 4-6');
    }, []);

    return (
        <div className="w-full flex flex-col items-center pb-32 animate-fadeIn relative">

            {/* ===== OPTIMIZED MASCOTS ===== */}
            <Mascot src="/assets/mascots/joy-musician.png" alt="Joy the Musician" position="header-left" />
            <Mascot src="/assets/mascots/zara-scientist.png" alt="Zara the Scientist" position="header-right" delay="1s" />
            <Mascot src="/assets/mascots/wise-sage.png" alt="Wise Sage" position="middle-left" delay="0.5s" />
            <Mascot src="/assets/mascots/explorer-boy.png" alt="Explorer Boy" position="middle-right" delay="1.5s" />
            <Mascot src="/assets/mascots/wise-owl.png" alt="Wise Owl" position="bottom-left" delay="2s" />
            <Mascot src="/assets/mascots/magic-dragon.png" alt="Magic Dragon" position="bottom-right" delay="2.5s" />



            {/* Hero Header */}
            <div className="text-center space-y-4 mb-12 mt-16">
                <h1 className="font-heading font-bold text-5xl md:text-6xl text-charcoal-soft mb-4">
                    Create Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-coral-burst to-gold-sunshine">Masterpiece</span>
                </h1>
                <p className="font-body text-xl text-cocoa-light max-w-2xl mx-auto">
                    Describe your story idea, choose a style, and let Genesis weave a magical tale just for you.
                </p>
            </div>

            {/* Quick Starts */}
            {!prompt && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full px-4 mb-16">
                    <QuickStartCard
                        icon={Star}
                        title="Children's Story"
                        desc="Create a magical tale with vibrant illustrations and moral lessons."
                        colorClass="from-gold-sunshine to-orange-400"
                        glowColor="rgba(251, 146, 60, 0.35)"
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
                        glowColor="rgba(147, 51, 234, 0.35)"
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
                        glowColor="rgba(16, 185, 129, 0.35)"
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
            {savedBooks.length > 0 && !prompt && (
                <div className="w-full max-w-6xl px-4 mb-16">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="font-heading font-bold text-3xl text-charcoal-soft">My Saved Books</h2>
                            <p className="text-cocoa-light text-sm mt-1">{savedBooks.length} {savedBooks.length === 1 ? 'book' : 'books'} saved</p>
                        </div>

                        {/* Bulk Selection Toggle */}
                        {!isLoadingBooks && (
                            <button
                                onClick={isSelectionMode ? clearSelection : enterSelectionMode}
                                className={`
                                    px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2
                                    ${isSelectionMode
                                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        : 'text-coral-burst hover:bg-coral-burst/10'
                                    }
                                `}
                            >
                                {isSelectionMode ? (
                                    <>Cancel Selection</>
                                ) : (
                                    <>
                                        <Grid className="w-4 h-4" />
                                        Select Books
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {isLoadingBooks ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => (
                                <BookCardSkeleton key={i} />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
                            {savedBooks.map((book) => (
                                <div key={book.id} className="w-full">
                                    <SelectableCard
                                        isSelectionMode={isSelectionMode}
                                        isSelected={isSelected(book.id)}
                                        onSelect={() => toggle(book.id)}
                                        onLongPress={enterSelectionMode}
                                    >
                                        <SavedBookCard
                                            book={book}
                                            onEdit={(book) => !isSelectionMode && onEditBook?.(book)}
                                            onRead={(book) => !isSelectionMode && onReadBook?.(book)}
                                            onDelete={handleDeleteBook}
                                            onShare={(book) => !isSelectionMode && setSharingBook(book)}
                                        />
                                    </SelectableCard>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Main Wizard Card */}
            <div className="w-full max-w-4xl px-2 sm:px-4">
                <div className="bg-white rounded-2xl sm:rounded-[32px] shadow-soft-lg p-6 sm:p-8 md:p-12 border border-white/50 relative overflow-hidden min-h-[calc(100vh-250px)] sm:min-h-[600px]">

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
                            {prompt && (
                                <button
                                    onClick={resetForm}
                                    className="mb-6 flex items-center gap-2 text-cocoa-light hover:text-coral-burst transition-colors font-bold group"
                                >
                                    <div className="w-8 h-8 rounded-full bg-white border border-peach-soft flex items-center justify-center group-hover:border-coral-burst transition-colors shadow-sm">
                                        <ArrowLeft className="w-4 h-4" />
                                    </div>
                                    Back to Home
                                </button>
                            )}

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

                                {showBrandPanel && (
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
                                )}
                            </div>

                            <div ref={promptSectionRef} className="mb-10">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block font-heading font-bold text-lg text-charcoal-soft flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-gold-sunshine" />
                                        Tell us about your book idea
                                    </label>
                                    <button
                                        onClick={() => setIsTemplateLibraryOpen(true)}
                                        className="text-sm font-bold text-coral-burst hover:text-coral-burst/80 flex items-center gap-1 transition-colors"
                                    >
                                        <LayoutTemplate className="w-4 h-4" />
                                        Use Template
                                    </button>
                                </div>
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
                                    <button
                                        onClick={() => setIsStylePresetsOpen(true)}
                                        className="w-full bg-white border-2 border-peach-soft rounded-2xl p-4 font-body text-charcoal-soft focus:outline-none focus:border-coral-burst hover:border-coral-burst/50 transition-all text-left flex items-center justify-between group"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Palette className="w-5 h-5 text-coral-burst" />
                                            {style}
                                        </span>
                                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>

                                {/* Tone */}
                                <div className="space-y-3">
                                    <label className="block font-heading font-bold text-sm text-cocoa-light uppercase tracking-wide">Narrative Tone</label>
                                    <div className="relative">
                                        <select
                                            value={tone}
                                            onChange={(e) => setTone(e.target.value as BookTone)}
                                            className="w-full appearance-none bg-white border-2 border-peach-soft rounded-2xl p-4 font-body text-charcoal-soft focus:outline-none focus:border-coral-burst cursor:pointer hover:border-coral-burst/50 transition-colors"
                                            title="Select narrative tone"
                                            aria-label="Narrative tone"
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
                                            title="Select target audience"
                                            aria-label="Target audience"
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
                                            title={`Page count: ${pageCount}`}
                                            aria-label="Page count"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Brand Panel Expansion */}
                            {showBrandPanel && (
                                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-3xl p-8 mb-10 animate-fadeIn">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-2 text-emerald-600">
                                            <Briefcase className="w-5 h-5" />
                                            <h3 className="font-heading font-bold text-lg">Professional Brand Content</h3>
                                        </div>
                                        <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold">
                                            {brandContentType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </span>
                                    </div>

                                    {/* Content Type Selection */}
                                    <div className="mb-6">
                                        <label className="block text-xs font-bold text-cocoa-light uppercase mb-3">Document Type</label>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                            {[
                                                { id: 'brand-story', label: 'Brand Story', icon: '📖' },
                                                { id: 'annual-report', label: 'Annual Report', icon: '📊' },
                                                { id: 'company-history', label: 'Company History', icon: '🏛️' },
                                                { id: 'product-launch', label: 'Product Launch', icon: '🚀' },
                                                { id: 'investor-pitch', label: 'Investor Pitch', icon: '💼' }
                                            ].map(type => (
                                                <button
                                                    key={type.id}
                                                    onClick={() => setBrandContentType(type.id as any)}
                                                    className={`p-3 rounded-xl text-sm font-bold transition-all ${brandContentType === type.id
                                                        ? 'bg-emerald-500 text-white shadow-lg'
                                                        : 'bg-white text-charcoal-soft hover:bg-emerald-100'
                                                        }`}
                                                >
                                                    <span className="mr-1">{type.icon}</span> {type.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Company Info Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                        <div>
                                            <label className="block text-xs font-bold text-cocoa-light uppercase mb-2">Company Name *</label>
                                            <input
                                                type="text"
                                                value={brandName}
                                                onChange={(e) => setBrandName(e.target.value)}
                                                className="w-full bg-white border border-emerald-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                                placeholder="Acme Corporation"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-cocoa-light uppercase mb-2">Industry</label>
                                            <select
                                                value={brandIndustry}
                                                onChange={(e) => setBrandIndustry(e.target.value)}
                                                className="w-full bg-white border border-emerald-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                            >
                                                <option value="Technology">Technology</option>
                                                <option value="Healthcare">Healthcare</option>
                                                <option value="Finance">Finance & Banking</option>
                                                <option value="Retail">Retail & E-commerce</option>
                                                <option value="Manufacturing">Manufacturing</option>
                                                <option value="Education">Education</option>
                                                <option value="Real Estate">Real Estate</option>
                                                <option value="Media">Media & Entertainment</option>
                                                <option value="Energy">Energy & Utilities</option>
                                                <option value="Non-Profit">Non-Profit</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-cocoa-light uppercase mb-2">Founded</label>
                                            <input
                                                type="text"
                                                value={brandFounded}
                                                onChange={(e) => setBrandFounded(e.target.value)}
                                                className="w-full bg-white border border-emerald-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                                placeholder="2010"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-cocoa-light uppercase mb-2">Headquarters</label>
                                            <input
                                                type="text"
                                                value={brandHeadquarters}
                                                onChange={(e) => setBrandHeadquarters(e.target.value)}
                                                className="w-full bg-white border border-emerald-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                                placeholder="San Francisco, CA"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-cocoa-light uppercase mb-2">Brand Colors</label>
                                            <input
                                                type="text"
                                                value={brandColors}
                                                onChange={(e) => setBrandColors(e.target.value)}
                                                className="w-full bg-white border border-emerald-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                                placeholder="#FF9B71, #10B981"
                                            />
                                        </div>
                                        {brandContentType === 'annual-report' && (
                                            <div>
                                                <label className="block text-xs font-bold text-cocoa-light uppercase mb-2">Fiscal Year</label>
                                                <input
                                                    type="text"
                                                    value={brandFiscalYear}
                                                    onChange={(e) => setBrandFiscalYear(e.target.value)}
                                                    className="w-full bg-white border border-emerald-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                                    placeholder="2024"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Company Description */}
                                    <div className="mb-6">
                                        <label className="block text-xs font-bold text-cocoa-light uppercase mb-2">Company Description</label>
                                        <textarea
                                            value={brandDescription}
                                            onChange={(e) => setBrandDescription(e.target.value)}
                                            className="w-full bg-white border border-emerald-200 rounded-xl p-3 text-sm h-20 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                            placeholder="Describe your company's mission, what you do, and what makes you unique..."
                                        />
                                    </div>

                                    {/* Tone Selection */}
                                    <div className="mb-6">
                                        <label className="block text-xs font-bold text-cocoa-light uppercase mb-3">Content Tone</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { id: 'professional', label: 'Professional', desc: 'Business formal' },
                                                { id: 'inspiring', label: 'Inspiring', desc: 'Visionary & uplifting' },
                                                { id: 'conversational', label: 'Conversational', desc: 'Friendly & approachable' },
                                                { id: 'formal', label: 'Formal', desc: 'Corporate & traditional' },
                                                { id: 'bold', label: 'Bold', desc: 'Confident & disruptive' }
                                            ].map(tone => (
                                                <button
                                                    key={tone.id}
                                                    onClick={() => setBrandTone(tone.id as any)}
                                                    className={`px-4 py-2 rounded-full text-sm transition-all ${brandTone === tone.id
                                                        ? 'bg-emerald-500 text-white'
                                                        : 'bg-white text-charcoal-soft hover:bg-emerald-100 border border-emerald-200'
                                                        }`}
                                                >
                                                    {tone.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Sections to Include */}
                                    <div>
                                        <label className="block text-xs font-bold text-cocoa-light uppercase mb-3">Sections to Include</label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {[
                                                { key: 'cover', label: 'Cover Page' },
                                                { key: 'ceoLetter', label: 'CEO Letter' },
                                                { key: 'originStory', label: 'Origin Story' },
                                                { key: 'missionValues', label: 'Mission & Values' },
                                                { key: 'milestones', label: 'Key Milestones' },
                                                { key: 'achievements', label: 'Achievements' },
                                                { key: 'financials', label: 'Financials' },
                                                { key: 'esg', label: 'ESG / Sustainability' },
                                                { key: 'team', label: 'Leadership Team' },
                                                { key: 'futureOutlook', label: 'Future Outlook' },
                                                { key: 'callToAction', label: 'Call to Action' }
                                            ].map(section => (
                                                <label
                                                    key={section.key}
                                                    className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all ${brandSections[section.key as keyof typeof brandSections]
                                                        ? 'bg-emerald-100 border-2 border-emerald-400'
                                                        : 'bg-white border-2 border-gray-200 hover:border-emerald-300'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={brandSections[section.key as keyof typeof brandSections]}
                                                        onChange={(e) => setBrandSections(prev => ({
                                                            ...prev,
                                                            [section.key]: e.target.checked
                                                        }))}
                                                        className="w-4 h-4 accent-emerald-500"
                                                    />
                                                    <span className="text-sm font-medium text-charcoal-soft">{section.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Educational Panel Expansion */}
                            {educational && (
                                <div className="bg-blue-50 border-2 border-blue-200 rounded-3xl p-8 mb-10 animate-fadeIn">
                                    <div className="flex items-center gap-2 text-blue-600 mb-6">
                                        <Leaf className="w-5 h-5" />
                                        <h3 className="font-heading font-bold text-lg">Learning Goals</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-cocoa-light uppercase mb-2">Subject</label>
                                            <select
                                                value={learningSubject}
                                                onChange={(e) => setLearningSubject(e.target.value)}
                                                className="w-full bg-white border border-blue-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                            >
                                                <option value="Math">Math</option>
                                                <option value="Science">Science</option>
                                                <option value="Language Arts">Language Arts</option>
                                                <option value="Social Studies">Social Studies</option>
                                                <option value="SEL">Social-Emotional Learning</option>
                                                <option value="History">History</option>
                                                <option value="Geography">Geography</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-cocoa-light uppercase mb-2">Difficulty</label>
                                            <select
                                                value={learningDifficulty}
                                                onChange={(e) => setLearningDifficulty(e.target.value as any)}
                                                className="w-full bg-white border border-blue-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                            >
                                                <option value="beginner">Beginner</option>
                                                <option value="intermediate">Intermediate</option>
                                                <option value="advanced">Advanced</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-cocoa-light uppercase mb-2">Learning Objectives</label>
                                            <textarea
                                                value={learningObjectives}
                                                onChange={(e) => setLearningObjectives(e.target.value)}
                                                className="w-full bg-white border border-blue-200 rounded-xl p-3 text-sm h-20 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                                placeholder="e.g., Counting to 10, Understanding Photosynthesis, Managing Anger..."
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-cocoa-light uppercase mb-2">Integration Mode</label>
                                            <div className="grid grid-cols-3 gap-3">
                                                {[
                                                    { id: 'integrated', label: 'Integrated', desc: 'Woven into story' },
                                                    { id: 'after-chapter', label: 'After Chapter', desc: 'Review at end' },
                                                    { id: 'dedicated-section', label: 'Dedicated', desc: 'Separate section' }
                                                ].map((mode) => (
                                                    <button
                                                        key={mode.id}
                                                        onClick={() => setIntegrationMode(mode.id as any)}
                                                        className={`p-3 rounded-xl border-2 text-left transition-all ${integrationMode === mode.id
                                                            ? 'border-blue-400 bg-blue-100'
                                                            : 'border-blue-100 bg-white hover:border-blue-300'
                                                            }`}
                                                    >
                                                        <div className={`font-bold text-sm ${integrationMode === mode.id ? 'text-blue-700' : 'text-charcoal-soft'}`}>{mode.label}</div>
                                                        <div className="text-xs text-cocoa-light">{mode.desc}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Choose Your Guide - Character Teacher Selection */}
                                        <div className="md:col-span-2 mt-4 pt-4 border-t border-blue-200">
                                            <label className="block text-xs font-bold text-blue-700 uppercase mb-3 flex items-center gap-2">
                                                <Users className="w-4 h-4" />
                                                Choose Your Teaching Guide
                                            </label>
                                            <p className="text-sm text-blue-600 mb-4">
                                                Select a character to guide the learning journey. They'll teach concepts in their unique voice!
                                            </p>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[600px] overflow-y-auto p-2 border border-blue-100 rounded-xl bg-white/50">
                                                {teachingCharacters.map((char) => (
                                                    <button
                                                        key={char.id}
                                                        onClick={() => setSelectedTeacher(selectedTeacher?.id === char.id ? null : char)}
                                                        className={`relative p-4 rounded-2xl border-2 transition-all text-left group hover:shadow-lg
                                                                    ${selectedTeacher?.id === char.id
                                                                ? 'border-blue-500 bg-gradient-to-br from-blue-100 to-purple-100 shadow-md'
                                                                : 'border-blue-100 bg-white hover:border-blue-300'
                                                            }`}
                                                    >
                                                        {/* Character Image */}
                                                        <div className="relative mx-auto w-16 h-16 mb-3">
                                                            <img
                                                                src={char.imageUrl}
                                                                alt={char.name}
                                                                className={`w-16 h-16 rounded-full object-cover border-3 transition-transform group-hover:scale-110
                                                                            ${selectedTeacher?.id === char.id ? 'border-blue-500' : 'border-white'}`}
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.name}`;
                                                                }}
                                                            />
                                                            {selectedTeacher?.id === char.id && (
                                                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Character Info */}
                                                        <div className="text-center">
                                                            <div className={`font-bold text-sm truncate ${selectedTeacher?.id === char.id ? 'text-blue-700' : 'text-charcoal-soft'}`}>
                                                                {char.name}
                                                            </div>
                                                            <div className="text-xs text-cocoa-light">{char.role}</div>
                                                            {char.teachingStyle && (
                                                                <div className="mt-2 flex flex-wrap gap-1 justify-center">
                                                                    {char.teachingStyle.subjectsExpertise.slice(0, 2).map(subject => (
                                                                        <span
                                                                            key={subject}
                                                                            className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full"
                                                                        >
                                                                            {subject}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Teaching Style Tooltip on Hover */}
                                                        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/95 to-purple-600/95 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-center text-white text-center pointer-events-none">
                                                            <div className="font-bold text-sm mb-1">{char.name}</div>
                                                            <div className="text-xs opacity-90 mb-2">
                                                                {char.teachingStyle?.teachingApproach === 'nurturing' && '🌙 Gentle & Patient'}
                                                                {char.teachingStyle?.teachingApproach === 'playful' && '🔥 Fun & Exciting'}
                                                                {char.teachingStyle?.teachingApproach === 'socratic' && '⚔️ Challenging'}
                                                                {char.teachingStyle?.teachingApproach === 'storytelling' && '⚓ Story-Based'}
                                                            </div>
                                                            <div className="text-[10px] opacity-75 italic">
                                                                "{char.voiceProfile?.catchphrases?.[0]}"
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Selected Teacher Preview */}
                                            {selectedTeacher && (
                                                <div className="mt-4 p-4 bg-gradient-to-r from-blue-100 to-purple-100 rounded-2xl border border-blue-200 animate-fadeIn">
                                                    <div className="flex items-start gap-4">
                                                        <img
                                                            src={selectedTeacher.imageUrl}
                                                            alt={selectedTeacher.name}
                                                            className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedTeacher.name}`;
                                                            }}
                                                        />
                                                        <div className="flex-1">
                                                            <div className="font-bold text-blue-800">{selectedTeacher.name} will be your guide!</div>
                                                            <p className="text-sm text-blue-600 italic mt-1">
                                                                "{selectedTeacher.voiceProfile?.catchphrases?.[0]}"
                                                            </p>
                                                            <div className="text-xs text-cocoa-light mt-2">
                                                                Teaching style: <span className="font-medium capitalize">{selectedTeacher.teachingStyle?.teachingApproach}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                        </>
                    ) : (
                        <InfographicWizard onClose={() => setCreationMode('book')} />
                    )}

                    {/* Action Buttons - Only show in book mode for now */}
                    {creationMode === 'book' && (
                        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-10">
                            {/* Conversation Mode Button */}
                            <button
                                onClick={() => setIsConversationModeOpen(true)}
                                className="px-8 py-4 rounded-full font-heading font-bold text-lg transition-all shadow-md hover:shadow-lg transform hover:-translate-y-1 flex items-center justify-center gap-3 border-2 border-coral-burst text-coral-burst hover:bg-coral-burst/10"
                            >
                                <MessageCircle className="w-5 h-5" />
                                Chat to Create
                            </button>

                            {/* Main Generate Button */}
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !prompt.trim()}
                                className={`px-12 py-4 rounded-full font-heading font-bold text-lg transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center gap-3
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

            {/* Modals */}
            <TemplateLibrary
                isOpen={isTemplateLibraryOpen}
                onClose={() => setIsTemplateLibraryOpen(false)}
                onSelectTemplate={handleTemplateSelect}
            />

            <StylePresetPicker
                isOpen={isStylePresetsOpen}
                onClose={() => setIsStylePresetsOpen(false)}
                onSelect={(preset) => {
                    setStyle(preset.style as ArtStyle);
                    setIsStylePresetsOpen(false);
                }}
            />

            <BulkActionsBar
                selectedCount={selectedCount}
                totalCount={savedBooks.length}
                onSelectAll={selectAll}
                onClearSelection={clearSelection}
                onDelete={() => setIsDeleteModalOpen(true)}
                isAllSelected={isAllSelected}
                isDeleting={isDeleting}
            />

            <DeleteConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleBulkDelete}
                count={selectedCount}
                isDeleting={isDeleting}
            />

            {sharingBook && (
                <ShareModal
                    isOpen={true}
                    onClose={() => setSharingBook(null)}
                    book={sharingBook.project}
                />
            )}

            {/* Conversation Mode Modal */}
            <ConversationMode
                isOpen={isConversationModeOpen}
                onClose={() => setIsConversationModeOpen(false)}
                onGenerate={onGenerate}
            />
        </div>
    );
};

export default CreationCanvas;
