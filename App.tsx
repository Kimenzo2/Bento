
import React, { useState } from 'react';
import Navigation from './components/Navigation';
import CreationCanvas from './components/CreationCanvas';
import SmartEditor from './components/SmartEditor';
import VisualStudio from './components/VisualStudio';
import SettingsPanel from './components/SettingsPanel';
import PricingPage from './components/PricingPage';
import GamificationHub from './components/GamificationHub';
import { AppMode, BookProject, GenerationSettings, GamificationState } from './types';
import { generateBookStructure } from './services/geminiService';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.DASHBOARD);
  const [currentProject, setCurrentProject] = useState<BookProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
    try {
      const structure = await generateBookStructure(settings);

      if (!structure.chapters || structure.chapters.length === 0 || !structure.chapters[0].pages || structure.chapters[0].pages.length === 0) {
        throw new Error("Generated content is empty. Please try again with a different prompt.");
      }

      const newProject: BookProject = {
        id: crypto.randomUUID(),
        title: structure.title || "Untitled Masterpiece",
        synopsis: structure.synopsis || "",
        style: settings.style,
        tone: settings.tone,
        targetAudience: settings.audience,
        isBranching: settings.isBranching,
        brandProfile: settings.brandProfile,
        chapters: (structure.chapters || []).map(c => ({
          id: crypto.randomUUID(),
          title: c.title || "Chapter",
          pages: (c.pages || []).map((p: any) => ({
            id: crypto.randomUUID(),
            pageNumber: p.pageNumber,
            text: p.text,
            imagePrompt: p.imagePrompt,
            layoutType: p.layoutType || 'text-only',
            choices: p.choices || []
          }))
        })),
        characters: (structure.characters || []).map((c: any) => ({
          id: crypto.randomUUID(),
          name: c.name,
          description: c.description,
          visualTraits: c.visualTraits
        })),
        createdAt: new Date()
      };

      setCurrentProject(newProject);
      setCurrentMode(AppMode.EDITOR);
    } catch (error) {
      console.error("Generation failed", error);
      alert("Failed to generate project. Please check your API key or try again.");
    } finally {
      setIsGenerating(false);
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
          />
        );
      case AppMode.EDITOR:
        if (!currentProject) return <CreationCanvas onGenerate={handleGenerateProject} isGenerating={isGenerating} />;
        return (
          <SmartEditor
            project={currentProject}
            onUpdateProject={setCurrentProject}
          />
        );
      case AppMode.VISUAL_STUDIO:
        return (
          <VisualStudio project={currentProject} />
        );
      case AppMode.SETTINGS:
        return (
          <SettingsPanel />
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
        return <CreationCanvas onGenerate={handleGenerateProject} isGenerating={isGenerating} />;
    }
  };

  return (
    <div className="min-h-screen bg-cream-base text-charcoal-soft font-body selection:bg-coral-burst/30 selection:text-charcoal-soft">
      <Navigation currentMode={currentMode} setMode={setCurrentMode} />
      <main className="pt-[80px] relative transition-all duration-300">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
