import React, { useState } from 'react';
import Navigation from './components/Navigation';
import CreationCanvas from './components/CreationCanvas';
import SmartEditor from './components/SmartEditor';
import VisualStudio from './components/VisualStudio';
import SettingsPanel from './components/SettingsPanel';
import PricingPage from './components/PricingPage';
import GamificationHub from './components/GamificationHub';
import BookSuccessView from './components/BookSuccessView';
import GenerationTheater from './components/GenerationTheater';
import { AppMode, BookProject, GenerationSettings, GamificationState, UserTier } from './types';
import { generateBookStructure, generateIllustration } from './services/geminiService';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.DASHBOARD);
  const [currentProject, setCurrentProject] = useState<BookProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>("");
  const [generationProgress, setGenerationProgress] = useState<number>(0);

  // Mock User Tier State - In a real app, this would come from auth/subscription context
  const [currentUserTier, setCurrentUserTier] = useState<UserTier>(UserTier.SPARK);

  // Mock Gamification State
  const [gamificationState] = useState<GamificationState>({
    level: 3,
    levelTitle: "Rising Author",
    currentXP: 1250,
    nextLevelXP: 2000,
    booksCreatedCount: 7,
    badges: [
      { id: '1', name: "First Spark", description: "Created your first book", icon: "rocket", unlocked: true },
      { id: '2', name: "Style Explorer", description: "Tried 3 different styles", icon: "palette", unlocked: true },
      { id: '3', name: "Wordsmith", description: "Wrote 5,000 words", icon: "feather", unlocked: true },
      { id: '4', name: "Bestseller", description: "Get 1,000 views", icon: "diamond", unlocked: false }
    ],
    dailyChallenges: [
      { id: 'c1', title: "Create a Children's Book", xpReward: 50, completed: false },
      { id: 'c2', title: "Try the 'Cyberpunk' Style", xpReward: 75, completed: true },
      { id: 'c3', title: "Share a book", xpReward: 100, completed: false }
    ]
  });

  const handleGenerateProject = async (settings: GenerationSettings) => {
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

      // 2. Generate Illustrations for ALL pages
      const totalPages = newProject.chapters.flatMap(c => c.pages).length;
      let processedPages = 0;

      for (const chapter of newProject.chapters) {
        for (const page of chapter.pages) {
          processedPages++;
          const pageProgress = 20 + ((processedPages / totalPages) * 60); // 20-80%
          setGenerationProgress(pageProgress);
          setGenerationStatus(`Painting page ${processedPages} of ${totalPages}...`);

          if (page.imagePrompt) {
            let attempts = 0;
            let success = false;
            while (attempts < 3 && !success) {
              try {
                // Add a small delay to prevent rate limiting
                if (processedPages > 1) await new Promise(r => setTimeout(r, 1000));

                const imageUrl = await generateIllustration(page.imagePrompt, settings.style);
                if (imageUrl) {
                  page.imageUrl = imageUrl;
                  success = true;
                }
              } catch (err) {
                attempts++;
                console.warn(`Failed to generate image for page ${page.pageNumber} (Attempt ${attempts}/3)`, err);
                if (attempts < 3) await new Promise(r => setTimeout(r, 2000)); // Wait longer before retry
              }
            }
          }
        }
      }

      // 3. Generate Cover Image
      setGenerationProgress(85);
      setGenerationStatus("Designing the perfect cover...");
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

  const renderContent = () => {
    switch (currentMode) {
      case AppMode.CREATION:
      case AppMode.DASHBOARD:
        return (
          <CreationCanvas
            onGenerate={handleGenerateProject}
            isGenerating={isGenerating}
            generationStatus={generationStatus}
          />
        );
      case AppMode.SUCCESS:
        if (!currentProject) return <CreationCanvas onGenerate={handleGenerateProject} isGenerating={isGenerating} generationStatus={generationStatus} />;
        return (
          <BookSuccessView
            project={currentProject}
            onNavigate={setCurrentMode}
          />
        );
      case AppMode.EDITOR:
        if (!currentProject) return <CreationCanvas onGenerate={handleGenerateProject} isGenerating={isGenerating} generationStatus={generationStatus} />;
        return (
          <SmartEditor
            project={currentProject}
            onUpdateProject={setCurrentProject}
            userTier={currentUserTier}
          />
        );
      case AppMode.VISUAL_STUDIO:
        return (
          <VisualStudio project={currentProject} />
        );
      case AppMode.SETTINGS:
        return (
          <SettingsPanel onNavigate={setCurrentMode} />
        );
      case AppMode.PRICING:
        return (
          <PricingPage />
        );
      case AppMode.GAMIFICATION:
        return (
          <GamificationHub gameState={gamificationState} setMode={setCurrentMode} />
        );
      case AppMode.EXPORT:
        return (
          <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8 animate-fadeIn">
            <div className="w-24 h-24 bg-peach-soft rounded-full flex items-center justify-center mb-6 shadow-glow">
              <span className="text-4xl">📤</span>
            </div>
            <h2 className="text-3xl font-heading font-bold text-charcoal-soft mb-2">Export Nexus</h2>
            <p className="text-cocoa-light max-w-md font-body">
              Your masterpiece is almost ready for the world. Upgrade to Creator tier to remove watermarks and unlock ePub export.
            </p>
            <button
              onClick={() => setCurrentMode(AppMode.PRICING)}
              className="mt-6 px-8 py-3 bg-coral-burst text-white rounded-full font-bold shadow-soft-md hover:scale-105 transition-transform"
            >
              Unlock Premium Exports
            </button>
          </div>
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
    </div>
  );
};

export default App;
