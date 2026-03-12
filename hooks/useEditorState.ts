/**
 * useEditorState.ts — Centralized editor state for the Genesis Page Editor.
 *
 * All editor state lives here. Components read and dispatch through this hook.
 * The hook wraps useUndoRedo and useAutoSave and exposes a clean API.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAutoSave } from './useAutoSave';
import { useUndoRedo } from './useUndoRedo';
import { generateIllustration } from '../services/geminiService';
import { persistImage } from '../services/imageStorage';
import {
  checkCharacterConsistency,
  getWritingSuggestions,
  improveText,
} from '../services/grokService';
import { mastra } from '../src/services/mastraClient';
import { saveBook } from '../services/storageService';
import { type ConsistencyIssue, storyBibleService } from '../services/storyBibleService';
import {
  type BookProject,
  type Character,
  type Page,
  type StoryBible,
  UserTier,
} from '../types';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface WritingSuggestion {
  type: string;
  original: string;
  suggestion: string;
  reason: string;
}

export interface ConsistencyCharacter {
  name: string;
  inconsistencies: string[];
  suggestions: string[];
}

export interface ConsistencyReport {
  overallScore: number;
  characters: ConsistencyCharacter[];
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved' | 'error';

export interface EditorStateOptions {
  project: BookProject;
  onUpdateProject: (project: BookProject) => void;
  userTier?: UserTier;
  onShowUpgrade?: () => void;
  onSave?: (success: boolean, message: string) => void;
}

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────

export function useEditorState({
  project,
  onUpdateProject,
  userTier = UserTier.SPARK,
  onShowUpgrade,
  onSave,
}: EditorStateOptions) {
  const { userProfile } = useAuth();

  // ── Core navigation ──
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [editorView, setEditorView] = useState<'pages' | 'canvas'>('canvas');
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [isFocusMode, setIsFocusMode] = useState(false);

  // ── Generation state ──
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Quality panels ──
  const [storyBible, setStoryBible] = useState<StoryBible | null>(
    project.storyBible || null
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAudienceSafety, setShowAudienceSafety] = useState(false);
  const [consistencyIssues, setConsistencyIssues] = useState<ConsistencyIssue[]>([]);

  // ── Green Room & Remix ──
  const [showGreenRoom, setShowGreenRoom] = useState(false);
  const [selectedCharacterForInterview, setSelectedCharacterForInterview] = useState<Character | null>(null);
  const [showRemixStudio, setShowRemixStudio] = useState(false);

  // ── Feature panels ──
  const [isImproving, setIsImproving] = useState(false);
  const [showImproveOptions, setShowImproveOptions] = useState(false);
  const [showConsistencyPanel, setShowConsistencyPanel] = useState(false);
  const [isCheckingConsistency, setIsCheckingConsistency] = useState(false);
  const [consistencyReport, setConsistencyReport] = useState<ConsistencyReport | null>(null);
  const [suggestions, setSuggestions] = useState<WritingSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Undo / Redo ──
  const {
    state: currentProject,
    set: setProjectHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoRedo<BookProject>(project);

  // ── AutoSave ──
  const { state: autoSaveState, save: triggerAutoSave } = useAutoSave({
    key: `book-${currentProject.id}`,
    data: currentProject,
    onSave: async (data) => {
      await saveBook(data);
      if (onSave) onSave(true, 'Auto-saved');
    },
    interval: 30000,
  });

  // ── Sync parent ──
  useEffect(() => {
    if (currentProject !== project) {
      onUpdateProject(currentProject);
    }
  }, [currentProject, onUpdateProject, project]);

  // ── Derived ──
  const allPages = currentProject.chapters.flatMap((c) => c.pages);
  const activePage = allPages[activePageIndex] || allPages[0];
  const totalPages = allPages.length;

  // ── Save status ──
  const saveStatus: SaveStatus = autoSaveState.error
    ? 'error'
    : autoSaveState.isSaving || isSaving
    ? 'saving'
    : autoSaveState.hasUnsavedChanges
    ? 'unsaved'
    : autoSaveState.lastSaved
    ? 'saved'
    : 'idle';

  // ── Text change detection ──
  const detectSignificantChange = useCallback((oldText: string, newText: string): boolean => {
    if (Math.abs(oldText.length - newText.length) > oldText.length * 0.3) return true;
    const visualWords = (text: string) => {
      const words =
        text.toLowerCase().match(
          /\b(red|blue|green|yellow|black|white|pink|purple|orange|big|small|tall|short|young|old|happy|sad|angry|forest|ocean|mountain|castle|house|dog|cat|bird|dragon|princess|knight|wizard|sun|moon|stars|rain|snow|night|day)\b/g
        ) || [];
      return new Set(words);
    };
    const oldWords = visualWords(oldText);
    const newWords = visualWords(newText);
    const addedWords = [...newWords].filter((w) => !oldWords.has(w));
    const removedWords = [...oldWords].filter((w) => !newWords.has(w));
    return addedWords.length > 0 || removedWords.length > 0;
  }, []);

  const lastSavedTextRef = useRef<string>(activePage?.text || '');

  // ── Actions ──

  const handleTextChange = useCallback((text: string) => {
    const wasSignificantChange = detectSignificantChange(lastSavedTextRef.current, text);
    setProjectHistory((prevProject) => {
      const newProject = structuredClone(prevProject);
      newProject.chapters.forEach((ch) => {
        const page = ch.pages.find((p) => p.pageNumber === activePage.pageNumber);
        if (page) {
          page.text = text;
          if (wasSignificantChange && page.imageUrl) {
            page.isImageOutdated = true;
          }
        }
      });
      return newProject;
    });

    // Trigger suggestions with debounce
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }
    suggestionTimeoutRef.current = setTimeout(() => {
      fetchWritingSuggestions(text);
    }, 2000);
  }, [activePage?.pageNumber, detectSignificantChange, setProjectHistory]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveBook(currentProject);
      if (onSave) onSave(true, 'Book saved successfully!');
    } catch (error) {
      console.error('Save failed:', error);
      if (onSave) onSave(false, 'Failed to save book. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [currentProject, onSave]);

  const handleGenerateImage = useCallback(async () => {
    if (!activePage) return;
    // Check limits
    if (userTier === UserTier.SPARK) {
      const currentCount = currentProject.aiImagesGenerated || 0;
      if (currentCount >= 5) {
        if (onShowUpgrade) onShowUpgrade();
        return;
      }
    }

    setIsGeneratingImage(true);
    try {
      const rawImage = await generateIllustration(activePage.imagePrompt, currentProject.style);
      if (rawImage) {
        const userId = userProfile?.id || 'anonymous';
        const permanentUrl = await persistImage(rawImage, userId, currentProject.id, activePage.pageNumber);
        const newProject = structuredClone(currentProject);
        newProject.aiImagesGenerated = (newProject.aiImagesGenerated || 0) + 1;
        newProject.chapters.forEach((ch) => {
          const page = ch.pages.find((p) => p.pageNumber === activePage.pageNumber);
          if (page) {
            page.imageUrl = permanentUrl;
            page.isImageOutdated = false;
          }
        });
        setProjectHistory(() => newProject);
      }
    } catch (_e) {
      console.error('Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  }, [activePage, currentProject, userTier, userProfile?.id, onShowUpgrade, setProjectHistory]);

  const handleImproveText = useCallback(async (tone: string) => {
    if (!activePage) return;
    setIsImproving(true);
    setShowImproveOptions(false);
    try {
      let improved: string;
      try {
        improved = await mastra.agents.storyEditor.improveText(
          activePage.text, tone,
          currentProject.targetAudience || 'children',
          currentProject.id
        );
      } catch {
        improved = await improveText(activePage.text, tone, currentProject.targetAudience || 'children');
      }
      handleTextChange(improved);
    } catch {
      // Error handled by caller
    } finally {
      setIsImproving(false);
    }
  }, [activePage, currentProject, handleTextChange]);

  const handleCheckConsistency = useCallback(async () => {
    setIsCheckingConsistency(true);
    try {
      if (storyBible) {
        const issues = await storyBibleService.checkConsistency(
          activePage.text, storyBible, activePage.pageNumber
        );
        setConsistencyIssues(issues);
        if (issues.length === 0) {
          // No issues found
        } else {
          setShowConsistencyPanel(true);
        }
      } else {
        let report: ConsistencyReport;
        try {
          report = await mastra.agents.storyEditor.checkConsistency(currentProject);
        } catch {
          report = await checkCharacterConsistency(currentProject);
        }
        setConsistencyReport(report);
        setShowConsistencyPanel(true);
      }
    } catch {
      // Error handled by caller
    } finally {
      setIsCheckingConsistency(false);
    }
  }, [activePage, currentProject, storyBible]);

  const fetchWritingSuggestions = useCallback(async (text: string) => {
    if (text.length < 10) {
      setSuggestions([]);
      return;
    }
    setIsLoadingSuggestions(true);
    try {
      let newSuggestions: WritingSuggestion[];
      const ctx = `Children's book for ${currentProject.targetAudience}`;
      try {
        newSuggestions = await mastra.agents.storyEditor.getSuggestions(text, ctx);
      } catch {
        newSuggestions = await getWritingSuggestions(text, ctx);
      }
      setSuggestions(newSuggestions);
    } catch {
      // Silent
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [currentProject.targetAudience]);

  const applySuggestion = useCallback((suggestion: WritingSuggestion) => {
    const newText = activePage.text.replace(suggestion.original, suggestion.suggestion);
    handleTextChange(newText);
    setSuggestions((prev) => prev.filter((s) => s !== suggestion));
  }, [activePage, handleTextChange]);

  const jumpToPageNumber = useCallback((num: number) => {
    const idx = allPages.findIndex((p) => p.pageNumber === num);
    if (idx !== -1) setActivePageIndex(idx);
  }, [allPages]);

  const handleAnalyzeAudienceSafety = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const safetyData = await storyBibleService.analyzeAudienceSafety(currentProject);
      const updatedBible = { ...storyBible!, audienceSafety: safetyData };
      setStoryBible(updatedBible);
      setProjectHistory((prev) => ({ ...prev, storyBible: updatedBible }));
    } catch {
      // Error handled
    } finally {
      setIsAnalyzing(false);
    }
  }, [currentProject, storyBible, setProjectHistory]);

  const addPage = useCallback(() => {
    setProjectHistory((prev) => {
      const newProject = structuredClone(prev);
      const newPageNumber = totalPages + 1;
      const newPage: Page = {
        id: `page-${Date.now()}`,
        pageNumber: newPageNumber,
        text: '',
        imagePrompt: '',
        layoutType: 'split-horizontal',
      };
      // Add to last chapter
      const lastChapter = newProject.chapters[newProject.chapters.length - 1];
      if (lastChapter) {
        lastChapter.pages.push(newPage);
      }
      return newProject;
    });
    // Navigate to the new page
    setTimeout(() => setActivePageIndex(totalPages), 0);
  }, [totalPages, setProjectHistory]);

  const reorderPages = useCallback((oldIndex: number, newIndex: number) => {
    if (oldIndex === newIndex) return;
    setProjectHistory((prev) => {
      const newProject = structuredClone(prev);
      // Flatten, reorder, renumber
      const flat = newProject.chapters.flatMap((c) => c.pages);
      const [moved] = flat.splice(oldIndex, 1);
      flat.splice(newIndex, 0, moved);
      // Renumber
      flat.forEach((p, i) => { p.pageNumber = i + 1; });
      // Put back into first chapter (simple flat model)
      if (newProject.chapters[0]) {
        newProject.chapters[0].pages = flat;
        // Clear other chapters
        for (let i = 1; i < newProject.chapters.length; i++) {
          newProject.chapters[i].pages = [];
        }
      }
      return newProject;
    });
    setActivePageIndex(newIndex);
  }, [setProjectHistory]);

  const toggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => !prev);
  }, []);

  const handleTitleChange = useCallback((title: string) => {
    setProjectHistory((prev) => ({ ...prev, title }));
  }, [setProjectHistory]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, []);

  // ── Real-time consistency check ──
  useEffect(() => {
    if (!storyBible || !activePage?.text) return;
    const timer = setTimeout(async () => {
      const issues = await storyBibleService.checkConsistency(
        activePage.text, storyBible, activePage.pageNumber
      );
      setConsistencyIssues(issues);
    }, 2000);
    return () => clearTimeout(timer);
  }, [activePage?.text, storyBible, activePage?.pageNumber]);

  return {
    // Core state
    currentProject,
    setProjectHistory,
    activePage,
    activePageIndex,
    setActivePageIndex,
    allPages,
    totalPages,

    // Navigation
    editorView, setEditorView,
    mobileView, setMobileView,
    isFocusMode, toggleFocusMode, setIsFocusMode,
    jumpToPageNumber,

    // Save
    saveStatus,
    autoSaveState,
    isSaving,
    handleSave,
    triggerAutoSave,

    // Undo / Redo
    undo, redo, canUndo, canRedo,

    // Text editing
    handleTextChange,

    // Image generation
    isGeneratingImage,
    handleGenerateImage,

    // AI features
    isImproving, showImproveOptions, setShowImproveOptions,
    handleImproveText,
    isCheckingConsistency, showConsistencyPanel, setShowConsistencyPanel,
    consistencyReport, handleCheckConsistency,
    suggestions, isLoadingSuggestions,
    applySuggestion, fetchWritingSuggestions,
    consistencyIssues,

    // Quality panels
    storyBible, isAnalyzing,
    showAudienceSafety, setShowAudienceSafety,
    handleAnalyzeAudienceSafety,

    // Green Room & Remix
    showGreenRoom, setShowGreenRoom,
    selectedCharacterForInterview, setSelectedCharacterForInterview,
    showRemixStudio, setShowRemixStudio,

    // Page management
    addPage,
    reorderPages,

    // Title
    handleTitleChange,

    // User
    userProfile,
    userTier,
  };
}

export type EditorState = ReturnType<typeof useEditorState>;
