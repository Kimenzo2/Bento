
import React, { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import CreationCanvas from './components/CreationCanvas';
import SmartEditor from './components/SmartEditor';
import VisualStudio from './components/VisualStudio';
import SettingsPanel from './components/SettingsPanel';
import PricingPage from './components/PricingPage';
import GamificationHub from './components/GamificationHub';
import BlueprintReview from './components/BlueprintReview';
import { AppMode, BookProject, GenerationSettings, GamificationState } from './types';
import { analyzeContent, generateStyleGuide, generateCharacterSheet } from './services/generator';
import { ContentStructure, CharacterSheet, StyleGuide } from './types/generator';
import { saveProject, getUserProjects, trackGeneration } from './lib/supabaseHelpers';
import { isAuthenticated as checkAuth } from './lib/supabase';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.DASHBOARD);
  const [currentProject, setCurrentProject] = useState<BookProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [blueprint, setBlueprint] = useState<ContentStructure | null>(null);
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings | null>(null);
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load user projects on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const authenticated = await checkAuth();
        setIsAuthenticated(authenticated);

        if (authenticated) {
          const projects = await getUserProjects();
          setUserProjects(projects);

          // Load last project from localStorage as fallback
          const lastProjectId = localStorage.getItem('genesis_last_project');
          if (lastProjectId && projects.length > 0) {
            const lastProject = projects.find(p => p.id === lastProjectId);
            if (lastProject) {
              // Load full project data would go here
              console.log('Last project found:', lastProject.title);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };

    loadUserData();
  }, []);

  // Auto-save project when it changes
  useEffect(() => {
    const autoSave = async () => {
      if (currentProject && isAuthenticated) {
        try {
          await saveProject(currentProject);
          localStorage.setItem('genesis_last_project', currentProject.id);
          console.log('Project auto-saved:', currentProject.title);
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    };

    // Debounce auto-save by 2 seconds
    const timeoutId = setTimeout(autoSave, 2000);
    return () => clearTimeout(timeoutId);
  }, [currentProject, isAuthenticated]);

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

  const handleInitialAnalysis = async (settings: GenerationSettings) => {
    setIsGenerating(true);
    setGenerationSettings(settings);
    try {
      // Step 1: Analyze Content & Create Blueprint
      const structure = await analyzeContent({
        topic: settings.prompt,
        targetAudience: settings.audience,
        pageCount: settings.pageCount,
        style: settings.style,
        tone: settings.tone,
        brandProfile: settings.brandProfile
      });

      setBlueprint(structure);
      setCurrentMode(AppMode.BLUEPRINT_REVIEW);
    } catch (error) {
      console.error("Analysis failed", error);
      alert("Failed to analyze request. Please check your API key.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmBlueprint = async (finalBlueprint: ContentStructure) => {
    if (!generationSettings) return;
    setIsGenerating(true);

    try {
      // Step 2: Generate Style Guide
      const styleGuide = await generateStyleGuide({
        topic: generationSettings.prompt,
        targetAudience: generationSettings.audience,
        pageCount: generationSettings.pageCount,
        style: generationSettings.style,
        tone: generationSettings.tone,
        brandProfile: generationSettings.brandProfile
      });

      // Step 3: Generate Character Sheets
      const characterSheets: CharacterSheet[] = [];
      for (const charProfile of finalBlueprint.characterNeeds) {
        const sheet = await generateCharacterSheet(charProfile, {
          topic: generationSettings.prompt,
          targetAudience: generationSettings.audience,
          pageCount: generationSettings.pageCount,
          style: generationSettings.style,
          tone: generationSettings.tone
        });
        characterSheets.push(sheet);
      }

      // Step 4: Create Project Object
      const newProject: BookProject = {
        id: crypto.randomUUID(),
        title: finalBlueprint.title,
        synopsis: finalBlueprint.synopsis,
        style: generationSettings.style,
        tone: generationSettings.tone,
        targetAudience: generationSettings.audience,
        isBranching: generationSettings.isBranching,
        brandProfile: generationSettings.brandProfile,
        chapters: [{
          id: crypto.randomUUID(),
          title: "Chapter 1", // Simplified for now, blueprint has chapters but we map to single list often
          pages: finalBlueprint.pages.map(p => ({
            id: crypto.randomUUID(),
            pageNumber: p.pageNumber,
            text: "", // Will be generated page-by-page
            imagePrompt: p.scene, // This is the base scene description
            layoutType: p.layoutTemplate,
            choices: []
          }))
        }],
        characters: characterSheets.map(sheet => ({
          id: sheet.id,
          name: sheet.baseProfile.name,
          description: sheet.baseProfile.description,
          visualTraits: JSON.stringify(sheet.visualIdentity),
          imageUrl: sheet.midjourneyRefUrl
        })),
        createdAt: new Date(),
        styleGuide,
        characterSheets
      };

      setCurrentProject(newProject);
      setCurrentMode(AppMode.EDITOR);

      // Track generation usage
      if (isAuthenticated) {
        await trackGeneration('blueprint', newProject.id);
        await trackGeneration('style_guide', newProject.id);
        characterSheets.forEach(() => trackGeneration('character', newProject.id));
      }

      // TODO: Trigger background generation for text and images using the new engines

    } catch (error) {
      console.error("Generation failed", error);
      alert("Failed to generate assets.");
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
            onGenerate={handleInitialAnalysis}
            isGenerating={isGenerating}
          />
        );
      case AppMode.BLUEPRINT_REVIEW:
        if (!blueprint) return <div>Error: No blueprint found</div>;
        return (
          <BlueprintReview
            blueprint={blueprint}
            onConfirm={handleConfirmBlueprint}
            onBack={() => setCurrentMode(AppMode.CREATION)}
            isGenerating={isGenerating}
          />
        );
      case AppMode.EDITOR:
        if (!currentProject) return <CreationCanvas onGenerate={handleInitialAnalysis} isGenerating={isGenerating} />;
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
        return <CreationCanvas onGenerate={handleInitialAnalysis} isGenerating={isGenerating} />;
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
