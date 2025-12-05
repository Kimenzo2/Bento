
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BookProject, Page, UserTier } from '../types';
import {
    ChevronLeft,
    ChevronRight,
    Save,
    RefreshCw,
    Wand,
    GitFork,
    Image as ImageIcon,
    Maximize2,
    ArrowLeft,
    Edit3,
    Eye,
    CheckCircle2,
    AlertCircle,
    Lightbulb,
    Sparkles,
    Undo,
    Redo,
    Cloud,
    CloudOff
} from 'lucide-react';
import { generateIllustration } from '../services/geminiService';
import { improveText, checkCharacterConsistency, getWritingSuggestions } from '../services/grokService';
import { saveBook } from '../services/storageService';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useAutoSave } from '../hooks/useAutoSave';

interface SmartEditorProps {
    project: BookProject;
    onUpdateProject: (project: BookProject) => void;
    userTier?: UserTier;
    onShowUpgrade?: () => void;
    onSave?: (success: boolean, message: string) => void;
    onBack?: () => void;
}

const SmartEditor: React.FC<SmartEditorProps> = ({ project, onUpdateProject, userTier = UserTier.SPARK, onShowUpgrade, onSave, onBack }) => {
    const [activePageIndex, setActivePageIndex] = useState(0);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
    const [isSaving, setIsSaving] = useState(false);

    // Undo/Redo
    const { state: currentProject, set: setProjectHistory, undo, redo, canUndo, canRedo } = useUndoRedo<BookProject>(project);

    // AutoSave
    const { state: autoSaveState, save: triggerSave } = useAutoSave({
        key: `book-${currentProject.id}`,
        data: currentProject,
        onSave: async (data) => {
            await saveBook(data);
            if (onSave) onSave(true, 'Auto-saved');
        },
        interval: 30000, // 30s
    });

    // Sync parent state when history changes
    useEffect(() => {
        if (currentProject !== project) {
            onUpdateProject(currentProject);
        }
    }, [currentProject, onUpdateProject]);

    // Feature #1: AI Improve
    const [isImproving, setIsImproving] = useState(false);
    const [showImproveOptions, setShowImproveOptions] = useState(false);

    // Feature #2: Character Consistency
    const [showConsistencyPanel, setShowConsistencyPanel] = useState(false);
    const [isCheckingConsistency, setIsCheckingConsistency] = useState(false);
    const [consistencyReport, setConsistencyReport] = useState<any>(null);

    // Feature #3: Writing Suggestions
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup suggestion timeout on unmount to prevent memory leak
    useEffect(() => {
        return () => {
            if (suggestionTimeoutRef.current) {
                clearTimeout(suggestionTimeoutRef.current);
            }
        };
    }, []);

    const allPages = currentProject.chapters.flatMap(c => c.pages);
    const activePage = allPages[activePageIndex];
    const totalPages = allPages.length;

    const handleTextChange = (text: string) => {
        setProjectHistory((prevProject) => {
            const newProject = JSON.parse(JSON.stringify(prevProject)) as BookProject;
            newProject.chapters.forEach(ch => {
                const page = ch.pages.find(p => p.pageNumber === activePage.pageNumber);
                if (page) page.text = text;
            });
            return newProject;
        });

        // Feature #3: Trigger suggestions with debounce
        if (suggestionTimeoutRef.current) {
            clearTimeout(suggestionTimeoutRef.current);
        }
        suggestionTimeoutRef.current = setTimeout(() => {
            fetchWritingSuggestions(text);
        }, 2000); // Wait 2s after user stops typing
    };

    // Feature #1: AI Improve Handler
    const handleImproveText = async (tone: string) => {
        setIsImproving(true);
        setShowImproveOptions(false);
        try {
            const improved = await improveText(
                activePage.text,
                tone,
                currentProject.targetAudience || 'children'
            );
            handleTextChange(improved);
        } catch (error) {
            alert('Failed to improve text. Please try again.');
        } finally {
            setIsImproving(false);
        }
    };

    // Feature #2: Character Consistency Handler
    const handleCheckConsistency = async () => {
        setIsCheckingConsistency(true);
        try {
            const report = await checkCharacterConsistency(currentProject);
            setConsistencyReport(report);
            setShowConsistencyPanel(true);
        } catch (error) {
            alert('Failed to check character consistency. Please try again.');
        } finally {
            setIsCheckingConsistency(false);
        }
    };

    // Feature #3: Fetch Writing Suggestions
    const fetchWritingSuggestions = async (text: string) => {
        if (text.length < 10) {
            setSuggestions([]);
            return;
        }
        setIsLoadingSuggestions(true);
        try {
            const newSuggestions = await getWritingSuggestions(
                text,
                `Children's book for ${currentProject.targetAudience}`
            );
            setSuggestions(newSuggestions);
        } catch (error) {
            console.error('Failed to get suggestions:', error);
        } finally {
            setIsLoadingSuggestions(false);
        }
    };

    // Apply a suggestion
    const applySuggestion = (suggestion: any) => {
        const newText = activePage.text.replace(suggestion.original, suggestion.suggestion);
        handleTextChange(newText);
        setSuggestions(suggestions.filter(s => s !== suggestion));
    };

    // Save Handler
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveBook(currentProject);
            if (onSave) {
                onSave(true, 'Book saved successfully! ✨');
            }
        } catch (error) {
            console.error('Save failed:', error);
            if (onSave) {
                onSave(false, 'Failed to save book. Please try again.');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerateImage = async () => {
        if (!activePage) return;

        // Check Limits
        if (userTier === UserTier.SPARK) {
            const currentCount = project.aiImagesGenerated || 0;
            if (currentCount >= 5) {
                if (onShowUpgrade) {
                    onShowUpgrade();
                } else {
                    alert("You've reached the limit of 5 AI illustrations per book on the Spark plan. Upgrade to Creator for unlimited magic!");
                }
                return;
            }
        }

        setIsGeneratingImage(true);
        try {
            const base64Image = await generateIllustration(activePage.imagePrompt, project.style);
            if (base64Image) {
                const newProject = JSON.parse(JSON.stringify(project)) as BookProject;

                // Increment count
                newProject.aiImagesGenerated = (newProject.aiImagesGenerated || 0) + 1;

                newProject.chapters.forEach(ch => {
                    const page = ch.pages.find(p => p.pageNumber === activePage.pageNumber);
                    if (page) page.imageUrl = base64Image;
                });
                onUpdateProject(newProject);
            }
        } catch (e) {
            alert("Failed to generate image. Please try again.");
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const jumpToPageNumber = (num: number) => {
        const idx = allPages.findIndex(p => p.pageNumber === num);
        if (idx !== -1) setActivePageIndex(idx);
    };

    if (!activePage) return <div className="text-center p-20 font-heading text-2xl text-cocoa-light">Loading masterpiece...</div>;

    return (
        <div className="h-[calc(100vh-80px)] w-full flex flex-col lg:flex-row overflow-hidden bg-cream-base relative">

            {/* Mobile Tab Toggle */}
            <div className="lg:hidden h-16 bg-white border-b border-peach-soft flex items-center justify-center px-4 shrink-0 z-30 shadow-sm">
                <div className="flex p-1 bg-cream-soft rounded-xl w-full max-w-xs border border-peach-soft/50">
                    <button
                        onClick={() => setMobileView('edit')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${mobileView === 'edit' ? 'bg-white text-coral-burst shadow-sm' : 'text-cocoa-light'}`}
                    >
                        <Edit3 className="w-3.5 h-3.5" /> Editor
                    </button>
                    <button
                        onClick={() => setMobileView('preview')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${mobileView === 'preview' ? 'bg-white text-coral-burst shadow-sm' : 'text-cocoa-light'}`}
                    >
                        <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                </div>
            </div>

            {/* Left Panel: Tools & Text */}
            <div className={`w-full lg:w-[40%] flex-col border-r border-peach-soft/50 bg-cream-soft ${mobileView === 'preview' ? 'hidden lg:flex' : 'flex h-full'}`}>

                {/* Header */}
                <div className="h-20 px-4 md:px-8 flex items-center justify-between border-b border-peach-soft/30 shrink-0 gap-4">
                    <div className="flex items-center gap-3 overflow-hidden">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="p-2 -ml-2 rounded-full hover:bg-white/50 text-cocoa-light hover:text-coral-burst transition-colors shrink-0"
                                aria-label="Go back"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div className="overflow-hidden">
                            <h2 className="font-heading font-bold text-xl text-charcoal-soft truncate max-w-[200px]">{project.title}</h2>
                            <div className="flex items-center gap-2 text-xs text-cocoa-light mt-1">
                                <span className="font-bold text-coral-burst">Page {activePage.pageNumber}</span>
                                <span>of {totalPages}</span>
                                {project.isBranching && <span className="bg-gold-sunshine/20 text-yellow-600 px-1.5 rounded">Interactive</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        {/* Undo/Redo */}
                        <div className="hidden sm:flex items-center bg-white/50 rounded-lg p-1 mr-2 border border-peach-soft/30">
                            <button
                                onClick={undo}
                                disabled={!canUndo}
                                className="p-1.5 text-cocoa-light hover:text-coral-burst disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Undo"
                            >
                                <Undo className="w-4 h-4" />
                            </button>
                            <div className="w-px h-4 bg-peach-soft/50 mx-1" />
                            <button
                                onClick={redo}
                                disabled={!canRedo}
                                className="p-1.5 text-cocoa-light hover:text-coral-burst disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Redo"
                            >
                                <Redo className="w-4 h-4" />
                            </button>
                        </div>

                        {/* AutoSave Indicator */}
                        <div className="hidden sm:flex items-center mr-2 text-xs text-cocoa-light/70" title={autoSaveState.lastSaved ? `Last saved: ${autoSaveState.lastSaved.toLocaleTimeString()}` : 'Unsaved changes'}>
                            {autoSaveState.isSaving ? (
                                <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                            ) : autoSaveState.hasUnsavedChanges ? (
                                <CloudOff className="w-3 h-3 mr-1 text-orange-400" />
                            ) : (
                                <Cloud className="w-3 h-3 mr-1 text-green-500" />
                            )}
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="p-2 text-cocoa-light hover:text-coral-burst transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isSaving ? "Saving..." : "Save"}
                        >
                            {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    <div className="space-y-3">
                        <label className="font-heading font-bold text-sm text-cocoa-light uppercase tracking-wider flex justify-between items-center">
                            Story Text
                            <div className="flex gap-2 items-center">
                                <button
                                    onClick={handleCheckConsistency}
                                    disabled={isCheckingConsistency}
                                    className="text-purple-600 hover:underline text-xs capitalize flex items-center gap-1 disabled:opacity-50"
                                    title="Check Character Consistency"
                                >
                                    {isCheckingConsistency ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                    {isCheckingConsistency ? 'Checking...' : 'Check Characters'}
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowImproveOptions(!showImproveOptions)}
                                        disabled={isImproving}
                                        className="text-coral-burst hover:underline text-xs capitalize flex items-center gap-1 disabled:opacity-50"
                                    >
                                        {isImproving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand className="w-3 h-3" />}
                                        {isImproving ? 'Improving...' : 'AI Improve'}
                                    </button>
                                    {showImproveOptions && (
                                        <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-peach-soft p-2 z-50 min-w-[160px]">
                                            {['more dramatic', 'funnier', 'simpler', 'more descriptive'].map(tone => (
                                                <button
                                                    key={tone}
                                                    onClick={() => handleImproveText(tone)}
                                                    className="w-full text-left px-3 py-2 text-xs text-charcoal-soft hover:bg-cream-base rounded-lg transition-colors capitalize"
                                                >
                                                    {tone}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </label>
                        <textarea
                            className="w-full h-[200px] bg-white border border-peach-soft rounded-2xl p-6 font-body text-lg text-charcoal-soft leading-loose focus:outline-none focus:border-coral-burst focus:ring-4 focus:ring-coral-burst/10 transition-all resize-none shadow-sm"
                            value={activePage.text}
                            onChange={(e) => handleTextChange(e.target.value)}
                            placeholder="Once upon a time..."
                        />

                        {/* Learning Content Display */}
                        {activePage.learningContent && (
                            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-200 mt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">🎓</span>
                                    <h4 className="font-heading font-bold text-sm text-emerald-900 uppercase">Learning Content</h4>
                                    {activePage.learningContent.topic && (
                                        <span className="ml-auto px-2 py-1 bg-emerald-200 text-emerald-800 text-xs rounded-full font-medium">
                                            {activePage.learningContent.topic}
                                        </span>
                                    )}
                                </div>

                                {activePage.learningContent.mentorDialogue && (
                                    <div className="bg-white rounded-xl p-4 mb-3 border border-emerald-100">
                                        <div className="flex items-start gap-3">
                                            <span className="text-xl">🦉</span>
                                            <div>
                                                <p className="text-xs font-bold text-emerald-700 mb-1">Mentor Says:</p>
                                                <p className="text-sm text-charcoal-soft italic">"{activePage.learningContent.mentorDialogue}"</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activePage.learningContent.quiz && (
                                    <div className="bg-white rounded-xl p-4 border border-emerald-100">
                                        <p className="text-xs font-bold text-emerald-700 mb-2">📝 Quiz Question:</p>
                                        <p className="text-sm text-charcoal-soft font-medium mb-3">{activePage.learningContent.quiz.question}</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {activePage.learningContent.quiz.options?.map((option: string, idx: number) => (
                                                <div
                                                    key={idx}
                                                    className={`px-3 py-2 rounded-lg text-xs font-medium ${option === activePage.learningContent?.quiz?.correctAnswer
                                                            ? 'bg-green-100 text-green-800 border-2 border-green-300'
                                                            : 'bg-gray-100 text-gray-700'
                                                        }`}
                                                >
                                                    {option} {option === activePage.learningContent?.quiz?.correctAnswer && '✓'}
                                                </div>
                                            ))}
                                        </div>
                                        {activePage.learningContent.quiz.explanation && (
                                            <p className="mt-3 text-xs text-emerald-600 italic">
                                                💡 {activePage.learningContent.quiz.explanation}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Feature #3: Real-Time Suggestions */}
                        {suggestions.length > 0 && (
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <Lightbulb className="w-4 h-4 text-blue-600" />
                                    <h4 className="font-heading font-bold text-xs text-blue-900 uppercase">Writing Suggestions</h4>
                                </div>
                                <div className="space-y-2">
                                    {suggestions.map((sug, i) => (
                                        <div key={i} className="bg-white rounded-lg p-3 text-xs">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-bold text-charcoal-soft capitalize">{sug.type}</span>
                                                <button
                                                    onClick={() => applySuggestion(sug)}
                                                    className="text-blue-600 hover:underline font-bold"
                                                >
                                                    Apply
                                                </button>
                                            </div>
                                            <p className="text-cocoa-light mb-1"><span className="line-through">{sug.original}</span> → <span className="text-green-600 font-medium">{sug.suggestion}</span></p>
                                            <p className="text-cocoa-light/70 italic">{sug.reason}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {isLoadingSuggestions && (
                            <div className="flex items-center gap-2 text-xs text-cocoa-light">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Analyzing your writing...
                            </div>
                        )}
                    </div>

                    {/* Feature #2: Character Consistency Panel */}
                    {showConsistencyPanel && consistencyReport && (
                        <div className="bg-purple-50 rounded-2xl p-6 border border-purple-200">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-purple-600" />
                                    <h3 className="font-heading font-bold text-sm text-purple-900">Character Consistency Report</h3>
                                </div>
                                <button onClick={() => setShowConsistencyPanel(false)} className="text-purple-600 hover:text-purple-800">
                                    ×
                                </button>
                            </div>
                            <div className="mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="font-heading font-bold text-2xl text-purple-900">{consistencyReport.overallScore}</span>
                                    <span className="text-xs text-purple-700">/100 Consistency Score</span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {consistencyReport.characters.map((char: any, i: number) => (
                                    <div key={i} className="bg-white rounded-xl p-4">
                                        <h4 className="font-heading font-bold text-sm text-charcoal-soft mb-2">{char.name}</h4>
                                        {char.inconsistencies.length > 0 ? (
                                            <div className="space-y-2">
                                                <div className="flex items-start gap-2">
                                                    <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                                                    <div className="text-xs">
                                                        <p className="font-bold text-orange-900 mb-1">Issues Found:</p>
                                                        <ul className="list-disc list-inside text-cocoa-light space-y-1">
                                                            {char.inconsistencies.map((inc: string, j: number) => (
                                                                <li key={j}>{inc}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                                {char.suggestions.length > 0 && (
                                                    <div className="flex items-start gap-2">
                                                        <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                                                        <div className="text-xs">
                                                            <p className="font-bold text-blue-900 mb-1">Suggestions:</p>
                                                            <ul className="list-disc list-inside text-cocoa-light space-y-1">
                                                                {char.suggestions.map((sug: string, j: number) => (
                                                                    <li key={j}>{sug}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-xs text-green-700">
                                                <CheckCircle2 className="w-4 h-4" />
                                                No inconsistencies found!
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CYOA Choices */}
                    {project.isBranching && activePage.choices && (
                        <div className="bg-white rounded-2xl p-6 border border-peach-soft/50 shadow-soft-sm">
                            <label className="font-heading font-bold text-sm text-cocoa-light uppercase tracking-wider mb-4 flex items-center gap-2">
                                <GitFork className="w-4 h-4 text-gold-sunshine" /> Branching Choices
                            </label>
                            <div className="space-y-3">
                                {activePage.choices.map((choice, i) => (
                                    <button
                                        key={i}
                                        onClick={() => jumpToPageNumber(choice.targetPageNumber)}
                                        className="w-full flex items-center justify-between bg-cream-base p-4 rounded-xl border border-peach-soft/30 hover:bg-peach-soft hover:border-coral-burst transition-all group text-left"
                                    >
                                        <span className="text-charcoal-soft font-medium text-sm flex-1 mr-3 group-hover:text-charcoal-soft/90 transition-colors">
                                            {choice.text}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-coral-burst bg-coral-burst/10 px-2 py-1 rounded-lg whitespace-nowrap group-hover:bg-coral-burst group-hover:text-white transition-colors">
                                                Go to pg {choice.targetPageNumber}
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-coral-burst opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Image Prompt */}
                    <div className="bg-cream-base rounded-2xl p-6 border border-peach-soft/50">
                        <label className="font-heading font-bold text-sm text-cocoa-light uppercase tracking-wider mb-2 block">Visual Description</label>
                        <p className="text-sm text-charcoal-soft/80 leading-relaxed italic">
                            "{activePage.imagePrompt}"
                        </p>
                    </div>

                </div>

                {/* Bottom Navigation Strip */}
                <div className="h-24 bg-white border-t border-peach-soft/50 flex items-center gap-3 px-6 overflow-x-auto pb-2 pt-2 shrink-0">
                    {allPages.map((p, idx) => (
                        <button
                            key={p.id}
                            onClick={() => setActivePageIndex(idx)}
                            className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center font-heading font-bold text-lg transition-all
                        ${activePageIndex === idx
                                    ? 'bg-coral-burst text-white shadow-lg scale-110'
                                    : 'bg-cream-base text-cocoa-light hover:bg-peach-soft'
                                }`}
                        >
                            {p.pageNumber}
                            {p.choices && p.choices.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-gold-sunshine mt-1" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Panel: Preview */}
            <div className={`w-full lg:w-[60%] bg-peach-soft/20 items-center justify-center p-4 lg:p-8 pt-12 lg:pt-16 relative overflow-hidden ${mobileView === 'edit' ? 'hidden lg:flex' : 'flex h-full'}`}>
                <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: "radial-gradient(#FF9B71 1px, transparent 1px)", backgroundSize: "24px 24px" }}></div>

                {/* Book Page Container */}
                <div className="w-full max-w-md md:max-w-2xl aspect-[3/4] bg-[#FFFCF8] shadow-2xl rounded-[4px] relative flex flex-col overflow-hidden transform transition-transform duration-500 hover:scale-[1.01]">

                    {/* Texture Overlay */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] opacity-40 mix-blend-multiply pointer-events-none z-10"></div>

                    {/* Illustration */}
                    <div className="relative h-[55%] w-full bg-gray-100 overflow-hidden group">
                        {activePage.imageUrl ? (
                            <img src={activePage.imageUrl} className="w-full h-full object-cover" alt="Scene" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-cream-base/50 text-cocoa-light gap-4">
                                <ImageIcon className="w-12 h-12 opacity-20" />
                                <button
                                    onClick={handleGenerateImage}
                                    className="px-6 py-3 rounded-full bg-white shadow-soft-md text-coral-burst font-heading font-bold text-sm hover:shadow-soft-lg hover:scale-105 transition-all flex items-center gap-2 z-20"
                                >
                                    {isGeneratingImage ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand className="w-4 h-4" />}
                                    Generate Illustration
                                </button>
                            </div>
                        )}
                        {/* Gradient overlay for text readability if needed */}
                        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#FFFCF8] to-transparent opacity-50"></div>
                    </div>

                    {/* Text Content */}
                    <div className="flex-1 p-6 md:p-12 relative z-20 flex flex-col overflow-y-auto">
                        <p className="font-heading text-xl md:text-2xl lg:text-3xl text-charcoal-soft leading-normal mb-auto">
                            {activePage.text}
                        </p>

                        {/* Interactive Buttons in Preview */}
                        {project.isBranching && activePage.choices && (
                            <div className="mt-8 space-y-3">
                                {activePage.choices.map((choice, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => jumpToPageNumber(choice.targetPageNumber)}
                                        className="w-full py-3 px-6 rounded-xl border-2 border-charcoal-soft/10 bg-white hover:bg-coral-burst hover:border-coral-burst hover:text-white text-charcoal-soft font-heading font-bold text-sm transition-all flex justify-between items-center group shadow-sm"
                                    >
                                        {choice.text}
                                        <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="mt-6 text-center">
                            <span className="font-heading font-bold text-cocoa-light/30 text-sm tracking-widest">- {activePage.pageNumber} -</span>
                        </div>
                    </div>
                </div>

                {/* Floating Action Bar */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md rounded-full shadow-soft-lg px-6 py-3 flex items-center gap-6 border border-white z-30">
                    <button
                        onClick={() => setActivePageIndex(Math.max(0, activePageIndex - 1))}
                        className="p-2 hover:bg-cream-base rounded-full text-charcoal-soft transition-colors"
                        aria-label="Previous page"
                        title="Previous page"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <span className="font-heading font-bold text-charcoal-soft text-sm whitespace-nowrap">Preview Mode</span>
                    <button
                        onClick={() => setActivePageIndex(Math.min(totalPages - 1, activePageIndex + 1))}
                        className="p-2 hover:bg-cream-base rounded-full text-charcoal-soft transition-colors"
                        aria-label="Next page"
                        title="Next page"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

            </div>
        </div >
    );
};

export default SmartEditor;
