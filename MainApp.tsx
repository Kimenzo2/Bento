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
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes, useLocation, useNavigate } from 'react-router';
import ErrorBoundary from './components/ErrorBoundary';
import InstallPWA from './components/InstallPWA';
import Navigation from './components/Navigation';
import { Toaster, toast } from './components/ui/sonner';
import UpgradeModal from './components/UpgradeModal';
import { useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useGoogleOneTap } from './hooks/useGoogleOneTap';
import { type UserProfile, getUserProfile } from './services/profileService';
import { invalidateBooksCache } from './services/storageService';
import { supabase } from './services/supabaseClient';
import { getEntitlements, isUnlimited, type TierName, userTierToTierName } from './config/entitlements';
import { getCurrentMonthUsage, incrementBookCount } from './services/usageService';
import { FontProvider } from './src/contexts/FontContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { mastra } from './src/services/mastraClient';
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
import AppSkeleton from './components/AppSkeleton';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import { DirectionProvider } from './components/ui/direction';
// Global Components
import WhatsNewModal from './components/WhatsNewModal';
import { OfflineIndicator, useNetworkStatus } from './hooks/useNetworkStatus';
import { useLanguageContext } from './src/contexts/LanguageContext';

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
const AccountPage = lazyWithRetry(() => import('./components/AccountPage'));

// ── Path-based routing helpers ────────────────────────────────────────────────
const MODE_TO_PATH: Partial<Record<AppMode, string>> = {
  [AppMode.DASHBOARD]:     '/',
  [AppMode.CREATION]:      '/create',
  [AppMode.EDITOR]:        '/editor',
  [AppMode.VISUAL_STUDIO]: '/visual-studio',
  [AppMode.SETTINGS]:      '/settings',
  [AppMode.PRICING]:       '/pricing',
  [AppMode.GAMIFICATION]:  '/gamification',
  [AppMode.SUCCESS]:       '/success',
  [AppMode.VIEWER]:        '/viewer',
  [AppMode.LEGAL]:         '/legal',
  [AppMode.ACCOUNT]:       '/account',
};

const PATH_TO_MODE = new Map<string, AppMode>(
  (Object.entries(MODE_TO_PATH) as [AppMode, string][]).map(([mode, path]) => [path, mode])
);

function modeFromPathname(pathname: string): AppMode {
  const p = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
  return PATH_TO_MODE.get(p) ?? AppMode.DASHBOARD;
}

const MainAppContent: React.FC = () => {
  // Initialize Google One Tap
  useGoogleOneTap();

  // Translation
  const { t } = useTranslation('common');

  // Initialize Vercel Speed Insights
  useEffect(() => {
    injectSpeedInsights();
  }, []);

  // Auth state
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Derive current mode directly from the URL — URL is single source of truth.
  // No useState needed; no circular effects.
  const currentMode: AppMode = location.pathname.startsWith('/shared/')
    ? AppMode.DASHBOARD
    : modeFromPathname(location.pathname);

  // Single navigation function used everywhere instead of setCurrentMode.
  // Calling this updates the URL, which re-derives currentMode automatically.
  const navigateTo = (mode: AppMode) => {
    const path = MODE_TO_PATH[mode] ?? '/';
    navigate(path);
  };
  const [currentProject, setCurrentProject] = useState<BookProject | null>(null);
  const [viewingBook, setViewingBook] = useState<BookProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [forceRenderKey, setForceRenderKey] = useState(0);
  const generationCancelRef = useRef<(() => void) | null>(null);
  const cancelledByUserRef = useRef(false);

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

  // No hash sync effects needed — URL drives everything via useLocation().

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

  // Clean default — no hardcoded badges/challenges; GamificationHub fetches live data from DB
  const gamificationState: GamificationState = userProfile?.gamification_data || {
    level: 1,
    levelTitle: t('aspiringAuthor', 'Aspiring Author'),
    currentXP: 0,
    nextLevelXP: 100,
    booksCreatedCount: 0,
    currentStreak: 0,
    lastActivityDate: undefined,
    badges: [],
    dailyChallenges: [],
  };

  const checkTierLimits = async (settings: GenerationSettings): Promise<boolean> => {
    const tierName = userTierToTierName(currentUserTier);
    const ent = getEntitlements(tierName);

    // Check page limit
    if (!isUnlimited(ent.pages_per_book) && settings.pageCount > ent.pages_per_book) {
      setShowUpgradeModal(true);
      addToast(t('errors:pageLimitExceeded', { count: ent.pages_per_book, defaultValue: `Your plan allows up to ${ent.pages_per_book} pages per book. Upgrade for more!` }), 'error');
      return false;
    }

    // Check monthly book limit
    if (!isUnlimited(ent.books_per_month) && user) {
      try {
        const usage = await getCurrentMonthUsage(user.id);
        if (usage >= ent.books_per_month) {
          setShowUpgradeModal(true);
          addToast(t('errors:monthlyLimitExceeded', { count: ent.books_per_month, defaultValue: `You've used all ${ent.books_per_month} books this month. Upgrade for more!` }), 'error');
          return false;
        }
      } catch {
        // If usage check fails, allow creation (server-side will enforce)
      }
    }

    return true;
  };

  const resetGenerationState = useCallback(() => {
    generationCancelRef.current = null;
    setActiveWorkflowId(null);
    setIsGenerating(false);
    setGenerationStatus('');
    setGenerationProgress(0);
  }, []);

  const handleCancelGeneration = useCallback(async () => {
    cancelledByUserRef.current = true;

    const workflowId = activeWorkflowId;
    generationCancelRef.current?.();
    resetGenerationState();

    if (!workflowId) {
      cancelledByUserRef.current = false;
      return;
    }

    try {
      await mastra.workflows.cancelBookGeneration(workflowId);
    } catch (error) {
      console.warn('[MainApp] Failed to cancel workflow on server:', error);
    } finally {
      cancelledByUserRef.current = false;
    }
  }, [activeWorkflowId, resetGenerationState]);

  useEffect(() => {
    return () => {
      generationCancelRef.current?.();
    };
  }, []);

  const handleGenerateProject = async (settings: GenerationSettings) => {
    if (!(await checkTierLimits(settings))) return;

    cancelledByUserRef.current = false;
    generationCancelRef.current?.();
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus(t('creation:startingGeneration', 'Starting book generation...'));
    setActiveWorkflowId(null);

    try {
      const cancel = await mastra.workflows.startBookGeneration(
        settings,
        (event) => {
          if (cancelledByUserRef.current) {
            return;
          }

          const workflowId =
            event.data &&
            typeof event.data === 'object' &&
            'workflowId' in event.data &&
            typeof (event.data as { workflowId?: unknown }).workflowId === 'string'
              ? (event.data as { workflowId: string }).workflowId
              : null;

          if (workflowId) {
            setActiveWorkflowId((current) => current ?? workflowId);
          }

          setGenerationProgress(Math.max(0, Math.min(100, event.percent)));
          setGenerationStatus(event.message || t('creation:generatingBook', 'Generating your book...'));
        },
        (result) => {
          if (cancelledByUserRef.current) {
            cancelledByUserRef.current = false;
            resetGenerationState();
            return;
          }

          if (!result.success || !result.project) {
            if (result.error === 'TIER_LIMIT_EXCEEDED' || result.error === 'PAGE_LIMIT_EXCEEDED') {
              setShowUpgradeModal(true);
            }

            addToast(result.message || result.error || t('errors:generationFailed', 'Book generation failed.'), 'error');
            resetGenerationState();
            return;
          }

          invalidateBooksCache();

          if (result.saved === false) {
            addToast(
              t('errors:saveFailed', 'Book generated, but automatic library save failed. You can still edit it now.'),
              'warning'
            );
          }

          setCurrentProject(result.project);
          navigateTo(AppMode.SUCCESS);
          resetGenerationState();
        },
        (error) => {
          if (cancelledByUserRef.current) {
            cancelledByUserRef.current = false;
            resetGenerationState();
            return;
          }

          console.error('Generation failed', error);

          if (error.message.includes('TIER_LIMIT_EXCEEDED') || error.message.includes('PAGE_LIMIT_EXCEEDED')) {
            setShowUpgradeModal(true);
          }

          addToast(t('errors:generationError', { message: error.message || 'Unknown error', defaultValue: `Failed to generate project: ${error.message || 'Unknown error'}` }), 'error');
          resetGenerationState();
        }
      );

      generationCancelRef.current = cancel;
    } catch (error) {
      console.error('Generation failed', error);
      addToast(
        t('errors:generationError', { message: error instanceof Error ? error.message : 'Unknown error', defaultValue: `Failed to generate project: ${error instanceof Error ? error.message : 'Unknown error'}` }),
        'error'
      );
      resetGenerationState();
    }
  };

  const handleEditBook = (book: SavedBook) => {
    setCurrentProject(book.project);
    navigateTo(AppMode.EDITOR);
  };

  const handleReadBook = (book: SavedBook) => {
    setViewingBook(book.project);
    navigateTo(AppMode.VIEWER);
  };

  const handleUpgrade = async (newTier: UserTier) => {
    const { updateUserTier } = await import('./services/profileService');
    await updateUserTier(newTier);
    const profile = await getUserProfile();
    setUserProfile(profile);
    setShowUpgradeModal(false);
    addToast(t('pricing:tierWelcome', { tier: newTier, defaultValue: `Welcome to the ${newTier} tier!` }), 'success');
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
            onNavigate={navigateTo}
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
            onBack={() => navigateTo(AppMode.DASHBOARD)}
            onNavigateToCreate={() => navigateTo(AppMode.CREATION)}
          />
        );
      case AppMode.VISUAL_STUDIO:
        return (
          <VisualStudio
            project={currentProject}
            onBack={() => navigateTo(AppMode.DASHBOARD)}
            userProfile={userProfile}
            onNavigate={navigateTo}
            onUpdateProject={setCurrentProject}
          />
        );
      case AppMode.SETTINGS:
        return (
          <SettingsPanel
            onNavigate={navigateTo}
            userTier={currentUserTier}
            onViewBook={handleReadBook}
          />
        );
      case AppMode.LEGAL:
        return <LegalViewer onNavigate={navigateTo} />;
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
              navigateTo(AppMode.DASHBOARD);
            }}
            onEdit={() => {
              setCurrentProject(viewingBook);
              setViewingBook(null);
              navigateTo(AppMode.EDITOR);
            }}
            onDownload={() => navigateTo(AppMode.PRICING)}
            onShare={() => console.log('Share triggered')}
          />
        );
      case AppMode.PRICING:
        return <PricingPage onUpgrade={handleUpgrade} />;
      case AppMode.GAMIFICATION:
        return <GamificationHub gameState={gamificationState} setMode={navigateTo} />;
      case AppMode.ACCOUNT:
        return <AccountPage onNavigate={navigateTo} />;
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

  const isSharedRoute = location.pathname.startsWith('/shared/');
  const isProcessingAuth =
    window.location.hash.includes('access_token') ||
    window.location.hash.includes('error_description');

  // Loading state during OAuth
  if (authLoading || isProcessingAuth) return <AppSkeleton />;

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
      <Navigation currentMode={currentMode} setMode={navigateTo} gameState={gamificationState} />
      <main className="pt-20 relative transition-all duration-300 overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <h1 className="sr-only">{t('common:appName', 'Genesis')}</h1>
        {/* key is on the inner div, NOT on Suspense — this way theme/language
            re-renders remount the content without re-triggering the skeleton
            (Suspense only suspends when a lazy import is actually pending). */}
        <Suspense fallback={<AppSkeleton />}>
          <div key={forceRenderKey}>{renderContent()}</div>
        </Suspense>
      </main>

      {isGenerating && (
        // GenerationTheater is only triggered by user action (generate button),
        // so the chunk is already downloaded long before it's needed.
        // Use null fallback — the overlay won't flash and the theater shows immediately.
        <Suspense fallback={null}>
          <GenerationTheater
            progress={generationProgress}
            status={generationStatus}
            onCancel={handleCancelGeneration}
          />
        </Suspense>
      )}

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={() => {
          setShowUpgradeModal(false);
          navigateTo(AppMode.PRICING);
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

const DirectionBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { direction, currentLanguage } = useLanguageContext();

  return (
    <DirectionProvider direction={direction} language={currentLanguage.code}>
      {children}
    </DirectionProvider>
  );
};

// Wrap with providers
const MainApp: React.FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <FontProvider>
        <LanguageProvider>
          <DirectionBridge>
            <MainAppContent />
          </DirectionBridge>
        </LanguageProvider>
      </FontProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default MainApp;
