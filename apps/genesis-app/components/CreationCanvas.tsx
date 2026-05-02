import { ArrowLeft, BarChart3, BookOpen, Camera, ChevronRight, Clock, GitFork, Grid, LayoutTemplate, Leaf, Palette, Sparkles, Users, Wand2 } from 'lucide-react';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { getDefaultArtStyle } from '../hooks/useUserSettings';
import { deleteBook, getAllBooks } from '../services/storageService';
import { getStylesForTier } from '../config/entitlements';
import { normalizeArtStyle } from '../utils/aiSettings';
import {
  ArtStyle,
  BookTone,
  type Character,
  type GenerationSettings,
  type SavedBook,
  UserTier,
} from '../types';
import SavedBookCard from './SavedBookCard';
import { Button } from './ui/button';
import { Input, Label, Textarea } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { toast } from './ui/sonner';
import { motion } from 'framer-motion';

import BookSharingPkg from './BookSharing';
import {
  BulkActionsBar,
  DeleteConfirmModal,
  SelectableCard,
  useBulkSelection,
} from './BulkActions';
import { BookCardSkeleton } from './SkeletonLoaders';
import { StylePresetPicker } from './StylePresets';
import { usePageSEO } from '../hooks/usePageSEO';
// New Components
import TemplateLibrary, { type BookTemplate } from './TemplateLibrary';
const { ShareModal } = BookSharingPkg;

// Teaching Characters Data
import { TEACHING_CHARACTERS } from '../src/data/teachingCharacters';

// ===== OPTIMIZED MASCOT COMPONENT =====
interface MascotProps {
  src: string;
  alt: string;
  position:
    | 'header-left'
    | 'header-right'
    | 'middle-left'
    | 'middle-right'
    | 'bottom-left'
    | 'bottom-right';
  delay?: string;
}

const Mascot = memo(({ src, alt, position, delay = '0s' }: MascotProps) => {
  const positionClasses = useMemo(() => {
    const positions = {
      'header-left': 'absolute left-1 md:left-4 xl:left-12 top-4 md:top-8 w-20 md:w-28 xl:w-36 opacity-95 md:opacity-100',
      'header-right': 'absolute right-1 md:right-4 xl:right-12 top-4 md:top-8 w-20 md:w-28 xl:w-36 opacity-95 md:opacity-100',
      'middle-left': 'hidden xl:block absolute left-4 2xl:left-16 top-[65%] w-32 2xl:w-44',
      'middle-right': 'hidden xl:block absolute right-4 2xl:right-16 top-[65%] w-32 2xl:w-44',
      'bottom-left': 'hidden xl:block absolute left-8 2xl:left-20 bottom-20 w-28 2xl:w-36',
      'bottom-right': 'hidden xl:block absolute right-8 2xl:right-20 bottom-20 w-28 2xl:w-36',
    };
    return positions[position];
  }, [position]);

  return (
    <div
      className={`${positionClasses} pointer-events-none z-10 opacity-90 hover:opacity-100 transition-all duration-500 hover:scale-105`}
    >
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

interface LifeInColourDraft {
  prompt: string;
  pageCount: number;
  tone: BookTone;
  style: ArtStyle;
  stylePrompt?: string;
}

// Quick Start Card Component with Vercel-style cursor glow effect
  const QuickStartCard = ({
    icon: Icon,
    title,
    desc,
    colorClass,
    glowColor = 'rgba(255, 155, 113, 0.35)',
    decorationPosition = 'top-right',
    defaultGlowPosition = 'bottom-left',
    onClick,
  }: {
    icon: React.ElementType;
    title: string;
    desc: string;
    colorClass: string;
    glowColor?: string;
    decorationPosition?: 'top-right' | 'top-middle' | 'top-left';
    defaultGlowPosition?: 'bottom-left' | 'bottom-middle' | 'bottom-right';
    onClick: () => void;
  }) => {
    const { t } = useTranslation('creation');
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

    const getDecorationClasses = () => {
      switch (decorationPosition) {
        case 'top-left':
          return 'w-32 h-32 left-0 -ml-10 -mt-10 rounded-br-full';
        case 'top-middle':
          return 'w-48 h-16 left-1/2 -translate-x-1/2 -mt-6 rounded-b-full';
        case 'top-right':
        default:
          return 'w-32 h-32 right-0 -mr-10 -mt-10 rounded-bl-full';
      }
    };

    const getDefaultGlowCoords = () => {
      switch (defaultGlowPosition) {
        case 'bottom-left':
          return '0% 100%';
        case 'bottom-middle':
          return '50% 100%';
        case 'bottom-right':
          return '100% 100%';
        default:
          return '50% 100%';
      }
    };

    return (
      <button
        ref={cardRef}
        onClick={onClick}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="w-[85vw] md:w-auto shrink-0 snap-center relative bg-surface p-6 md:p-8 rounded-3xl hover:-translate-y-2 transition-all duration-300 text-left group flex flex-col min-h-[220px] md:h-full border border-transparent hover:border-peach-soft overflow-hidden"
      >
        {/* Default Static Glow */}
        <div
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500"
          style={{
            opacity: isHovered ? 0 : 0.8,
            background: `radial-gradient(600px circle at ${getDefaultGlowCoords()}, ${glowColor}, transparent 40%)`,
          }}
        />

        {/* Interactive Hover Glow - Vercel Marketplace Style */}
        <div
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, ${glowColor}, transparent 40%)`,
          }}
        />

        {/* Corner Gradient Decoration */}
        <div
          className={`absolute top-0 bg-linear-to-br ${colorClass} opacity-25 transition-transform group-hover:scale-150 duration-700 z-0 ${getDecorationClasses()}`}
        ></div>

        {/* Card Content */}
        <div className="relative z-10">
          <div
            className={`w-16 h-16 rounded-2xl bg-linear-to-br ${colorClass} flex items-center justify-center text-white mb-6 group-hover:rotate-12 transition-transform`}
          >
            <Icon className="w-8 h-8" />
          </div>
          <h2 className="font-heading font-bold text-xl text-charcoal-soft mb-2">{title}</h2>
          <p className="font-body text-cocoa-light text-sm leading-relaxed mb-6 flex-1">{desc}</p>
          <div className="flex items-center text-coral-burst font-heading font-bold text-sm group-hover:gap-2 transition-all">
            {t('creationCanvas.startCreating', 'Start Creating')} <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </button>
    );
  };



const CreationCanvas: React.FC<CreationCanvasProps> = ({
  onGenerate,
  isGenerating,
  generationStatus,
  onEditBook,
  onReadBook,
  userTier = UserTier.SPARK,
  shouldFocusCreation = false,
}) => {
  const { t } = useTranslation('creation');
  const promptSectionRef = React.useRef<HTMLDivElement>(null);

  usePageSEO({
    title: 'Create — Genesis AI Visual Storytelling',
    description: 'Create stunning AI-powered visual stories, illustrated books, and educational content with Genesis. Choose a style and let AI bring your ideas to life.',
    canonical: '/create',
  });

  // Scroll to creation section when shouldFocusCreation becomes true
  useEffect(() => {
    if (shouldFocusCreation && promptSectionRef.current) {
      // Small delay to ensure render is complete
      setTimeout(() => {
        promptSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  const [stylePrompt, setStylePrompt] = useState('');
  const [tone, setTone] = useState<BookTone>(BookTone.PLAYFUL);
  const [audience, setAudience] = useState('Children 4-6');
  const [pageCount, setPageCount] = useState(10);

  const [isBranching, setIsBranching] = useState(false);
  const [educational, setEducational] = useState(false);

  // New Feature State
  const [isTemplateLibraryOpen, setIsTemplateLibraryOpen] = useState(false);
  const [isStylePresetsOpen, setIsStylePresetsOpen] = useState(false);

  // Learning Goals State
  const [learningSubject, setLearningSubject] = useState('Math');
  const [learningObjectives, setLearningObjectives] = useState('');
  const [integrationMode, setIntegrationMode] = useState<
    'integrated' | 'after-chapter' | 'dedicated-section'
  >('integrated');
  const [learningDifficulty, setLearningDifficulty] = useState<
    'beginner' | 'intermediate' | 'advanced'
  >('beginner');
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
          neuroticism: 55,
        },
        voiceProfile: {
          tone: 'Warm, melodic, with an undercurrent of ancient wisdom',
          vocabulary: 'sophisticated',
          catchphrases: [
            'Little one...',
            'Every star was once a wish that came true',
            'The night holds many secrets...',
          ],
          nonverbalTics: ['Wings flutter when excited', 'Glow dims when sad'],
          laughStyle: 'Soft, musical, like distant bells',
        },
        teachingStyle: {
          subjectsExpertise: ['Science', 'Reading', 'SEL', 'Art'],
          teachingApproach: 'nurturing',
          encouragementStyle:
            'Celebrates with gentle warmth: "How beautifully you understood that, little one!"',
          correctionStyle:
            'Validates effort first: "A wonderful try! Let us explore this together..."',
          exampleStyle: 'Nature and celestial metaphors',
        },
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
          neuroticism: 75,
        },
        voiceProfile: {
          tone: 'Eager, slightly squeaky, with nervous energy',
          vocabulary: 'simple',
          catchphrases: [
            'Oh! Oh! I know this one!',
            "That wasn't as bad as usual!",
            'Wait, really? You got it!',
          ],
          nonverbalTics: ['Tail wags when happy', 'Smoke puffs increase with emotion'],
          laughStyle: 'Surprised snorty laugh with small flame bursts',
        },
        teachingStyle: {
          subjectsExpertise: ['Math', 'Science', 'Physical Education'],
          teachingApproach: 'playful',
          encouragementStyle: 'Bursts with joy: "YES! [smoke puff] You did it! I knew you could!"',
          correctionStyle:
            'Relates to struggles: "That\'s okay! I mess up ALL the time. Let\'s try again!"',
          exampleStyle: 'Counting treasure, dragon adventures, real-world scenarios',
        },
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
          neuroticism: 50,
        },
        voiceProfile: {
          tone: 'Bold and assertive, with hidden warmth',
          vocabulary: 'moderate',
          catchphrases: [
            "A real challenge? Now we're talking!",
            'Think about it - what would YOU do?',
            "Don't give up now!",
          ],
          nonverbalTics: ['Eyebrow raise of skepticism', 'Crosses arms when defensive'],
          laughStyle: 'Surprised, unguarded laugh',
        },
        teachingStyle: {
          subjectsExpertise: ['History', 'Reading', 'Leadership', 'Strategy'],
          teachingApproach: 'socratic',
          encouragementStyle: 'Proud acknowledgment: "See? I knew you had it in you all along."',
          correctionStyle:
            'Challenges growth: "Not quite - but you\'re closer than you think. What else could it be?"',
          exampleStyle: 'Historical examples, strategic thinking, real-life applications',
        },
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
          neuroticism: 60,
        },
        voiceProfile: {
          tone: 'Deep, weathered, warm—like a crackling fire on a cold night',
          vocabulary: 'moderate',
          catchphrases: [
            'Every tide turns, lad/lass',
            "Now that's a tale worth telling...",
            'Let me tell you about a time...',
          ],
          nonverbalTics: ['Rubs hook when thinking', 'Tips hat respectfully'],
          laughStyle: 'A surprised bark of laughter',
        },
        teachingStyle: {
          subjectsExpertise: ['Math', 'Geography', 'History', 'Ethics'],
          teachingApproach: 'storytelling',
          encouragementStyle:
            'Warm acknowledgment: "Aye, now you\'re thinking like a true captain!"',
          correctionStyle:
            'Uses personal experience: "I made that same mistake once, cost me three gold coins. Here\'s what I learned..."',
          exampleStyle: 'Pirate adventures, treasure counting, navigation stories',
        },
      },
    ];

    return originals;
  }, []);

  // Template State
  const [selectedTemplateStructure, setSelectedTemplateStructure] = useState<BookTemplate['structure'] | undefined>(
    undefined
  );

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
    hasSelection: _hasSelection,
    isAllSelected,
  } = useBulkSelection(savedBooks);

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

  // Load saved books on mount
  useEffect(() => {
    loadSavedBooks();
  }, [loadSavedBooks]);

  const handleDeleteBook = useCallback(
    async (id: string) => {
      try {
        await deleteBook(id);
        await loadSavedBooks(); // Refresh the list
      } catch (error) {
        console.error('Failed to delete book:', error);
        toast.error("Couldn't delete book", { description: 'Please try again.' });
      }
    },
    [loadSavedBooks]
  );

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteBook(id)));
      await loadSavedBooks();
      clearSelection();
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Failed to delete books:', error);
      toast.error("Some books couldn't be deleted", { description: 'Please try again.' });
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
  const _allStyles = useMemo(() => Object.values(ArtStyle), []);
  const _availableStyles = useMemo(() => getStylesForTier(userTier), [userTier]);
  const tones = useMemo(() => Object.values(BookTone), []);

  const applyArtStyle = useCallback((nextStyle: ArtStyle, detail?: string) => {
    setStyle(nextStyle);
    setStylePrompt(detail?.trim() ? detail.trim() : '');
  }, []);

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;

    onGenerate({
      prompt,
      style,
      stylePrompt: stylePrompt.trim() ? stylePrompt.trim() : undefined,
      tone,
      audience,
      pageCount,
      isBranching,
      educational,
      learningConfig: educational
        ? {
            subject: learningSubject,
            objectives: learningObjectives,
            integrationMode,
            difficulty: learningDifficulty,
            teacherCharacterId: selectedTeacher?.id,
          }
        : undefined,
      teacherCharacter: educational && selectedTeacher ? selectedTeacher : undefined,
      templateStructure: selectedTemplateStructure,
    });
  }, [
    prompt,
    style,
    stylePrompt,
    tone,
    audience,
    pageCount,
    isBranching,
    educational,
    learningSubject,
    learningObjectives,
    integrationMode,
    learningDifficulty,
    selectedTeacher,
    onGenerate,
    selectedTemplateStructure,
  ]);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const incomingState = location.state as { lifeInColourDraft?: LifeInColourDraft } | null;
    const draft = incomingState?.lifeInColourDraft;

    if (!draft) {
      return;
    }

    if (draft.prompt.trim()) {
      setPrompt(draft.prompt);
    }
    if (draft.pageCount > 0) {
      setPageCount(draft.pageCount);
    }
    setTone(draft.tone);
    setEducational(false);
    setIsBranching(false);
    if (draft.style) {
      applyArtStyle(draft.style, draft.stylePrompt);
    }
  }, [applyArtStyle, location.state]);

  const handleQuickStartClick = useCallback((action: () => void) => {
    action();
  }, []);

  const resetForm = useCallback(() => {
    setPrompt('');
    setEducational(false);
    setIsBranching(false);
    setAudience(t('creationCanvas.audienceChildren46', 'Children 4-6'));
  }, []);

  return (
    <>
      <section aria-label={t('creationCanvas.sectionAria', 'Creation canvas')} className="w-full flex flex-col items-center pb-32 animate-fadeIn relative">
        {/* ===== OPTIMIZED MASCOTS ===== */}
      <Mascot
        src="/assets/mascots/joy-musician.png"
        alt={t('creationCanvas.mascotJoy', 'Joy the Musician')}
        position="header-left"
      />
      <Mascot
        src="/assets/mascots/zara-scientist.png"
        alt={t('creationCanvas.mascotZara', 'Zara the Scientist')}
        position="header-right"
        delay="1s"
      />
      <Mascot
        src="/assets/mascots/wise-sage.png"
        alt={t('creationCanvas.mascotWiseSage', 'Wise Sage')}
        position="middle-left"
        delay="0.5s"
      />
      <Mascot
        src="/assets/mascots/explorer-boy.png"
        alt={t('creationCanvas.mascotExplorerBoy', 'Explorer Boy')}
        position="middle-right"
        delay="1.5s"
      />
      <Mascot src="/assets/mascots/wise-owl.png" alt={t('creationCanvas.mascotWiseOwl', 'Wise Owl')} position="bottom-left" delay="2s" />
      <Mascot
        src="/assets/mascots/magic-dragon.png"
        alt={t('creationCanvas.mascotMagicDragon', 'Magic Dragon')}
        position="bottom-right"
        delay="2.5s"
      />

      {/* Hero Header */}
      <motion.div
        className="text-center space-y-3 mb-8 md:mb-12 mt-8 md:mt-16 relative z-20 px-6 md:px-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <h1 className="font-heading font-bold text-[2.2rem] leading-[1.1] tracking-tight md:tracking-normal md:text-5xl lg:text-6xl text-charcoal-soft mb-2 md:mb-4 max-w-[260px] md:max-w-none mx-auto">
          {t('creationCanvas.heroCreateYour', 'Create Your')}{' '}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-coral-burst to-gold-sunshine block mt-1 md:inline md:mt-0">
            {t('creationCanvas.heroMasterpiece', 'Masterpiece')}
          </span>
        </h1>
        <p className="font-body text-[15px] leading-relaxed md:text-xl text-cocoa-light max-w-2xl mx-auto pt-2">
          {t('creationCanvas.heroDescription', 'Describe your story idea, choose a style, and let Genesis weave a magical tale just for you.')}
        </p>
      </motion.div>

      {/* Quick Starts */}
      {!prompt && (
        <motion.div
          className="flex overflow-x-auto md:grid md:grid-cols-3 gap-4 md:gap-6 max-w-6xl w-full px-4 pb-4 md:pb-0 mb-8 md:mb-16 snap-x snap-mandatory hide-scrollbar"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
          }}
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } } }}>
          <QuickStartCard
            icon={Wand2}
            title={t('creationCanvas.quickStartChildrenTitle', "Children's Story")}
            desc={t('creationCanvas.quickStartChildrenDesc', 'Create a magical tale with vibrant illustrations and moral lessons.')}
            colorClass="from-gold-sunshine to-orange-400"
            glowColor="rgba(251, 146, 60, 0.35)"
            decorationPosition="top-right"
            defaultGlowPosition="bottom-left"
            onClick={() =>
              handleQuickStartClick(() => {
                setPrompt('A magical adventure about a shy dragon who loves to bake cookies.');
                setAudience(t('creationCanvas.audienceChildren46', 'Children 4-6'));
                applyArtStyle(ArtStyle.WATERCOLOR);
              })
            }
          />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } } }}>
          <QuickStartCard
            icon={Camera}
            title={t('creationCanvas.quickStartLifeInColourTitle', 'Life in Colour')}
            desc={t('creationCanvas.quickStartLifeInColourDesc', 'Turn a camera-roll moment or uploaded photo into a finished colouring page, then expand it into a book only if you want to.')}
            colorClass="from-sky-400 to-emerald-400"
            glowColor="rgba(56, 189, 248, 0.35)"
            decorationPosition="top-middle"
            defaultGlowPosition="bottom-middle"
            onClick={() => handleQuickStartClick(() => navigate('/life-in-colour'))}
          />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } } }}>
          <QuickStartCard
            icon={BarChart3}
            title={t('creationCanvas.quickStartInfographicsTitle', 'Infographics')}
            desc={t('creationCanvas.quickStartInfographicsDesc', 'Create stunning educational infographics with AI-powered visuals.')}
            colorClass="from-mint-breeze to-emerald-400"
            glowColor="rgba(16, 185, 129, 0.35)"
            decorationPosition="top-left"
            defaultGlowPosition="bottom-right"
            onClick={() => navigate('/infographics')}
          />
          </motion.div>
        </motion.div>
      )}

      {/* Saved Books Section */}
      {savedBooks.length > 0 && !prompt && (
        <div className="w-full max-w-6xl px-4 mb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading font-bold text-3xl text-charcoal-soft">{t('creationCanvas.mySavedBooks', 'My Saved Books')}</h2>
              <p className="text-cocoa-light text-sm mt-1">
                {t('creationCanvas.savedBooksCount', '{{count}} {{bookLabel}} saved', { count: savedBooks.length, bookLabel: savedBooks.length === 1 ? t('creationCanvas.bookSingular', 'book') : t('creationCanvas.bookPlural', 'books') })}
              </p>
            </div>

            {/* Bulk Selection Toggle */}
            {!isLoadingBooks && (
              <Button
                variant="ghost"
                size="sm"
                onClick={isSelectionMode ? clearSelection : enterSelectionMode}
                className={`
                                    flex px-4 py-2
                                    ${
                                      isSelectionMode
                                        ? 'bg-peach-light/50 text-cocoa-light hover:bg-peach-soft/60'
                                        : 'text-coral-burst hover:bg-coral-burst/10'
                                    }
                                `}
              >
                {isSelectionMode ? (
                  <>{t('creationCanvas.cancelSelection', 'Cancel Selection')}</>
                ) : (
                  <>
                    <Grid className="w-4 h-4" />
                    {t('creationCanvas.selectBooks', 'Select Books')}
                  </>
                )}
              </Button>
            )}
          </div>

          {isLoadingBooks ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <BookCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-4"
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }}
            >
              {savedBooks.map((book) => (
                <motion.div
                  key={book.id}
                  className="w-full"
                  variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } }}
                >
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
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* Empty Library Delight State */}
      {!isLoadingBooks && savedBooks.length === 0 && !prompt && (
        <motion.div
          className="w-full max-w-md px-4 mb-10 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.3 }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-coral-burst/10 border border-coral-burst/20 flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-coral-burst/70" />
            </div>
            <div>
              <p className="font-heading font-bold text-charcoal-soft text-lg">{t('creationCanvas.libraryEmpty', 'Your library is empty')}</p>
              <p className="text-cocoa-light text-sm mt-1">{t('creationCanvas.libraryEmptyHint', 'Pick a Quick Start above or describe your own story to begin.')}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-coral-burst/80 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('creationCanvas.firstMasterpieceAwaits', 'Your first masterpiece awaits')}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Wizard Card */}
      <div className="w-full max-w-4xl px-2 sm:px-4">
        <div className="bg-surface rounded-2xl sm:rounded-4xl p-6 sm:p-8 md:p-12 border border-peach-soft relative overflow-hidden min-h-[calc(100vh-250px)] sm:min-h-[600px]">
          {/* Loading Overlay */}
          {isGenerating && (
            <div className="absolute inset-0 z-50 bg-surface/90  flex flex-col items-center justify-center animate-fadeIn">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-coral-burst rounded-full animate-ping opacity-20"></div>
                <div className="w-20 h-20 bg-linear-to-br from-coral-burst to-gold-sunshine rounded-full flex items-center justify-center animate-bounce-slow relative z-10">
                  <Wand2 className="w-10 h-10 text-white animate-pulse" />
                </div>
              </div>
              <h3 className="font-heading font-bold text-2xl text-charcoal-soft mb-2">
                {t('creationCanvas.weavingMagic', 'Weaving Magic...')}
              </h3>
              <p className="text-cocoa-light text-center max-w-md px-4 animate-pulse">
                {generationStatus || t('creationCanvas.craftingStory', 'Crafting your story, characters, and world...')}
              </p>
            </div>
          )}

          {/* Mode Toggle */}
          <div className="flex justify-center mb-8">
            <div className="bg-cream-soft p-1 rounded-full flex items-center border border-peach-soft/50">
              <Button
                variant="ghost"
                className="px-6 py-2 rounded-full bg-surface text-coral-burst border border-peach-soft/50"
              >
                {t('creationCanvas.createBook', 'Create Book')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/infographics')}
                className="px-6 py-2 rounded-full relative text-cocoa-light hover:text-charcoal-soft"
              >
                {t('creationCanvas.infographics', 'Infographics')}
                <span className="absolute -top-1 -right-1 bg-linear-to-r from-pink-500 to-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {t('creationCanvas.beta', 'BETA')}
                </span>
              </Button>
            </div>
          </div>

              {prompt && (
                <Button
                  variant="ghost"
                  onClick={resetForm}
                  className="mb-6 flex text-cocoa-light hover:text-coral-burst group"
                >
                  <div className="w-8 h-8 rounded-full bg-surface border border-peach-soft flex items-center justify-center group-hover:border-coral-burst transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </div>
                  {t('creationCanvas.backToHome', 'Back to Home')}
                </Button>
              )}

              {/* Advanced Toggles */}
              <div className="flex flex-col md:flex-row gap-4 mb-10">
                <Button
                  variant="outline"
                  onClick={() => setIsBranching(!isBranching)}
                  className={`flex-1 p-4 flex gap-4 group ${
                    isBranching
                      ? 'border-gold-sunshine bg-yellow-butter/20'
                      : 'hover:border-gold-sunshine/50'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isBranching ? 'bg-gold-sunshine text-white' : 'bg-cream-base text-cocoa-light'}`}
                  >
                    <GitFork className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="font-heading font-bold text-charcoal-soft">
                      {t('creationCanvas.interactiveMode', 'Interactive Mode')}
                    </div>
                    <div className="text-xs text-cocoa-light">{t('creationCanvas.chooseYourOwnAdventure', 'Choose-your-own-adventure')}</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setEducational(!educational)}
                  className={`flex-1 p-4 flex gap-4 group ${
                    educational
                      ? 'border-blue-400 bg-blue-50'
                      : 'hover:border-blue-400/50'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${educational ? 'bg-blue-400 text-white' : 'bg-cream-base text-cocoa-light'}`}
                  >
                    <Leaf className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="font-heading font-bold text-charcoal-soft">{t('creationCanvas.educational', 'Educational')}</div>
                    <div className="text-xs text-cocoa-light">{t('creationCanvas.learningAndVocabulary', 'Learning & Vocabulary')}</div>
                  </div>
                </Button>
              </div>

              <div ref={promptSectionRef} className="mb-10">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-lg flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-gold-sunshine" />
                    {t('creationCanvas.tellUsYourBookIdea', 'Tell us about your book idea')}
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsTemplateLibraryOpen(true)}
                    className="text-coral-burst hover:text-coral-burst/80 flex gap-1"
                  >
                    <LayoutTemplate className="w-4 h-4" />
                    {t('creationCanvas.useTemplate', 'Use Template')}
                  </Button>
                </div>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t('creationCanvas.promptPlaceholder', 'Once upon a time, in a land made of candy...')}
                  className="bg-cream-soft rounded-3xl p-6 text-lg h-40"
                />
              </div>

              {/* Configuration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                {/* Style */}
                <div className="space-y-3">
                  <Label className="text-cocoa-light uppercase tracking-wide">
                    {t('creationCanvas.visualStyle', 'Visual Style')}
                  </Label>
                  <Button
                    variant="outline"
                    onClick={() => setIsStylePresetsOpen(true)}
                    className="w-full p-4 font-body focus:border-coral-burst hover:border-coral-burst/50 text-left flex justify-between group"
                  >
                    <span className="flex items-center gap-2">
                      <Palette className="w-5 h-5 text-coral-burst" />
                      {style}
                    </span>
                    <ChevronRight className="w-5 h-5 text-cocoa-light/60 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>

                {/* Tone */}
                <div className="space-y-3">
                  <Label className="text-cocoa-light uppercase tracking-wide">
                    {t('creationCanvas.narrativeTone', 'Narrative Tone')}
                  </Label>
                  <Select value={tone} onValueChange={(v) => setTone(v as BookTone)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('creationCanvas.selectTone', 'Select tone')} />
                    </SelectTrigger>
                    <SelectContent>
                      {tones.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Audience */}
                <div className="space-y-3">
                  <Label className="text-cocoa-light uppercase tracking-wide">
                    {t('creationCanvas.targetAudience', 'Target Audience')}
                  </Label>
                  <Select value={audience} onValueChange={setAudience}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('creationCanvas.selectAudience', 'Select audience')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={t('creationCanvas.audienceToddlers13', 'Toddlers 1-3')}>{t('creationCanvas.audienceToddlers13', 'Toddlers 1-3')}</SelectItem>
                      <SelectItem value={t('creationCanvas.audienceChildren46', 'Children 4-6')}>{t('creationCanvas.audienceChildren46', 'Children 4-6')}</SelectItem>
                      <SelectItem value={t('creationCanvas.audienceChildren79', 'Children 7-9')}>{t('creationCanvas.audienceChildren79', 'Children 7-9')}</SelectItem>
                      <SelectItem value={t('creationCanvas.audiencePreTeens1012', 'Pre-teens 10-12')}>{t('creationCanvas.audiencePreTeens1012', 'Pre-teens 10-12')}</SelectItem>
                      <SelectItem value={t('creationCanvas.audienceYoungAdult', 'Young Adult')}>{t('creationCanvas.audienceYoungAdult', 'Young Adult')}</SelectItem>
                      <SelectItem value={t('creationCanvas.audienceStakeholders', 'Stakeholders')}>{t('creationCanvas.audienceStakeholders', 'Stakeholders')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Length */}
                <div className="space-y-3">
                  <Label className="text-cocoa-light uppercase tracking-wide">
                    {t('creationCanvas.lengthPages', 'Length: {{count}} Pages', { count: pageCount })}
                  </Label>
                  <div className="flex items-center gap-4 bg-surface border border-peach-soft rounded-2xl p-4">
                    <Clock className="text-coral-burst w-5 h-5" />
                    <Slider
                      min={4}
                      max={50}
                      step={2}
                      value={[pageCount]}
                      onValueChange={(value) => setPageCount(value[0])}
                      aria-label={t('creationCanvas.pageCount', 'Page count')}
                    />
                  </div>
                </div>
              </div>

              {/* Educational Panel Expansion */}
              {educational && (
                <div className="bg-white/95 backdrop-blur-sm border border-cream-soft rounded-3xl p-6 mb-10 shadow-sm animate-fadeIn">
                  <div className="flex items-center gap-2 text-primary mb-6">
                    <Leaf className="w-5 h-5" />
                    <h3 className="font-heading font-bold text-lg text-charcoal-base ">{t('creationCanvas.learningGoals', 'Learning Goals')}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-xs text-cocoa-light  uppercase mb-2">
                        {t('creationCanvas.subject', 'Subject')}
                      </Label>
                      <Select value={learningSubject} onValueChange={setLearningSubject}>
                        <SelectTrigger className="w-full bg-white border-cream-soft">
                          <SelectValue placeholder={t('creationCanvas.selectSubject', 'Select subject')} />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-cream-soft">
                          <SelectItem value="Math">Math</SelectItem>
                          <SelectItem value="Science">Science</SelectItem>
                          <SelectItem value="Language Arts">Language Arts</SelectItem>
                          <SelectItem value="Social Studies">Social Studies</SelectItem>
                          <SelectItem value="SEL">Social-Emotional Learning</SelectItem>
                          <SelectItem value="History">History</SelectItem>
                          <SelectItem value="Geography">Geography</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-cocoa-light  uppercase mb-2">
                        {t('creationCanvas.difficulty', 'Difficulty')}
                      </Label>
                      <Select value={learningDifficulty} onValueChange={(v: string) => setLearningDifficulty(v as typeof learningDifficulty)}>
                        <SelectTrigger className="w-full bg-white border-cream-soft">
                          <SelectValue placeholder={t('creationCanvas.selectDifficulty', 'Select difficulty')} />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-cream-soft">
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs text-cocoa-light  uppercase mb-2">
                        {t('creationCanvas.learningObjectives', 'Learning Objectives')}
                      </Label>
                      <Textarea
                        value={learningObjectives}
                        onChange={(e) => setLearningObjectives(e.target.value)}
                        className="bg-white border-cream-soft p-3 h-20 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary text-charcoal-soft placeholder:text-cocoa-light"
                        placeholder={t('creationCanvas.learningObjectivesPlaceholder', 'e.g., Counting to 10, Understanding Photosynthesis, Managing Anger...')}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs text-cocoa-light  uppercase mb-2">
                        {t('creationCanvas.integrationMode', 'Integration Mode')}
                      </Label>
                      <div className="grid grid-cols-1 xs:grid-cols-3 gap-3">
                        {[
                          { id: 'integrated', label: 'Integrated', desc: 'Woven into story' },
                          { id: 'after-chapter', label: 'After Chapter', desc: 'Review at end' },
                          { id: 'dedicated-section', label: 'Dedicated', desc: 'Separate section' },
                        ].map((mode) => (
                          <Button
                            variant="outline"
                            key={mode.id}
                            onClick={() => setIntegrationMode(mode.id as typeof integrationMode)}
                            className={`p-3 h-auto flex flex-col items-start text-left bg-white ${
                              integrationMode === mode.id
                                ? 'border-primary ring-1 ring-primary/20 bg-primary/5 '
                                : 'border-cream-soft  hover:border-peach-soft/60'
                            }`}
                          >
                            <div
                              className={`font-bold text-sm ${integrationMode === mode.id ? 'text-primary' : 'text-charcoal-soft '}`}
                            >
                              {mode.label}
                            </div>
                            <div className={`text-xs mt-1 ${integrationMode === mode.id ? 'text-primary/80' : 'text-cocoa-light '}`}>{mode.desc}</div>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Choose Your Guide - Character Teacher Selection */}
                    <div className="md:col-span-2 mt-2 pt-6 border-t border-cream-soft ">
                      <Label className="text-xs text-cocoa-light uppercase mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        {t('creationCanvas.chooseTeachingGuide', 'Choose Your Teaching Guide')}
                      </Label>
                      <p className="text-sm text-cocoa-light  mb-4">
                        {t('creationCanvas.teachingGuideDescription', "Select a character to guide the learning journey. They'll teach concepts in their unique voice!")}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto p-3 border border-cream-soft rounded-xl bg-white/50 custom-scrollbar">
                        {teachingCharacters.map((char) => (
                          <button
                            type="button"
                            key={char.id}
                            onClick={() =>
                              setSelectedTeacher(selectedTeacher?.id === char.id ? null : char)
                            }
                            className={`relative p-3 rounded-xl border text-center group flex flex-col items-center cursor-pointer transition-all h-full
                                                                    ${
                                                                      selectedTeacher?.id ===
                                                                      char.id
                                                                        ? 'border-primary bg-primary/5  ring-1 ring-primary/20'
                                                                        : 'border-cream-soft bg-white hover:border-peach-soft/60'
                                                                    }`}
                          >
                            {/* Character Image */}
                            <div className="relative mx-auto w-16 h-16 mb-3">
                              <img
                                src={char.imageUrl}
                                alt={char.name}
                                className={`w-16 h-16 rounded-full object-cover border-3 transition-transform group-hover:scale-110
                                                                            ${selectedTeacher?.id === char.id ? 'border-primary' : 'border-white '}`}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.name}`;
                                }}
                              />
                              {selectedTeacher?.id === char.id && (
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                                  <svg
                                    className="w-3 h-3 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                              )}
                            </div>

                            {/* Character Info */}
                            <div className="text-center w-full">
                              <div
                                className={`font-bold text-sm truncate ${selectedTeacher?.id === char.id ? 'text-primary' : 'text-charcoal-soft '}`}
                              >
                                {char.name}
                              </div>
                              <div className="text-xs text-cocoa-light  truncate">{char.role}</div>
                              {char.teachingStyle && (
                                <div className="mt-2 flex flex-wrap gap-1 justify-center">
                                  {char.teachingStyle.subjectsExpertise
                                    .slice(0, 2)
                                    .map((subject) => (
                                      <span
                                        key={subject}
                                        className="text-[10px] px-2 py-0.5 bg-cream-base text-cocoa-light rounded-full border border-peach-soft/50"
                                      >
                                        {subject}
                                      </span>
                                    ))}
                                </div>
                              )}
                            </div>

                            {/* Teaching Style Tooltip on Hover */}
                            <div className="absolute inset-0 bg-charcoal-soft/95 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-center text-white text-center pointer-events-none">
                              <div className="font-bold text-sm mb-1">{char.name}</div>
                              <div className="text-xs opacity-90 mb-2">
                                {char.teachingStyle?.teachingApproach === 'nurturing' &&
                                  '🌙 Gentle & Patient'}
                                {char.teachingStyle?.teachingApproach === 'playful' &&
                                  '🔥 Fun & Exciting'}
                                {char.teachingStyle?.teachingApproach === 'socratic' &&
                                  '⚔️ Challenging'}
                                {char.teachingStyle?.teachingApproach === 'storytelling' &&
                                  '⚓ Story-Based'}
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
                        <div className="mt-4 p-4 bg-primary/5  rounded-2xl border border-primary/20 animate-fadeIn">
                          <div className="flex items-start gap-4">
                            <img
                              src={selectedTeacher.imageUrl}
                              alt={selectedTeacher.name}
                              className="w-12 h-12 rounded-full object-cover border border-peach-soft "
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedTeacher.name}`;
                              }}
                            />
                            <div className="flex-1">
                              <div className="font-bold text-charcoal-base ">
                                {t('creationCanvas.selectedTeacherGuide', '{{name}} will be your guide!', { name: selectedTeacher.name })}
                              </div>
                              <p className="text-sm text-cocoa-light italic mt-1">
                                "{selectedTeacher.voiceProfile?.catchphrases?.[0]}"
                              </p>
                              <div className="text-xs text-cocoa-light  mt-2">
                                {t('creationCanvas.teachingStyle', 'Teaching style:')}{' '}
                                <span className="font-medium capitalize text-charcoal-soft ">
                                  {selectedTeacher.teachingStyle?.teachingApproach}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

          {/* Action Buttons */}
            <div className="flex justify-end mt-10">
              {/* Main Generate Button */}
              <Button
                variant="primary"
                size="xl"
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className={`group h-10 rounded-[12px] px-3.5 text-gray-700 dark:text-gray-200 border-[0.5px] border-gray-300/55 dark:border-white/5 bg-surface/70 dark:bg-transparent inline-flex items-center gap-2 transition-all duration-200 hover:border-gray-300/75 dark:hover:border-white/9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background-light dark:focus-visible:ring-offset-background-dark
                                ${
                                  isGenerating
                                    ? 'opacity-70'
                                    : ''
                                }`}
              >
                {isGenerating ? (
                  <>
                    <div className="w-5 h-5 border border-white/30 border-t-white rounded-full animate-spin"></div>
                    {t('creationCanvas.creatingMagic', 'Creating Magic...')}
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 transition-transform duration-200 group-hover:rotate-[-8deg] group-hover:scale-105" />
                    <span className="text-left leading-[1.02] tracking-[0.01em]">
                      <span className="block text-[12px] font-medium">{t('creationCanvas.generate', 'Generate')}</span>
                      <span className="block text-[12px] font-semibold">{t('creationCanvas.masterpiece', 'Masterpiece')}</span>
                    </span>
                  </>
                )}
              </Button>
            </div>
        </div>
      </div>
      </section>

      {/* Modals outside the animated section to avoid CSS transform stacking context trapping fixed positioning */}
      <TemplateLibrary
        isOpen={isTemplateLibraryOpen}
        onClose={() => setIsTemplateLibraryOpen(false)}
        onSelectTemplate={handleTemplateSelect}
      />

      <StylePresetPicker
        isOpen={isStylePresetsOpen}
        onClose={() => setIsStylePresetsOpen(false)}
        onSelect={(preset) => {
          const resolvedStyle = normalizeArtStyle(preset.artStyle ?? preset.style);
          applyArtStyle(resolvedStyle, preset.style);
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
        <ShareModal isOpen={true} onClose={() => setSharingBook(null)} book={sharingBook.project} />
      )}
    </>
  );
};

export default CreationCanvas;

