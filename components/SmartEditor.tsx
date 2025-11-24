
import React, { useState } from 'react';
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
    Eye
} from 'lucide-react';
import { generateIllustration } from '../services/geminiService';

interface SmartEditorProps {
    project: BookProject;
    onUpdateProject: (project: BookProject) => void;
    userTier?: UserTier;
}

const SmartEditor: React.FC<SmartEditorProps> = ({ project, onUpdateProject, userTier = UserTier.SPARK }) => {
    const [activePageIndex, setActivePageIndex] = useState(0);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');

    const allPages = project.chapters.flatMap(c => c.pages);
    const activePage = allPages[activePageIndex];
    const totalPages = allPages.length;

    const handleTextChange = (text: string) => {
        const newProject = JSON.parse(JSON.stringify(project)) as BookProject;
        newProject.chapters.forEach(ch => {
            const page = ch.pages.find(p => p.pageNumber === activePage.pageNumber);
            if (page) page.text = text;
        });
        onUpdateProject(newProject);
    };

    const handleGenerateImage = async () => {
        if (!activePage) return;
        setIsGeneratingImage(true);
        try {
            const base64Image = await generateIllustration(activePage.imagePrompt, project.style);
            if (base64Image) {
                const newProject = JSON.parse(JSON.stringify(project)) as BookProject;
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
        <div className="h-[calc(100vh-80px)] w-full flex flex-col md:flex-row overflow-hidden bg-cream-base relative">

            {/* Mobile Tab Toggle */}
            <div className="md:hidden h-16 bg-white border-b border-peach-soft flex items-center justify-center px-4 shrink-0 z-30 shadow-sm">
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
            <div className={`w-full md:w-[40%] flex-col border-r border-peach-soft/50 bg-cream-soft ${mobileView === 'preview' ? 'hidden md:flex' : 'flex h-full'}`}>

                {/* Header */}
                <div className="h-20 px-8 flex items-center justify-between border-b border-peach-soft/30 shrink-0">
                    <div className="overflow-hidden">
                        <h2 className="font-heading font-bold text-xl text-charcoal-soft truncate max-w-[200px]">{project.title}</h2>
                        <div className="flex items-center gap-2 text-xs text-cocoa-light mt-1">
                            <span className="font-bold text-coral-burst">Page {activePage.pageNumber}</span>
                            <span>of {totalPages}</span>
                            {project.isBranching && <span className="bg-gold-sunshine/20 text-yellow-600 px-1.5 rounded">Interactive</span>}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button className="p-2 text-cocoa-light hover:text-coral-burst transition-colors" title="Save">
                            <Save className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">

                    {/* Narrative Editor */}
                    <div className="space-y-3">
                        <label className="font-heading font-bold text-sm text-cocoa-light uppercase tracking-wider flex justify-between">
                            Story Text
                            <button className="text-coral-burst hover:underline text-xs capitalize flex items-center gap-1">
                                <Wand className="w-3 h-3" /> AI Improve
                            </button>
                        </label>
                        <textarea
                            className="w-full h-[240px] bg-white border border-peach-soft rounded-2xl p-6 font-body text-lg text-charcoal-soft leading-loose focus:outline-none focus:border-coral-burst focus:ring-4 focus:ring-coral-burst/10 transition-all resize-none shadow-sm"
                            value={activePage.text}
                            onChange={(e) => handleTextChange(e.target.value)}
                            placeholder="Once upon a time..."
                        />
                    </div>

                    {/* CYOA Choices */}
                    {project.isBranching && activePage.choices && (
                        <div className="bg-white rounded-2xl p-6 border border-peach-soft/50 shadow-soft-sm">
                            <label className="font-heading font-bold text-sm text-cocoa-light uppercase tracking-wider mb-4 flex items-center gap-2">
                                <GitFork className="w-4 h-4 text-gold-sunshine" /> Branching Choices
                            </label>
                            <div className="space-y-3">
                                {activePage.choices.map((choice, i) => (
                                    <div key={i} className="flex items-center justify-between bg-cream-base p-3 rounded-xl border border-peach-soft/30">
                                        <span className="text-charcoal-soft font-medium text-sm truncate flex-1 mr-3">{choice.text}</span>
                                        <span className="text-xs font-bold text-coral-burst bg-coral-burst/10 px-2 py-1 rounded-lg whitespace-nowrap">
                                            Go to pg {choice.targetPageNumber}
                                        </span>
                                    </div>
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
            <div className={`w-full md:w-[60%] bg-peach-soft/20 items-center justify-center p-4 md:p-8 pt-12 md:pt-16 relative overflow-hidden ${mobileView === 'edit' ? 'hidden md:flex' : 'flex h-full'}`}>
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
                    <button onClick={() => setActivePageIndex(Math.max(0, activePageIndex - 1))} className="p-2 hover:bg-cream-base rounded-full text-charcoal-soft transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <span className="font-heading font-bold text-charcoal-soft text-sm whitespace-nowrap">Preview Mode</span>
                    <button onClick={() => setActivePageIndex(Math.min(totalPages - 1, activePageIndex + 1))} className="p-2 hover:bg-cream-base rounded-full text-charcoal-soft transition-colors">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

            </div>
        </div>
    );
};

export default SmartEditor;
