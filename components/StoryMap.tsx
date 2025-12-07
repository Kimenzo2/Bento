import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Map,
    ChevronRight,
    Image as ImageIcon,
    Type,
    ArrowRight,
    Plus,
    X,
    ZoomIn,
    ZoomOut,
    Maximize,
    Edit,
    Eye
} from 'lucide-react';
import { BookProject, Page, AppMode } from '../types';

interface StoryMapProps {
    project: BookProject;
    onNavigateToEditor?: () => void;
    onClose: () => void;
    onUpdateProject?: (project: BookProject) => void;
}

const StoryMap: React.FC<StoryMapProps> = ({ project, onNavigateToEditor, onClose, onUpdateProject }) => {
    const [scale, setScale] = useState(1);
    const [selectedNode, setSelectedNode] = useState<number | null>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    // Calculate grid layout
    // We'll use a simple flow layout: Start -> Middle -> End
    // But visualized as a "Journey Map"

    const pages = project.chapters.flatMap(c => c.pages);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === '+' || e.key === '=') setScale(Math.min(2, scale + 0.1));
            if (e.key === '-') setScale(Math.max(0.5, scale - 0.1));
            if (e.key === '0') setScale(1);
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [scale, onClose]);

    const handleAddNewPage = () => {
        if (!onUpdateProject || !project) return;

        // Add a new page to the first chapter (or create one if none exist)
        const updatedProject = { ...project };

        if (updatedProject.chapters.length === 0) {
            updatedProject.chapters = [{
                id: `chapter-${Date.now()}`,
                title: 'Chapter 1',
                pages: []
            }];
        }

        const newPage: Page = {
            id: `page-${Date.now()}`,
            pageNumber: pages.length + 1,
            text: '',
            imagePrompt: '',
            imageUrl: '',
            layoutType: 'text-only'
        };

        updatedProject.chapters[0].pages.push(newPage);
        onUpdateProject(updatedProject);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[60] flex flex-col animate-fadeIn">
            {/* Header */}
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-slate-900">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <Map className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-white font-heading font-bold text-lg">Story Map</h2>
                        <p className="text-slate-400 text-xs">Visualizing {project.title}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Zoom Controls */}
                    <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-white/10 gap-1">
                        <button
                            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                            className="p-2 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="Zoom out (-)"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setScale(1)}
                            className="px-3 py-1 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors min-h-[36px]"
                            title="Reset zoom (0)"
                        >
                            {Math.round(scale * 100)}%
                        </button>
                        <button
                            onClick={() => setScale(Math.min(2, scale + 0.1))}
                            className="p-2 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                            title="Zoom in (+)"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Edit in Editor Button */}
                    {onNavigateToEditor && (
                        <button
                            onClick={onNavigateToEditor}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium text-sm min-h-[36px]"
                            title="Edit pages in Editor"
                        >
                            <Edit className="w-4 h-4" />
                            <span className="hidden md:inline">Edit Pages</span>
                        </button>
                    )}

                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-red-500/20 hover:text-red-400 text-slate-400 rounded-full transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Close (Esc)"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 overflow-hidden relative bg-[url('/assets/grid-pattern.svg')] bg-repeat opacity-100">
                {/* Background Grid Effect */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                    style={{
                        backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
                        backgroundSize: '24px 24px'
                    }}
                />

                <div className="w-full h-full overflow-auto flex items-center p-20">
                    <motion.div
                        className="flex items-start gap-8 min-w-max mx-auto"
                        style={{ scale }}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale }}
                        transition={{ duration: 0.3 }}
                    >
                        {pages.map((page, index) => (
                            <div key={page.id} className="relative group">
                                {/* Connection Line */}
                                {index < pages.length - 1 && (
                                    <div className="absolute top-1/2 -right-8 w-8 h-0.5 bg-slate-700 group-hover:bg-emerald-500/50 transition-colors">
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2">
                                            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-500 transition-colors" />
                                        </div>
                                    </div>
                                )}

                                {/* Node Card */}
                                <motion.div
                                    whileHover={{ y: -5, scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                        setSelectedNode(index);
                                    }}
                                    className={`
                                        w-64 bg-slate-800 rounded-xl border-2 overflow-hidden cursor-pointer transition-all shadow-xl flex-shrink-0
                                        ${selectedNode === index
                                            ? 'border-emerald-500 shadow-emerald-500/20 ring-2 ring-emerald-500/30'
                                            : 'border-slate-700 hover:border-emerald-500/50 hover:shadow-emerald-500/10'
                                        }
                                    `}
                                >
                                    {/* Image Preview */}
                                    <div className="h-32 bg-slate-900 relative overflow-hidden group-hover:opacity-90 transition-opacity">
                                        {page.imageUrl ? (
                                            <img src={page.imageUrl} alt="Scene" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                                                <ImageIcon className="w-8 h-8" />
                                                <span className="text-xs font-medium">No Image</span>
                                            </div>
                                        )}
                                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white border border-white/10">
                                            Scene {index + 1}
                                        </div>
                                    </div>

                                    {/* Content Preview */}
                                    <div className="p-4">
                                        <div className="flex items-start gap-2 mb-2">
                                            <Type className="w-3 h-3 text-slate-500 mt-1 flex-shrink-0" />
                                            <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                                                {page.text || <span className="italic text-slate-600">Empty page...</span>}
                                            </p>
                                        </div>

                                        {/* Tags/Meta */}
                                        <div className="flex items-center justify-between mt-3">
                                            <div className="flex flex-wrap gap-1">
                                                {page.layoutType && (
                                                    <span className="px-1.5 py-0.5 bg-slate-700 rounded text-[9px] text-slate-400 uppercase tracking-wider">
                                                        {page.layoutType.replace('-', ' ')}
                                                    </span>
                                                )}
                                                {page.imageUrl && (
                                                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[9px] uppercase tracking-wider">
                                                        illustrated
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onNavigateToEditor?.();
                                                }}
                                                className="p-1.5 hover:bg-emerald-500/20 rounded-md text-slate-500 hover:text-emerald-400 transition-colors"
                                                title="View/Edit this page"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        ))}

                        {/* Add New Node Button */}
                        {onUpdateProject && (
                            <motion.button
                                onClick={handleAddNewPage}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="w-16 h-16 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-600 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all mt-24 cursor-pointer"
                                title="Add new page"
                            >
                                <Plus className="w-6 h-6" />
                            </motion.button>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default StoryMap;