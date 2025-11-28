import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import Navigation from './components/Navigation';
import CreationCanvas from './components/CreationCanvas';
import SmartEditor from './components/SmartEditor';
import VisualStudio from './components/VisualStudio';
import SettingsPanel from './components/SettingsPanel';
import PricingPage from './components/PricingPage';
import GamificationHub from './components/GamificationHub';
import BookSuccessView from './components/BookSuccessView';
import GenerationTheater from './components/GenerationTheater';
import { AppMode, BookProject, GenerationSettings, GamificationState, UserTier, SavedBook } from './types';
import { generateBookStructure, generateIllustration } from './services/geminiService';
import UpgradeModal from './components/UpgradeModal';
import { ToastContainer, ToastType } from './components/Toast';
import StorybookViewer from './components/StorybookViewer';
import { getAllBooks, saveBook } from './services/storageService';
import { canCreateEbook, getEbooksCreatedThisMonth, incrementEbookCount, getMaxPages } from './services/tierLimits';
import { getUserProfile, incrementBooksCreated, addXP, UserProfile } from './services/profileService';
import { supabase } from './services/supabaseClient';
import { useGoogleOneTap } from './hooks/useGoogleOneTap';

const App: React.FC = () => {
  // Initialize Google One Tap for seamless authentication
  useGoogleOneTap();

  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.DASHBOARD);
  const [currentProject, setCurrentProject] = useState<BookProject | null>(null);
  const [viewingBook, setViewingBook] = useState<BookProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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

  // Fetch user profile on mount
  React.useEffect(() => {
    const fetchProfile = async () => {
      setIsLoadingProfile(true);
      const profile = await getUserProfile();
      setUserProfile(profile);
      setIsLoadingProfile(false);
    };

    fetchProfile();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const profile = await getUserProfile();
        setUserProfile(profile);
      } else if (event === 'SIGNED_OUT') {
        setUserProfile(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Derive current tier and gamification state from profile
  const currentUserTier = userProfile?.user_tier || UserTier.SPARK;
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
    setGenerationStatus("Architecting story structure...");

    try {
      setGenerationProgress(5);
      const structure = await generateBookStructure(settings);

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
        if (!currentProject) return <CreationCanvas onGenerate={handleGenerateProject} isGenerating={isGenerating} generationStatus={generationStatus} />;
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
          />
        );
      case AppMode.VISUAL_STUDIO:
        return (
          <VisualStudio
            project={currentProject}
            onBack={() => setCurrentMode(AppMode.DASHBOARD)}
          />
        );
      case AppMode.SETTINGS:
        return (
          <SettingsPanel
            onNavigate={setCurrentMode}
            userTier={currentUserTier}
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
            onShare={() => alert('Share feature coming soon! 🎉')}
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



  return (
    <div className="min-h-screen bg-cream-base text-charcoal-soft font-body selection:bg-coral-burst/30 selection:text-charcoal-soft">
      <Navigation currentMode={currentMode} setMode={setCurrentMode} />
      <main className="pt-[80px] relative transition-all duration-300">
        {renderContent()}
      </main>

      {/* Magical Loading Theater */}
      {isGenerating && (
        <GenerationTheater
          progress={generationProgress}
          status={generationStatus}
        />
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
    </div>
  );
};

export default App;
