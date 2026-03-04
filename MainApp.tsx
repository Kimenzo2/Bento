/**
 * MainApp - The Genesis Core Application
 *
 * This is the MAIN APPLICATION with the cream-themed UI.
 * It is completely separate from OnboardingApp at the router level.
 *
 * ARCHITECTURE:
 * - Only renders for users who have completed onboarding
 * - Has its own layout (Navigation, main content area)
 * - Uses cream theme from index.css
 * - All app-specific state and logic lives here
 */

import { Analytics } from '@vercel/analytics/react';
import { injectSpeedInsights } from '@vercel/speed-insights';
import type React from 'react';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import InstallPWA from './components/InstallPWA';
import Navigation from './components/Navigation';
import { Toaster, toast } from './components/ui/sonner';
import UpgradeModal from './components/UpgradeModal';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useGoogleOneTap } from './hooks/useGoogleOneTap';
import {
  generateBookStructure,
  generateBrandContent,
  generateIllustration,
} from './services/geminiService';
import { type UserProfile, getUserProfile } from './services/profileService';
import { supabase } from './services/supabaseClient';
import {
  canCreateEbook,
  getEbooksCreatedThisMonth,
  getMaxPages,
  incrementEbookCount,
} from './services/tierLimits';
import { FontProvider } from './src/contexts/FontContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import {
  AppMode,
  type BookProject,
  type GamificationState,
  type GenerationSettings,
  type SavedBook,
  UserTier,
} from './types';
import './src/config/i18n';

import { Loader2 } from 'lucide-react';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
// Global Components
import WhatsNewModal from './components/WhatsNewModal';
import { OfflineIndicator, useNetworkStatus } from './hooks/useNetworkStatus';

// PERFORMANCE: Lazy load heavy components with stale-chunk recovery.
// When a deployment changes chunk hashes, old HTML may reference chunks
// that no longer exist. This wrapper retries once, then reloads the page
// to fetch the new index.html with correct chunk references.
function lazyWithRetry(
  importFn: () => Promise<{ default: React.ComponentType<any> }>
) {
  return lazy(() =>
    importFn().catch((error: Error) => {
      // Only auto-reload once per session to avoid infinite loops
      const key = 'genesis_chunk_reload';
      const lastReload = sessionStorage.getItem(key);
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 10_000) {
        sessionStorage.setItem(key, String(now));
        console.warn('[Genesis] Chunk load failed, reloading for fresh assets…', error.message);
        window.location.reload();
      }
      throw error; // If we already reloaded recently, let the error boundary handle it
    })
  );
}

const CreationCanvas = lazyWithRetry(() => import('./components/CreationCanvas'));
const SmartEditor = lazyWithRetry(() => import('./components/SmartEditor'));
const VisualStudio = lazyWithRetry(() => import('./components/VisualStudio'));
const SettingsPanel = lazyWithRetry(() => import('./components/SettingsPanel'));
const PricingPage = lazyWithRetry(() => import('./components/PricingPage'));
const GamificationHub = lazyWithRetry(() => import('./components/GamificationHub'));
const BookSuccessView = lazyWithRetry(() => import('./components/BookSuccessView'));
const GenerationTheater = lazyWithRetry(() => import('./components/GenerationTheater'));
const StorybookViewer = lazyWithRetry(() => import('./components/StorybookViewer'));
const SharedBookViewer = lazyWithRetry(() => import('./components/SharedBookViewer'));
const LegalViewer = lazyWithRetry(() => import('./components/LegalViewer'));

const MainAppContent: React.FC = () => {
  // Initialize Google One Tap
  useGoogleOneTap();

  // Initialize Vercel Speed Insights
  useEffect(() => {
    injectSpeedInsights();
  }, []);

  // Auth state
  const { user, loading: authLoading } = useAuth();

  // App state
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.DASHBOARD);
  const [currentProject, setCurrentProject] = useState<BookProject | null>(null);
  const [viewingBook, setViewingBook] = useState<BookProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [forceRenderKey, setForceRenderKey] = useState(0);

  // Global Modals State
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Network Status
  const networkStatus = useNetworkStatus();

  // User Profile State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Toast helper — delegates to Sonner
  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const fn = type === 'success' ? toast.success
             : type === 'error' ? toast.error
             : type === 'warning' ? toast.warning
             : toast.info;
    fn(message);
  };

  // Listen for theme and language changes
  useEffect(() => {
    const handleThemeChange = () => {
      console.log('[MainApp] Theme changed, forcing re-render');
      setForceRenderKey((prev) => prev + 1);
    };

    const handleLanguageChange = () => {
      console.log('[MainApp] Language changed, forcing re-render');
      setForceRenderKey((prev) => prev + 1);
    };

    window.addEventListener('themeChanged', handleThemeChange);
    window.addEventListener('languageChanged', handleLanguageChange);

    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
      window.removeEventListener('languageChanged', handleLanguageChange);
    };
  }, []);

  // Handle Screen Orientation
  useEffect(() => {
    const applyOrientation = async () => {
      try {
        const savedSettings = localStorage.getItem('genesis_settings');
        const settings = savedSettings ? JSON.parse(savedSettings) : {};
        const autoRotate = settings.autoRotate || false;

        if (screen.orientation && 'lock' in screen.orientation) {
          if (autoRotate) {
            screen.orientation.unlock();
          } else {
            await (screen.orientation as any).lock('portrait').catch((e: any) => {
              console.warn('Orientation lock failed:', e);
            });
          }
        }
      } catch (e) {
        console.warn('Failed to set screen orientation:', e);
      }
    };

    applyOrientation();

    const handleSettingsChange = () => applyOrientation();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') applyOrientation();
    };

    window.addEventListener('genesis-settings-changed', handleSettingsChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('genesis-settings-changed', handleSettingsChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) {
        if (currentMode !== AppMode.DASHBOARD) setCurrentMode(AppMode.DASHBOARD);
        return;
      }
      const targetMode = Object.values(AppMode).find(
        (m) => m.toLowerCase().replace(/\s+/g, '-') === hash.toLowerCase()
      ) as AppMode | undefined;
      if (targetMode && targetMode !== currentMode) setCurrentMode(targetMode);
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const modeSlug = currentMode.toLowerCase().replace(/\s+/g, '-');
    const targetHash = currentMode === AppMode.DASHBOARD ? '' : modeSlug;

    if (hash !== targetHash) {
      if (currentMode === AppMode.DASHBOARD) {
        window.history.pushState(null, '', window.location.pathname);
      } else {
        window.history.pushState(null, '', `#${targetHash}`);
      }
    }
  }, [currentMode]);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoadingProfile(true);
      const profile = await getUserProfile();
      setUserProfile(profile);
      setIsLoadingProfile(false);
    };

    fetchProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: string, session: any) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setTimeout(async () => {
            const profile = await getUserProfile();
            if (!profile && session?.user) {
              setTimeout(async () => {
                const retryProfile = await getUserProfile();
                setUserProfile(retryProfile);
              }, 1000);
            } else {
              setUserProfile(profile);
            }
          }, 500);
        } else if (event === 'SIGNED_OUT') {
          setUserProfile(null);
        }
      }
    );

    return () => authListener.subscription.unsubscribe();
  }, []);

  // Derive tier and gamification state
  const rawTier = userProfile?.user_tier;
  const currentUserTier =
    rawTier && Object.values(UserTier).includes(rawTier as UserTier)
      ? (rawTier as UserTier)
      : UserTier.SPARK;

  const gamificationState: GamificationState = userProfile?.gamification_data || {
    level: 1,
    levelTitle: 'Novice Author',
    currentXP: 0,
    nextLevelXP: 100,
    booksCreatedCount: 0,
    currentStreak: 0,
    lastActivityDate: undefined,
    badges: [
      {
        id: '1',
        name: 'First Spark',
        description: 'Create your first book',
        icon: 'rocket',
        unlocked: false,
      },
      {
        id: '2',
        name: 'Style Explorer',
        description: 'Try 3 different styles',
        icon: 'palette',
        unlocked: false,
      },
      {
        id: '3',
        name: 'Wordsmith',
        description: 'Write 5,000 words',
        icon: 'feather',
        unlocked: false,
      },
      {
        id: '4',
        name: 'Bestseller',
        description: 'Get 1,000 views',
        icon: 'diamond',
        unlocked: false,
      },
    ],
    dailyChallenges: [
      { id: 'c1', title: "Create a Children's Book", xpReward: 50, completed: false },
      { id: 'c2', title: 'Try a new Art Style', xpReward: 75, completed: false },
      { id: 'c3', title: 'Share a book', xpReward: 100, completed: false },
    ],
  };

  const checkTierLimits = (settings: GenerationSettings): boolean => {
    const ebooksThisMonth = getEbooksCreatedThisMonth();
    if (!canCreateEbook(currentUserTier, ebooksThisMonth)) {
      setShowUpgradeModal(true);
      addToast(`You've reached your monthly limit. Upgrade to create more ebooks!`, 'error');
      return false;
    }
    const maxPages = getMaxPages(currentUserTier);
    if (settings.pageCount > maxPages) {
      setShowUpgradeModal(true);
      addToast(`Your tier allows up to ${maxPages} pages per book. Upgrade for more!`, 'error');
      return false;
    }
    return true;
  };

  const handleGenerateProject = async (settings: GenerationSettings) => {
    if (!checkTierLimits(settings)) return;

    setIsGenerating(true);
    setGenerationProgress(0);

    const isBrandContent = settings.brandStoryConfig && settings.brandStoryConfig.companyInfo?.name;
    setGenerationStatus(
      isBrandContent ? 'Creating professional brand content...' : 'Architecting story structure...'
    );

    try {
      setGenerationProgress(5);
      const structure = isBrandContent
        ? await generateBrandContent(settings, settings.brandStoryConfig!)
        : await generateBookStructure(settings);

      if (!structure.chapters?.length || !structure.chapters[0].pages?.length) {
        throw new Error('Generated content is empty. Please try again.');
      }

      setGenerationProgress(15);
      const newProject: BookProject = {
        id: crypto.randomUUID(),
        title: structure.title || 'Untitled Masterpiece',
        synopsis: structure.synopsis || '',
        style: settings.style,
        tone: settings.tone,
        targetAudience: settings.audience,
        isBranching: settings.isBranching,
        brandProfile: settings.brandProfile,
        metadata: structure.metadata,
        decisionTree: structure.decisionTree,
        backMatter: structure.backMatter,
        seriesInfo: structure.seriesInfo,
        chapters: (structure.chapters || []).map((c) => ({
          id: crypto.randomUUID(),
          title: c.title || 'Chapter',
          pages: (c.pages || []).map((p: any) => ({
            id: crypto.randomUUID(),
            pageNumber: p.pageNumber,
            text: p.text,
            imagePrompt: p.imagePrompt,
            layoutType: p.layoutType || 'text-only',
            choices: p.choices || [],
            narrationNotes: p.narrationNotes,
            interactiveElement: p.interactiveElement,
            learningMoment: p.learningMoment,
            vocabularyWords: p.vocabularyWords,
          })),
        })),
        characters: (structure.characters || []).map((c: any) => ({
          id: crypto.randomUUID(),
          name: c.name,
          description: c.description,
          visualTraits: c.visualTraits,
          visualPrompt: c.visualPrompt,
          traits: c.traits,
        })),
        createdAt: new Date(),
      };

      const allPages = newProject.chapters.flatMap((c) => c.pages);
      const totalPages = allPages.length;
      let processedCount = 0;

      for (const page of allPages) {
        if (page.imagePrompt) {
          let attempts = 0;
          while (attempts < 3) {
            try {
              const imageUrl = await generateIllustration(page.imagePrompt, settings.style);
              if (imageUrl) {
                page.imageUrl = imageUrl;
                break;
              }
            } catch (err) {
              attempts++;
              if (attempts < 3) await new Promise((r) => setTimeout(r, 2000));
            }
          }
        }
        processedCount++;
        setGenerationProgress(20 + (processedCount / totalPages) * 60);
        setGenerationStatus(`Painting page ${processedCount} of ${totalPages}...`);
      }

      try {
        const coverPrompt = `Book cover for "${newProject.title}". Style: ${newProject.style}. Synopsis: ${newProject.synopsis}.`;
        const coverUrl = await generateIllustration(coverPrompt, settings.style);
        if (coverUrl) newProject.coverImage = coverUrl;
      } catch {}

      setGenerationProgress(100);
      setGenerationStatus('Complete!');
      await new Promise((r) => setTimeout(r, 1000));

      incrementEbookCount();
      setCurrentProject(newProject);
      setCurrentMode(AppMode.SUCCESS);
    } catch (error) {
      console.error('Generation failed', error);
      addToast(
        `Failed to generate project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
      setGenerationProgress(0);
    }
  };

  const handleEditBook = (book: SavedBook) => {
    setCurrentProject(book.project);
    setCurrentMode(AppMode.EDITOR);
  };

  const handleReadBook = (book: SavedBook) => {
    setViewingBook(book.project);
    setCurrentMode(AppMode.VIEWER);
  };

  const handleUpgrade = async (newTier: UserTier) => {
    const { updateUserTier } = await import('./services/profileService');
    await updateUserTier(newTier);
    const profile = await getUserProfile();
    setUserProfile(profile);
    setShowUpgradeModal(false);
    addToast(`Welcome to the ${newTier} tier!`, 'success');
  };

  const renderContent = () => {
    switch (currentMode) {
      case AppMode.CREATION:
      case AppMode.DASHBOARD:
        return (
          <CreationCanvas
            onGenerate={handleGenerateProject}
            isGenerating={isGenerating}
            generationStatus={generationStatus}
            onEditBook={handleEditBook}
            onReadBook={handleReadBook}
            userTier={currentUserTier}
            shouldFocusCreation={currentMode === AppMode.CREATION}
          />
        );
      case AppMode.SUCCESS:
        if (!currentProject)
          return (
            <CreationCanvas
              onGenerate={handleGenerateProject}
              isGenerating={isGenerating}
              generationStatus={generationStatus}
            />
          );
        return (
          <BookSuccessView
            project={currentProject}
            onNavigate={setCurrentMode}
            userTier={currentUserTier}
          />
        );
      case AppMode.EDITOR:
        return (
          <SmartEditor
            project={currentProject}
            onUpdateProject={setCurrentProject}
            userTier={currentUserTier}
            onShowUpgrade={() => setShowUpgradeModal(true)}
            onSave={(success: boolean, message: string) => addToast(message, success ? 'success' : 'error')}
            onBack={() => setCurrentMode(AppMode.DASHBOARD)}
            onNavigateToCreate={() => setCurrentMode(AppMode.CREATION)}
          />
        );
      case AppMode.VISUAL_STUDIO:
        return (
          <VisualStudio
            project={currentProject}
            onBack={() => setCurrentMode(AppMode.DASHBOARD)}
            userProfile={userProfile}
            onNavigate={setCurrentMode}
            onUpdateProject={setCurrentProject}
          />
        );
      case AppMode.SETTINGS:
        return (
          <SettingsPanel
            onNavigate={setCurrentMode}
            userTier={currentUserTier}
            onViewBook={handleReadBook}
          />
        );
      case AppMode.LEGAL:
        return <LegalViewer onNavigate={setCurrentMode} />;
      case AppMode.VIEWER:
        if (!viewingBook)
          return (
            <CreationCanvas
              onGenerate={handleGenerateProject}
              isGenerating={isGenerating}
              generationStatus={generationStatus}
              onEditBook={handleEditBook}
              onReadBook={handleReadBook}
            />
          );
        return (
          <StorybookViewer
            project={viewingBook}
            onClose={() => {
              setViewingBook(null);
              setCurrentMode(AppMode.DASHBOARD);
            }}
            onEdit={() => {
              setCurrentProject(viewingBook);
              setViewingBook(null);
              setCurrentMode(AppMode.EDITOR);
            }}
            onDownload={() => setCurrentMode(AppMode.PRICING)}
            onShare={() => console.log('Share triggered')}
          />
        );
      case AppMode.PRICING:
        return <PricingPage onUpgrade={handleUpgrade} />;
      case AppMode.GAMIFICATION:
        return <GamificationHub gameState={gamificationState} setMode={setCurrentMode} />;
      default:
        return (
          <CreationCanvas
            onGenerate={handleGenerateProject}
            isGenerating={isGenerating}
            generationStatus={generationStatus}
          />
        );
    }
  };

  const location = useLocation();
  const isSharedRoute = location.pathname.startsWith('/shared/');
  const isProcessingAuth =
    window.location.hash.includes('access_token') ||
    window.location.hash.includes('error_description');

  // Loading state during OAuth
  if (authLoading || isProcessingAuth) {
    return (
      <div className="min-h-screen bg-cream-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-coral-burst border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-charcoal-soft/70 font-medium">Signing you in...</p>
        </div>
      </div>
    );
  }

  // Shared book route
  if (isSharedRoute) {
    return (
      <div className="min-h-screen bg-cream-base">
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <div className="animate-spin w-8 h-8 border-4 border-coral-burst border-t-transparent rounded-full" />
            </div>
          }
        >
          <Routes>
            <Route path="/shared/:shortCode" element={<SharedBookViewer />} />
          </Routes>
        </Suspense>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-base text-charcoal-soft font-body selection:bg-coral-burst/30 selection:text-charcoal-soft">
      <Navigation currentMode={currentMode} setMode={setCurrentMode} />
      <main className="pt-20 relative transition-all duration-300 overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <Suspense fallback={<div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-coral-burst" /></div>} key={forceRenderKey}>{renderContent()}</Suspense>
      </main>

      {isGenerating && (
        <Suspense fallback={<div className="fixed inset-0 z-100 flex items-center justify-center bg-white/90"><Loader2 className="w-8 h-8 animate-spin text-coral-burst" /></div>}>
          <GenerationTheater progress={generationProgress} status={generationStatus} onCancel={() => { setIsGenerating(false); setGenerationStatus(''); setGenerationProgress(0); }} />
        </Suspense>
      )}

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={() => {
          setShowUpgradeModal(false);
          setCurrentMode(AppMode.PRICING);
        }}
      />

      <Toaster />
      <Analytics />
      <InstallPWA />

      <WhatsNewModal isOpen={showWhatsNew} onClose={() => setShowWhatsNew(false)} />
      <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      <div className="fixed bottom-4 left-4 z-50">
        <OfflineIndicator />
      </div>
    </div>
  );
};

// Wrap with providers
const MainApp: React.FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <FontProvider>
        <LanguageProvider>
          <MainAppContent />
        </LanguageProvider>
      </FontProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default MainApp;
