/**
 * SmartEditor.tsx — Genesis Page Editor (Three-Panel Reimagination)
 *
 * Mobile-first, three-panel desktop layout:
 *   Left  (260px): Writing companion — page nav + writing
 *   Center (flex):  Illustration HERO + story text preview
 *   Right (300px):  Intelligence — Gen companion + metrics + generation
 *
 * Responsive breakpoints:
 *   Mobile (<768px):  Single column, Write/Preview swipe + bottom sheet
 *   Tablet (768-1024): Two-panel split + slide-over intelligence
 *   Desktop (≥1024):  Full three-panel
 *
 * Also handles:
 *   - Standalone mode (Creative Hub, no project)
 *   - Canvas view (ReactFlow)
 *   - Green Room & Remix Studio modals
 *   - Focus mode (sidebars collapse, center expands)
 *   - Keyboard shortcuts
 *   - Audience Safety panel
 *
 * DNA rules: zero hardcoded colours, zero filter:blur,
 * active:scale-[0.98] on buttons, Geist for UI chrome.
 */

import type React from 'react';
import { useEffect, useState, lazy, Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactFlowProvider } from '@xyflow/react';
import {
  ArrowLeft,
  Brain,
  ChevronLeft,
  ChevronRight,
  Compass,
  Edit3,
  Eye,
  GitFork,
  Globe,
  MessageCircle,
  Users,
  X,
} from 'lucide-react';
import { IcoBook, IcoPen, IcoStar, IcoWand, IcoZap } from './IconscoutIcons';

import { useEditorState } from '@hooks/useEditorState';
import EditorHeader from './editor/EditorHeader';
import EditorLeftZone from './editor/EditorLeftZone';
import CenterPanel from './editor/CenterPanel';
import IntelligencePanel from './editor/IntelligencePanel';
import FocusModeWritingPanel from './editor/FocusMode';

import AudienceSafety from './AudienceSafety';
import GreenRoom from './GreenRoom';
import RemixStudio from './RemixStudio';
import { Button } from '@components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import {
  ArtStyle,
  type BookProject,
  BookTone,
  type Character,
  type CharacterPersona,
  UserTier,
} from '../types';

const StoryCanvas = lazy(() => import('./canvas/StoryCanvas'));

const geist: React.CSSProperties = {
  fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface SmartEditorProps {
  project: BookProject | null;
  onUpdateProject: (project: BookProject) => void;
  userTier?: UserTier;
  onShowUpgrade?: () => void;
  onSave?: (success: boolean, message: string) => void;
  onBack?: () => void;
  onNavigateToCreate?: () => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

// ─────────────────────────────────────────────────────────────
// DEFAULT CHARACTERS — for standalone Creative Hub
// ─────────────────────────────────────────────────────────────

const defaultCharacters: Character[] = [
  {
    id: 'demo-luna',
    name: 'Luna the Moon Fairy',
    description: 'A graceful fairy who tends to moonflowers and grants wishes to kind-hearted children.',
    visualTraits: 'Translucent wings that shimmer with captured starlight, flowing silver hair, pale luminescent skin with a soft blue glow',
    imageUrl: '/assets/characters/Demo Character 1.jpeg',
    traits: ['ethereal', 'nurturing', 'melancholic', 'wise', 'gentle'],
    personalityTraits: ['Deeply empathetic', 'Quietly observant', 'Eternally patient'],
  },
  {
    id: 'demo-blaze',
    name: 'Blaze the Dragon',
    description: 'A young dragon who hatched with flames too powerful for his small body.',
    visualTraits: 'Compact dragon about the size of a large dog, scales that shift from deep crimson to bright orange',
    imageUrl: '/assets/characters/Demo character 2.jpeg',
    traits: ['enthusiastic', 'clumsy', 'loyal', 'insecure', 'brave'],
    personalityTraits: ['Desperately eager to please', 'Heart of gold', 'Self-deprecating humor'],
  },
  {
    id: 'demo-aurora',
    name: 'Princess Aurora',
    description: 'Third in line to the throne and determined to stay that way.',
    visualTraits: 'Athletic build, wild auburn hair, bright green eyes that spark with mischief',
    imageUrl: '/assets/characters/Demo character 3.jpeg',
    traits: ['rebellious', 'courageous', 'compassionate', 'stubborn'],
    personalityTraits: ['Fiercely independent', 'Protector of the underdog', 'Quick-witted'],
  },
  {
    id: 'demo-captain',
    name: 'Captain Silverhook',
    description: 'Once the most feared pirate, now sailing under a different flag — his own redemption.',
    visualTraits: 'Weathered face with kind crinkles around steel-grey eyes, salt-and-pepper beard',
    imageUrl: '/assets/characters/Demo character 4.jpeg',
    traits: ['reformed', 'wise', 'haunted', 'generous'],
    personalityTraits: ['Gruff exterior hiding a tender heart', 'Mentor figure', 'Carries guilt gracefully'],
  },
];

const DEMO_PROJECT: BookProject = {
  id: 'demo-project',
  title: 'Creative Hub Demo',
  synopsis: 'Explore the creative tools without a project',
  style: ArtStyle.PIXAR_3D,
  tone: BookTone.PLAYFUL,
  targetAudience: 'Children (5-8)',
  isBranching: false,
  chapters: [
    {
      id: 'demo-chapter',
      title: 'Demo Chapter',
      pages: [{
        id: 'demo-page',
        pageNumber: 1,
        text: 'Welcome to the Creative Hub! This is a demo space to explore features.',
        imagePrompt: 'A magical workshop filled with creative tools and sparkling ideas',
        layoutType: 'text-only',
      }],
    },
  ],
  characters: defaultCharacters,
  createdAt: new Date(),
};

// ═════════════════════════════════════════════════════════════
// SMART EDITOR COMPONENT
// ═════════════════════════════════════════════════════════════

const SmartEditor: React.FC<SmartEditorProps> = ({
  project,
  onUpdateProject,
  userTier = UserTier.SPARK,
  onShowUpgrade,
  onSave,
  onBack,
  onNavigateToCreate,
}) => {
  const { t } = useTranslation('editor');
  const { userProfile } = useAuth();
  const isStandaloneMode = !project;
  const workingProject = project || DEMO_PROJECT;

  // ── Standalone mode state ──
  const [showGreenRoomStandalone, setShowGreenRoomStandalone] = useState(false);
  const [showRemixStudioStandalone, setShowRemixStudioStandalone] = useState(false);
  const [selectedDemoCharacter, setSelectedDemoCharacter] = useState<Character | null>(null);

  // ═══════════════════════════════════════════════
  // STANDALONE MODE — Creative Hub (no project)
  // ═══════════════════════════════════════════════
  if (isStandaloneMode) {
    return (
      <div className="min-h-[calc(100dvh-80px)] w-full overflow-auto" style={{ background: 'linear-gradient(to bottom right, var(--color-background), color-mix(in srgb, var(--color-border) 20%, var(--color-background)), var(--color-background))' }}>
        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-peach-soft px-6 py-4" style={{ backgroundColor: 'color-mix(in srgb, var(--color-surface) 80%, transparent)' }}>
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
                  <ArrowLeft className="w-5 h-5 text-charcoal-soft" />
                </Button>
              )}
              <div>
                <h1 className="font-heading font-bold text-2xl text-charcoal-soft">{t('smartEditor.creativeHub', 'Creative Hub')}</h1>
                <p className="text-sm text-cocoa-light">{t('smartEditor.exploreCreativeTools', 'Explore creative tools & discover worlds')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-coral-burst mb-4" style={{ background: 'linear-gradient(to right, color-mix(in srgb, var(--color-primary-end) 20%, transparent), color-mix(in srgb, var(--color-primary-start) 20%, transparent))' }}>
              <IcoWand className="w-4 h-4" />
              {t('smartEditor.welcomeCreativeHub', 'Welcome to the Creative Hub')}
            </div>
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-charcoal-soft mb-4">
              {t('smartEditor.creativePlaygroundAwaits', 'Your Creative Playground Awaits')}
            </h2>
            <p className="text-cocoa-light text-lg max-w-2xl mx-auto">
              {t('smartEditor.creativePlaygroundDescription', 'Interview characters, discover remixable worlds, and unleash your creativity - all without needing a project first.')}
            </p>
          </div>

          {/* Feature Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <div className="rounded-2xl p-6 border border-peach-soft transition-all group" style={{ backgroundColor: 'var(--color-surface)' }}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform" style={{ background: 'linear-gradient(to bottom right, var(--color-primary-start), var(--color-primary-end))' }}>
                <IcoPen className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-heading font-bold text-xl text-charcoal-soft mb-2">{t('smartEditor.createBook', 'Create a Book')}</h3>
              <p className="text-cocoa-light text-sm mb-4">{t('smartEditor.createBookDescription', 'Start your storytelling journey. Generate a complete illustrated book with AI assistance.')}</p>
              <Button variant="primary" onClick={onNavigateToCreate} className="w-full font-heading hover:opacity-90">
                <IcoZap className="w-4 h-4" /> {t('smartEditor.startCreating', 'Start Creating')}
              </Button>
            </div>

            <div className="rounded-2xl p-6 border border-peach-soft transition-all group" style={{ backgroundColor: 'var(--color-surface)' }}>
              <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-heading font-bold text-xl text-charcoal-soft mb-2">{t('smartEditor.greenRoom', 'The Green Room')}</h3>
              <p className="text-cocoa-light text-sm mb-4">{t('smartEditor.greenRoomDescription', 'Interview characters to discover their personalities, backstories, and hidden depths.')}</p>
              <Button onClick={() => setShowGreenRoomStandalone(true)} className="w-full bg-emerald-500 text-white font-heading hover:opacity-90">
                <Users className="w-4 h-4" /> {t('smartEditor.enterGreenRoom', 'Enter Green Room')}
              </Button>
            </div>

            <div className="rounded-2xl p-6 border border-peach-soft transition-all group" style={{ backgroundColor: 'var(--color-surface)' }}>
              <div className="w-14 h-14 rounded-xl bg-purple-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <GitFork className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-heading font-bold text-xl text-charcoal-soft mb-2">{t('smartEditor.remixStudio', 'Remix Studio')}</h3>
              <p className="text-cocoa-light text-sm mb-4">{t('smartEditor.remixStudioDescription', 'Discover and fork magical worlds created by other storytellers.')}</p>
              <Button onClick={() => setShowRemixStudioStandalone(true)} className="w-full bg-purple-500 text-white font-heading hover:opacity-90">
                <Compass className="w-4 h-4" /> {t('smartEditor.exploreWorlds', 'Explore Worlds')}
              </Button>
            </div>
          </div>

          {/* Demo Characters */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-heading font-bold text-xl text-charcoal-soft">{t('smartEditor.meetDemoCharacters', 'Meet Demo Characters')}</h3>
                <p className="text-sm text-cocoa-light">{t('smartEditor.tryInterviewingCharacters', 'Try interviewing these characters in the Green Room')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {defaultCharacters.map((char) => (
                <button
                  type="button"
                  key={char.id}
                  onClick={() => { setSelectedDemoCharacter(char); setShowGreenRoomStandalone(true); }}
                  className="p-4 rounded-xl border border-peach-soft/50 hover:border-emerald-300 group text-left flex flex-col cursor-pointer transition-all w-full"
                  style={{ backgroundColor: 'var(--color-surface)' }}
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform overflow-hidden relative shrink-0">
                    {char.imageUrl ? (
                      <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-xl font-bold">{char.name[0]}</span>
                    )}
                  </div>
                  <h4 className="font-heading font-bold text-charcoal-soft text-sm mb-1 truncate">{char.name}</h4>
                  <p className="text-xs text-cocoa-light line-clamp-2">{char.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="rounded-2xl p-8 text-white" style={{ background: 'linear-gradient(to right, var(--color-text), color-mix(in srgb, var(--color-text) 90%, transparent))' }}>
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
                  <IcoStar className="w-6 h-6 text-gold-sunshine" />
                </div>
                <div className="font-heading font-bold text-2xl mb-1">{t('smartEditor.aiPowered', 'AI-Powered')}</div>
                <div className="text-white/70 text-sm">{t('smartEditor.aiPoweredDescription', 'Characters respond with unique personalities')}</div>
              </div>
              <div>
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
                  <Globe className="w-6 h-6 text-coral-burst" />
                </div>
                <div className="font-heading font-bold text-2xl mb-1">{t('smartEditor.community', 'Community')}</div>
                <div className="text-white/70 text-sm">{t('smartEditor.communityDescription', 'Discover worlds from other creators')}</div>
              </div>
              <div>
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
                  <IcoBook className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="font-heading font-bold text-2xl mb-1">{t('smartEditor.storyBible', 'Story Bible')}</div>
                <div className="text-white/70 text-sm">{t('smartEditor.storyBibleDescription', 'Extract facts to enrich your stories')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Green Room Modal for Standalone */}
        {showGreenRoomStandalone && (
          <GreenRoom
            isOpen={showGreenRoomStandalone}
            onClose={() => { setShowGreenRoomStandalone(false); setSelectedDemoCharacter(null); }}
            project={DEMO_PROJECT}
            character={selectedDemoCharacter || defaultCharacters[0]}
            userId={userProfile?.id}
          />
        )}

        {/* Remix Studio Modal for Standalone */}
        <RemixStudio
          isOpen={showRemixStudioStandalone}
          onClose={() => setShowRemixStudioStandalone(false)}
          userId={userProfile?.id}
          userName={userProfile?.display_name || userProfile?.email}
          onForkWorld={(world) => { if (import.meta.env.DEV) console.warn('Forked world in standalone mode:', world); setShowRemixStudioStandalone(false); }}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // EDITOR MODE — Three-panel layout
  // ═══════════════════════════════════════════════

  return (
    <EditorInner
      project={workingProject}
      onUpdateProject={onUpdateProject}
      userTier={userTier}
      onShowUpgrade={onShowUpgrade}
      onSave={onSave}
      onBack={onBack}
    />
  );
};

// ═════════════════════════════════════════════════════════════
// EDITOR INNER — the actual three-panel editor
// Separated so hooks are only called when we have a project.
// ═════════════════════════════════════════════════════════════

interface EditorInnerProps {
  project: BookProject;
  onUpdateProject: (project: BookProject) => void;
  userTier?: UserTier;
  onShowUpgrade?: () => void;
  onSave?: (success: boolean, message: string) => void;
  onBack?: () => void;
}

const EditorInner: React.FC<EditorInnerProps> = ({
  project,
  onUpdateProject,
  userTier = UserTier.SPARK,
  onShowUpgrade,
  onSave,
  onBack,
}) => {
  const { t } = useTranslation('editor');
  const { userProfile } = useAuth();
  const [showIntelligenceSheet, setShowIntelligenceSheet] = useState(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  const editor = useEditorState({
    project,
    onUpdateProject,
    userTier,
    onShowUpgrade,
    onSave,
  });

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+S — save
      if (isMod && e.key === 's') {
        e.preventDefault();
        editor.handleSave();
        return;
      }

      // Cmd+Shift+F — focus mode
      if (isMod && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        editor.toggleFocusMode();
        return;
      }

      // Cmd+G — generate
      if (isMod && e.key === 'g') {
        e.preventDefault();
        editor.handleGenerateImage();
        return;
      }

      // Cmd+→ — next page
      if (isMod && e.key === 'ArrowRight') {
        e.preventDefault();
        if (editor.activePageIndex < editor.totalPages - 1) {
          editor.setActivePageIndex(editor.activePageIndex + 1);
        }
        return;
      }

      // Cmd+← — prev page
      if (isMod && e.key === 'ArrowLeft') {
        e.preventDefault();
        if (editor.activePageIndex > 0) {
          editor.setActivePageIndex(editor.activePageIndex - 1);
        }
        return;
      }

      // Cmd+Enter — new page
      if (isMod && e.key === 'Enter') {
        e.preventDefault();
        editor.addPage();
        return;
      }

      // Cmd+[ — toggle left sidebar
      if (isMod && e.key === '[') {
        e.preventDefault();
        setIsLeftCollapsed((v) => !v);
        return;
      }

      // Cmd+] — toggle right sidebar
      if (isMod && e.key === ']') {
        e.preventDefault();
        setIsRightCollapsed((v) => !v);
        return;
      }

      // Escape — exit focus mode / close panels
      if (e.key === 'Escape') {
        if (editor.isFocusMode) {
          e.preventDefault();
          editor.setIsFocusMode(false);
        }
        if (showIntelligenceSheet) {
          setShowIntelligenceSheet(false);
        }
        editor.setShowImproveOptions(false);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, showIntelligenceSheet]);

  const activePage = editor.activePage;

  if (!activePage) {
    return (
      <div className="text-center p-20 font-heading text-2xl text-cocoa-light">
        {t('smartEditor.loadingMasterpiece', 'Loading masterpiece...')}
      </div>
    );
  }

  // ── Reduced-motion check (cached, won't change during session) ──
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const transitionStyle = prefersReducedMotion ? 'none' : 'all 280ms ease-out';

  return (
    <div className="h-[calc(100dvh-80px)] w-full flex flex-col relative overflow-hidden">
      {/* ── CANVAS VIEW — desktop only overlay ── */}
      {editor.editorView === 'canvas' && (
        <>
          {/* Mobile canvas fallback */}
          <div className="lg:hidden absolute inset-0 z-40 flex flex-col items-center justify-center px-8 text-center" style={{ backgroundColor: 'var(--color-background)' }}>
            <img
              src="/images/onboarding/Style_directive_highend_202512150033.jpeg"
              alt={t('smartEditor.genAssistantAlt', 'Gen, your AI creative assistant')}
              className="w-24 h-24 rounded-full object-cover mb-6"
              style={{ boxShadow: '0 0 30px 6px color-mix(in srgb, var(--color-primary-start) 30%, transparent)' }}
              draggable={false}
            />
            <p className="font-heading text-lg text-charcoal-soft mb-2">{t('smartEditor.canvasBestOnDesktop', 'Canvas view is best on desktop')}</p>
            <p className="font-body text-sm text-cocoa-light mb-6 max-w-xs">
              {t('smartEditor.canvasDesktopHint', 'I can show you the full picture on a bigger screen. For now, Pages view is your best way to create.')}
            </p>
            <button
              type="button"
              onClick={() => editor.setEditorView('pages')}
              className="px-5 py-2 rounded-lg bg-coral-burst text-white font-body text-sm font-medium cursor-pointer"
            >
              {t('smartEditor.switchToPages', 'Switch to Pages')}
            </button>
          </div>

          {/* Desktop canvas */}
          <div className="hidden lg:block absolute inset-0 z-30">
            <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-cocoa-light font-body">{t('smartEditor.loadingCanvas', 'Loading canvas...')}</div>}>
              <ReactFlowProvider>
                <StoryCanvas
                  project={editor.currentProject}
                  onSwitchToPages={(pageNum) => {
                    editor.setEditorView('pages');
                    if (pageNum) editor.jumpToPageNumber(pageNum);
                  }}
                />
              </ReactFlowProvider>
            </Suspense>
          </div>
        </>
      )}

      {/* ── PAGES VIEW — the three-panel editor ── */}
      {editor.editorView === 'pages' && (
        <>
          {/* ── EDITOR HEADER (52px sticky) ── */}
          <EditorHeader editor={editor} onBack={onBack} />

          {/* ── MOBILE: Write/Preview Swipe Toggle + Intelligence Button ── */}
          <div
            className="lg:hidden h-12 flex items-center justify-between px-4 shrink-0 z-30 border-b"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            {/* Write / Preview toggle */}
            <div
              className="flex p-0.5 rounded-lg border border-peach-soft/50"
              style={{ backgroundColor: 'var(--color-background)' }}
            >
              <button
                type="button"
                onClick={() => editor.setMobileView('edit')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  editor.mobileView === 'edit'
                    ? 'text-coral-burst'
                    : 'text-cocoa-light'
                }`}
                style={{
                  backgroundColor: editor.mobileView === 'edit' ? 'var(--color-surface)' : 'transparent',
                  ...geist,
                  fontSize: 12,
                }}
              >
                <Edit3 className="w-3.5 h-3.5" /> {t('smartEditor.write', 'Write')}
              </button>
              <button
                type="button"
                onClick={() => editor.setMobileView('preview')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  editor.mobileView === 'preview'
                    ? 'text-coral-burst'
                    : 'text-cocoa-light'
                }`}
                style={{
                  backgroundColor: editor.mobileView === 'preview' ? 'var(--color-surface)' : 'transparent',
                  ...geist,
                  fontSize: 12,
                }}
              >
                <Eye className="w-3.5 h-3.5" /> {t('smartEditor.preview', 'Preview')}
              </button>
            </div>

            {/* Intelligence button — opens bottom sheet on mobile */}
            <button
              type="button"
              onClick={() => setShowIntelligenceSheet(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                text-cocoa-light hover:text-charcoal-soft hover:bg-peach-soft/40
                transition-all cursor-pointer active:scale-[0.98]"
              style={{ ...geist, fontSize: 12 }}
              aria-label={t('smartEditor.openIntelligencePanel', 'Open intelligence panel')}
            >
              <Brain className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('smartEditor.intelligence', 'Intelligence')}</span>
            </button>
          </div>

          {/* ── MAIN THREE-PANEL AREA ── */}
          <div className="flex-1 flex overflow-hidden relative" role="group" aria-label={t('smartEditor.editorPanels', 'Editor panels')}>
            {/* ── LEFT SIDEBAR (260px, desktop only; full-width on mobile Write view) ── */}
            <aside
              aria-label={t('smartEditor.writingCompanion', 'Writing companion')}
              className={`${
                editor.mobileView === 'preview' ? 'hidden lg:flex' : 'flex'
              } ${
                editor.isFocusMode ? 'lg:hidden' : ''
              } flex-col h-full overflow-hidden`}
              style={{
                transition: transitionStyle,
                width: isLeftCollapsed ? 0 : undefined,
                minWidth: isLeftCollapsed ? 0 : undefined,
                opacity: isLeftCollapsed ? 0 : 1,
              }}
            >
              <div className="w-full lg:w-auto h-full">
                <EditorLeftZone editor={editor} />
              </div>
            </aside>

            {/* ── LEFT COLLAPSE TOGGLE (desktop only) ── */}
            {!editor.isFocusMode && (
              <button
                type="button"
                onClick={() => setIsLeftCollapsed((v) => !v)}
                className="hidden lg:flex items-center justify-center shrink-0
                  text-cocoa-light hover:text-charcoal-soft
                  transition-all cursor-pointer z-10
                  hover:bg-peach-soft/40"
                style={{
                  width: 20,
                  height: '100%',
                  borderRight: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-background)',
                }}
                aria-label={isLeftCollapsed ? t('smartEditor.expandLeftSidebar', 'Expand left sidebar') : t('smartEditor.collapseLeftSidebar', 'Collapse left sidebar')}
                title={isLeftCollapsed ? t('smartEditor.expandLeftSidebar', 'Expand left sidebar') : t('smartEditor.collapseLeftSidebar', 'Collapse left sidebar')}
              >
                {isLeftCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronLeft className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {/* ── CENTER PANEL (flex: 1, illustration HERO) ── */}
            <main
              aria-label={t('smartEditor.storyEditor', 'Story editor')}
              className={`flex-1 min-w-0 ${
                editor.mobileView === 'edit' ? 'hidden lg:flex' : 'flex'
              }`}
              style={{ transition: transitionStyle }}
            >
              <CenterPanel editor={editor} />
            </main>

            {/* ── RIGHT COLLAPSE TOGGLE (desktop only) ── */}
            {!editor.isFocusMode && (
              <button
                type="button"
                onClick={() => setIsRightCollapsed((v) => !v)}
                className="hidden lg:flex items-center justify-center shrink-0
                  text-cocoa-light hover:text-charcoal-soft
                  transition-all cursor-pointer z-10
                  hover:bg-peach-soft/40"
                style={{
                  width: 20,
                  height: '100%',
                  borderLeft: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-background)',
                }}
                aria-label={isRightCollapsed ? t('smartEditor.expandRightSidebar', 'Expand right sidebar') : t('smartEditor.collapseRightSidebar', 'Collapse right sidebar')}
                title={isRightCollapsed ? t('smartEditor.expandRightSidebar', 'Expand right sidebar') : t('smartEditor.collapseRightSidebar', 'Collapse right sidebar')}
              >
                {isRightCollapsed ? (
                  <ChevronLeft className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {/* ── RIGHT SIDEBAR (300px, desktop only) ── */}
            <aside
              aria-label={t('smartEditor.intelligencePanel', 'Intelligence panel')}
              className={`hidden ${
                editor.isFocusMode ? '' : 'lg:flex'
              } overflow-hidden`}
              style={{
                transition: transitionStyle,
                width: isRightCollapsed ? 0 : undefined,
                minWidth: isRightCollapsed ? 0 : undefined,
                opacity: isRightCollapsed ? 0 : 1,
              }}
            >
              <IntelligencePanel editor={editor} />
            </aside>
          </div>

          {/* ── MOBILE: Intelligence Bottom Sheet ── */}
          {showIntelligenceSheet && (
            <div
              className="lg:hidden fixed inset-0 z-[70] flex flex-col justify-end"
              role="dialog"
              aria-modal="true"
              aria-label={t('smartEditor.intelligencePanel', 'Intelligence panel')}
              tabIndex={-1}
              onClick={() => setShowIntelligenceSheet(false)}
              onKeyDown={(e) => { if (e.key === 'Escape') setShowIntelligenceSheet(false); }}
            >
              {/* Backdrop */}
              <div
                className="absolute inset-0"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 30%, transparent)' }}
              />

              {/* Sheet */}
              <div
                className="relative w-full rounded-t-2xl overflow-hidden"
                style={{
                  maxHeight: '75dvh',
                  backgroundColor: 'var(--color-background)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drag handle */}
                <div className="flex justify-center py-2">
                  <div
                    className="w-10 h-1 rounded-full"
                    style={{ backgroundColor: 'var(--color-border)' }}
                  />
                </div>

                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setShowIntelligenceSheet(false)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center
                    text-cocoa-light hover:text-charcoal-soft hover:bg-peach-soft/40
                    transition-all cursor-pointer
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40"
                  aria-label={t('smartEditor.closeIntelligencePanel', 'Close intelligence panel')}
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Intelligence content — reuse the panel in fluid mode */}
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(75dvh - 40px)' }}>
                  <IntelligencePanel editor={editor} fluid />
                </div>
              </div>
            </div>
          )}

          {/* ── FOCUS MODE: Floating writing panel ── */}
          <FocusModeWritingPanel
            text={activePage.text}
            onChange={editor.handleTextChange}
            isVisible={editor.isFocusMode}
          />
        </>
      )}

      {/* ── AUDIENCE SAFETY PANEL (slide-over) ── */}
      {editor.showAudienceSafety && editor.storyBible?.audienceSafety && (
        <div
          className="fixed inset-0 z-[80] flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={t('smartEditor.audienceSafetyReview', 'Audience safety review')}
          tabIndex={-1}
          onClick={() => editor.setShowAudienceSafety(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') editor.setShowAudienceSafety(false); }}
        >          <div className="absolute inset-0" style={{ backgroundColor: 'color-mix(in srgb, var(--color-text) 20%, transparent)' }} />
          <div
            className="relative w-full max-w-md h-full overflow-y-auto border-l border-peach-soft p-6"
            style={{ backgroundColor: 'var(--color-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <AudienceSafety
              isAppropriate={editor.storyBible.audienceSafety.isAppropriate}
              warnings={editor.storyBible.audienceSafety.warnings}
              readingLevel={editor.storyBible.audienceSafety.readingLevel}
              recommendedAgeRange={editor.storyBible.audienceSafety.recommendedAgeRange}
              targetAudience={editor.currentProject.targetAudience}
              isAnalyzing={editor.isAnalyzing}
            />
          </div>
        </div>
      )}

      {/* ── GREEN ROOM MODAL ── */}
      {editor.showGreenRoom && editor.selectedCharacterForInterview && (
        <GreenRoom
          isOpen={editor.showGreenRoom}
          onClose={() => {
            editor.setShowGreenRoom(false);
            editor.setSelectedCharacterForInterview(null);
          }}
          project={editor.currentProject}
          character={editor.selectedCharacterForInterview}
          onPersonaUpdate={(persona: CharacterPersona) => {
            const updatedCharacters = editor.currentProject.characters.map((c) =>
              c.id === editor.selectedCharacterForInterview!.id
                ? {
                    ...c,
                    personalityTraits: [...(c.personalityTraits || []), ...persona.personality],
                    backstory: persona.background || c.backstory,
                  }
                : c
            );
            editor.setProjectHistory((prev) => ({ ...prev, characters: updatedCharacters }));
          }}
          userId={userProfile?.id}
        />
      )}

      {/* ── REMIX STUDIO MODAL ── */}
      <RemixStudio
        isOpen={editor.showRemixStudio}
        onClose={() => editor.setShowRemixStudio(false)}
        userId={userProfile?.id}
        userName={userProfile?.display_name || userProfile?.email}
        currentProject={editor.currentProject}
        onForkWorld={(world) => {
          if (import.meta.env.DEV) console.warn('Forked world:', world);
          editor.setShowRemixStudio(false);
        }}
      />
    </div>
  );
};

export default SmartEditor;
