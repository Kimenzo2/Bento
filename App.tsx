import React, { useState, lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { injectSpeedInsights } from '@vercel/speed-insights';
import ErrorBoundary from './components/ErrorBoundary';
import Navigation from './components/Navigation';
import { AppMode, BookProject, GenerationSettings, GamificationState, UserTier, SavedBook } from './types';
import { generateBookStructure, generateIllustration, generateBrandContent } from './services/geminiService';
import UpgradeModal from './components/UpgradeModal';
import { ToastContainer, ToastType } from './components/Toast';
import EmailAuthModal from './components/EmailAuthModal';

import { getAllBooks, saveBook } from './services/storageService';
import { canCreateEbook, getEbooksCreatedThisMonth, incrementEbookCount, getMaxPages } from './services/tierLimits';
import { getUserProfile, incrementBooksCreated, addXP, UserProfile } from './services/profileService';
import { supabase } from './services/supabaseClient';
import { useGoogleOneTap } from './hooks/useGoogleOneTap';
import { useAuth } from './contexts/AuthContext';
import InstallPWA from './components/InstallPWA';
import { ThemeProvider } from './contexts/ThemeContext';
import { FontProvider } from './src/contexts/FontContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import './src/config/i18n'; // Initialize i18n

// New Global Components
import WhatsNewModal from './components/WhatsNewModal';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import { OfflineIndicator, useNetworkStatus } from './hooks/useNetworkStatus';

// PERFORMANCE: Lazy load heavy components to reduce initial bundle size
// This is critical for 1M+ users - reduces initial JS payload by ~60%
const CreationCanvas = lazy(() => import('./components/CreationCanvas'));
const SmartEditor = lazy(() => import('./components/SmartEditor'));
const VisualStudio = lazy(() => import('./components/VisualStudio'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const PricingPage = lazy(() => import('./components/PricingPage'));
const GamificationHub = lazy(() => import('./components/GamificationHub'));
const BookSuccessView = lazy(() => import('./components/BookSuccessView'));
const GenerationTheater = lazy(() => import('./components/GenerationTheater'));
const StorybookViewer = lazy(() => import('./components/StorybookViewer'));
const SharedBookViewer = lazy(() => import('./components/SharedBookViewer'));




const App: React.FC = () => {
  // Initialize Google One Tap for seamless authentication
  useGoogleOneTap();

  // Initialize Vercel Speed Insights for performance monitoring
  useEffect(() => {
    injectSpeedInsights();
  }, []);

  // Get auth state
  const { user, loading: authLoading } = useAuth();

  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.DASHBOARD);
  const [currentProject, setCurrentProject] = useState<BookProject | null>(null);
  const [viewingBook, setViewingBook] = useState<BookProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [forceRenderKey, setForceRenderKey] = useState(0); // Force re-render trigger

  // Email Auth Modal State - Show when user is not authenticated
  const [showEmailAuthModal, setShowEmailAuthModal] = useState(false);
  const [hasShownAuthModal, setHasShownAuthModal] = useState(false);

  // Global Modals State
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Network Status
  const networkStatus = useNetworkStatus();

  // User Profile State - Fetched from Supabase
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Toast Notifications
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType }>>([]);

  const addToast = (message: string, type: ToastType) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Listen for theme and language changes
  React.useEffect(() => {
    const handleThemeChange = () => {
      console.log('[App] Theme changed, forcing re-render');
      setForceRenderKey(prev => prev + 1);
    };

    const handleLanguageChange = () => {
      console.log('[App] Language changed, forcing re-render');
      setForceRenderKey(prev => prev + 1);
    };

    window.addEventListener('themeChanged', handleThemeChange);
    window.addEventListener('languageChanged', handleLanguageChange);

    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
      window.removeEventListener('languageChanged', handleLanguageChange);
    };
  }, []);

  // Show email auth modal when user is not authenticated (experiment)
  React.useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    // If user is not authenticated and we haven't shown the modal yet
    if (!user && !hasShownAuthModal) {
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        console.log('[App] No user detected, showing email auth modal');
        setShowEmailAuthModal(true);
        setHasShownAuthModal(true);
      }, 1000);

      return () => clearTimeout(timer);
    }

    // If user signs in, close the modal
    if (user && showEmailAuthModal) {
      console.log('[App] User authenticated, closing auth modal');
      setShowEmailAuthModal(false);
    }
  }, [user, authLoading, hasShownAuthModal, showEmailAuthModal]);

  // Fetch user profile on mount
  React.useEffect(() => {
    const fetchProfile = async () => {
      console.log('[App] Fetching user profile...');
      setIsLoadingProfile(true);
      const profile = await getUserProfile();
      console.log('[App] Profile fetched:', profile ? `${profile.email}` : 'No profile');
      setUserProfile(profile);
      setIsLoadingProfile(false);
    };

    fetchProfile();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      console.log('[App] Auth state changed:', event, session?.user?.email || 'No user');

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Small delay to allow profile trigger to complete for new users
        setTimeout(async () => {
          console.log('[App] Fetching profile after sign-in...');
          const profile = await getUserProfile();
          console.log('[App] Profile after sign-in:', profile ? `${profile.email}` : 'No profile (may be new user)');

          if (!profile && session?.user) {
            // Profile might not exist yet for new users, retry after a moment
            console.log('[App] Profile not found, retrying in 1s...');
            setTimeout(async () => {
              const retryProfile = await getUserProfile();
              console.log('[App] Retry profile result:', retryProfile ? `${retryProfile.email}` : 'Still no profile');
              setUserProfile(retryProfile);
            }, 1000);
          } else {
            setUserProfile(profile);
          }
        }, 500);
      } else if (event === 'SIGNED_OUT') {
        console.log('[App] User signed out, clearing profile');
        setUserProfile(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Derive current tier and gamification state from profile
  // Ensure the tier is a valid UserTier enum value
  const rawTier = userProfile?.user_tier;
  const currentUserTier = rawTier && Object.values(UserTier).includes(rawTier as UserTier)
    ? (rawTier as UserTier)
    : UserTier.SPARK;
  const gamificationState: GamificationState = userProfile?.gamification_data || {
    level: 1,
    levelTitle: "Novice Author",
    currentXP: 0,
    nextLevelXP: 100,
    booksCreatedCount: 0,
    badges: [
      { id: '1', name: "First Spark", description: "Create your first book", icon: "rocket", unlocked: false },
      { id: '2', name: "Style Explorer", description: "Try 3 different styles", icon: "palette", unlocked: false },
      { id: '3', name: "Wordsmith", description: "Write 5,000 words", icon: "feather", unlocked: false },
      { id: '4', name: "Bestseller", description: "Get 1,000 views", icon: "diamond", unlocked: false }
    ],
    dailyChallenges: [
      { id: 'c1', title: "Create a Children's Book", xpReward: 50, completed: false },
      { id: 'c2', title: "Try a new Art Style", xpReward: 75, completed: false },
      { id: 'c3', title: "Share a book", xpReward: 100, completed: false }
    ]
  };

  const handleGenerateProject = async (settings: GenerationSettings) => {
    if (!checkTierLimits(settings)) {
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    // Use different generation path for brand content
    const isBrandContent = settings.brandStoryConfig && settings.brandStoryConfig.companyInfo?.name;

    setGenerationStatus(isBrandContent
      ? "Creating professional brand content..."
      : "Architecting story structure...");

    try {
      setGenerationProgress(5);

      // Use brand content generator for professional brand stories/annual reports
      const structure = isBrandContent
        ? await generateBrandContent(settings, settings.brandStoryConfig!)
        : await generateBookStructure(settings);

      if (!structure.chapters || structure.chapters.length === 0 || !structure.chapters[0].pages || structure.chapters[0].pages.length === 0) {
        throw new Error("Generated content is empty. Please try again with a different prompt.");
      }

      // 1. Create the base project structure
      setGenerationProgress(15);
      let newProject: BookProject = {
        id: crypto.randomUUID(),
        title: structure.title || "Untitled Masterpiece",
        synopsis: structure.synopsis || "",
        style: settings.style,
        tone: settings.tone,
        targetAudience: settings.audience,
        isBranching: settings.isBranching,
        brandProfile: settings.brandProfile,

        // New Schema Data
        metadata: structure.metadata,
        decisionTree: structure.decisionTree,
        backMatter: structure.backMatter,
        seriesInfo: structure.seriesInfo,

        chapters: (structure.chapters || []).map(c => ({
          id: crypto.randomUUID(),
          title: c.title || "Chapter",
          pages: (c.pages || []).map((p: any) => ({
            id: crypto.randomUUID(),
            pageNumber: p.pageNumber,
            text: p.text,
            imagePrompt: p.imagePrompt,
            layoutType: p.layoutType || 'text-only',
            choices: p.choices || [],
            // Map new page fields
            narrationNotes: p.narrationNotes,
            interactiveElement: p.interactiveElement,
            learningMoment: p.learningMoment,
            vocabularyWords: p.vocabularyWords
          }))
        })),
        characters: (structure.characters || []).map((c: any) => ({
          id: crypto.randomUUID(),
          name: c.name,
          description: c.description,
          visualTraits: c.visualTraits,
          visualPrompt: c.visualPrompt,
          traits: c.traits
        })),
        createdAt: new Date()
      };

      // 2. Generate Illustrations for ALL pages (Parallelized)
      const allPages = newProject.chapters.flatMap(c => c.pages);
      const totalPages = allPages.length;
      let processedCount = 0;

      const generatePageImage = async (page: any) => {
        if (!page.imagePrompt) return;

        let attempts = 0;
        let success = false;
        while (attempts < 3 && !success) {
          try {
            const imageUrl = await generateIllustration(page.imagePrompt, settings.style);
            if (imageUrl) {
              page.imageUrl = imageUrl;
              success = true;
            }
          } catch (err) {
            attempts++;
            console.warn(`Failed to generate image for page ${page.pageNumber}`, err);
            if (attempts < 3) await new Promise(r => setTimeout(r, 2000));
          }
        }

        processedCount++;
        const pageProgress = 20 + ((processedCount / totalPages) * 60); // 20-80%
        setGenerationProgress(pageProgress);
        setGenerationStatus(`Painting page ${processedCount} of ${totalPages}...`);
      };

      // Process sequentially (one by one) as requested
      for (const page of allPages) {
        await generatePageImage(page);
      }

      try {
        const coverPrompt = `Book cover for a story titled "${newProject.title}". Style: ${newProject.style}. Synopsis: ${newProject.synopsis}. High quality, visually striking, title text integrated if possible.`;
        const coverUrl = await generateIllustration(coverPrompt, settings.style);
        if (coverUrl) {
          newProject.coverImage = coverUrl;
        }
      } catch (err) {
        console.warn("Failed to generate cover image", err);
      }

      setGenerationProgress(100);
      setGenerationStatus("Complete!");
      await new Promise(r => setTimeout(r, 1000)); // Show 100% briefly

      // Increment monthly ebook count
      incrementEbookCount();

      setCurrentProject(newProject);
      setCurrentMode(AppMode.SUCCESS); // Switch to Success View
    } catch (error) {
      console.error("Generation failed", error);
      alert(`Failed to generate project: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsGenerating(false);
      setGenerationStatus("");
      setGenerationProgress(0);
    }
  };

  // Handle editing a saved book
  const handleEditBook = (book: SavedBook) => {
    setCurrentProject(book.project);
    setCurrentMode(AppMode.EDITOR);
  };

  // Handle reading a saved book
  const handleReadBook = (book: SavedBook) => {
    setViewingBook(book.project);
    setCurrentMode(AppMode.VIEWER);
  };

  const checkTierLimits = (settings: GenerationSettings): boolean => {
    // Check monthly ebook limit
    const ebooksThisMonth = getEbooksCreatedThisMonth();
    if (!canCreateEbook(currentUserTier, ebooksThisMonth)) {
      setShowUpgradeModal(true);
      addToast(`You've reached your monthly limit. Upgrade to create more ebooks!`, 'error');
      return false;
    }

    // Check page count limit
    const maxPages = getMaxPages(currentUserTier);
    if (settings.pageCount > maxPages) {
      setShowUpgradeModal(true);
      addToast(`Your tier allows up to ${maxPages} pages per book. Upgrade for more!`, 'error');
      return false;
    }

    return true;
  };

  const handleUpgrade = async (newTier: UserTier) => {
    const { updateUserTier } = await import('./services/profileService');
    await updateUserTier(newTier);

    // Refresh profile to get updated tier
    const profile = await getUserProfile();
    setUserProfile(profile);

    setShowUpgradeModal(false);
    addToast(`Welcome to the ${newTier} tier! You now have access to expanded features.`, 'success');
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
          />
        );
      case AppMode.SUCCESS:
        if (!currentProject) return <CreationCanvas onGenerate={handleGenerateProject} isGenerating={isGenerating} generationStatus={generationStatus} />;
        return (
          <BookSuccessView
            project={currentProject}
            onNavigate={setCurrentMode}
            userTier={currentUserTier}
          />
        );
      case AppMode.EDITOR:
      case AppMode.EDITOR:
        return (
          <SmartEditor
            project={currentProject}
            onUpdateProject={setCurrentProject}
            userTier={currentUserTier}
            onShowUpgrade={() => setShowUpgradeModal(true)}
            onSave={(success, message) => {
              addToast(message, success ? 'success' : 'error');
            }}
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
      case AppMode.VIEWER:
        if (!viewingBook) return <CreationCanvas onGenerate={handleGenerateProject} isGenerating={isGenerating} generationStatus={generationStatus} onEditBook={handleEditBook} onReadBook={handleReadBook} />;
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
            onShare={() => {
              // Handled internally by StorybookViewer
              console.log('Share triggered');
            }}
          />
        );
      case AppMode.PRICING:
        return (
          <PricingPage onUpgrade={handleUpgrade} />
        );
      case AppMode.GAMIFICATION:
        return (
          <GamificationHub gameState={gamificationState} setMode={setCurrentMode} />
        );

      default:
        return <CreationCanvas onGenerate={handleGenerateProject} isGenerating={isGenerating} generationStatus={generationStatus} />;
    }
  };

  // Get current location to handle /shared routes
  const location = useLocation();
  const isSharedRoute = location.pathname.startsWith('/shared/');

  // Check if we're processing an OAuth callback (hash contains access_token or error)
  const isProcessingAuth = window.location.hash.includes('access_token') ||
    window.location.hash.includes('error_description');

  // Show loading screen while processing OAuth callback
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

  // If it's a shared book route, render the SharedBookViewer
  if (isSharedRoute) {
    return (
      <div className="min-h-screen bg-cream-base">
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-coral-burst border-t-transparent rounded-full" />
          </div>
        }>
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
      <main className="pt-[80px] relative transition-all duration-300">
        {/* PERFORMANCE: Suspense boundary for lazy-loaded components */}
        <Suspense fallback={null}>
          {renderContent()}
        </Suspense>
      </main>

      {/* Magical Loading Theater */}
      {isGenerating && (
        <Suspense fallback={null}>
          <GenerationTheater
            progress={generationProgress}
            status={generationStatus}
          />
        </Suspense>
      )}
      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={() => {
          setShowUpgradeModal(false);
          setCurrentMode(AppMode.PRICING);
        }}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <Analytics />

      {/* PWA Install Prompt */}
      <InstallPWA />

      {/* Global Modals */}
      <WhatsNewModal
        isOpen={showWhatsNew}
        onClose={() => setShowWhatsNew(false)}
      />
      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* Email Auth Modal - Experiment */}
      <EmailAuthModal
        isOpen={showEmailAuthModal}
        onClose={() => setShowEmailAuthModal(false)}
        onSuccess={() => {
          console.log('[App] Email auth successful!');
          addToast('Welcome to Genesis! 🎉', 'success');
        }}
      />

      {/* Network Status Indicator */}
      <div className="fixed bottom-4 left-4 z-50">
        <OfflineIndicator />
      </div>
    </div>
  );
};



// Wrap App with ErrorBoundary for production stability
const AppWithErrorBoundary: React.FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <FontProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </FontProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default AppWithErrorBoundary;
