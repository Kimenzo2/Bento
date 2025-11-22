import React, { useState } from 'react';
import { ContentStructure } from '../types/generator';
import { Check, Edit2, ChevronRight, ArrowLeft, Users, BookOpen, Layers, Wand2 } from 'lucide-react';

interface BlueprintReviewProps {
    blueprint: ContentStructure;
    onConfirm: (updatedBlueprint: ContentStructure) => void;
    onBack: () => void;
    isGenerating: boolean;
}

const BlueprintReview: React.FC<BlueprintReviewProps> = ({ blueprint, onConfirm, onBack, isGenerating }) => {
    const [editedBlueprint, setEditedBlueprint] = useState<ContentStructure>(blueprint);
    const [activeTab, setActiveTab] = useState<'overview' | 'characters' | 'chapters'>('overview');

    const handleConfirm = () => {
        onConfirm(editedBlueprint);
    };

    return (
        <div className="w-full max-w-6xl mx-auto px-4 pb-20 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 mt-8">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-cocoa-light hover:text-charcoal-soft transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Back to Idea
                </button>
                <h1 className="font-heading font-bold text-3xl text-charcoal-soft">Review Your Blueprint</h1>
                <div className="w-24"></div> {/* Spacer */}
            </div>

            <div className="bg-white rounded-[32px] shadow-soft-lg overflow-hidden border border-white/50">
                {/* Tabs */}
                <div className="flex border-b border-peach-soft/30">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 py-6 font-heading font-bold text-lg flex items-center justify-center gap-2 transition-colors ${activeTab === 'overview' ? 'text-coral-burst bg-cream-soft' : 'text-cocoa-light hover:bg-cream-base'}`}
                    >
                        <Layers className="w-5 h-5" /> Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('characters')}
                        className={`flex-1 py-6 font-heading font-bold text-lg flex items-center justify-center gap-2 transition-colors ${activeTab === 'characters' ? 'text-coral-burst bg-cream-soft' : 'text-cocoa-light hover:bg-cream-base'}`}
                    >
                        <Users className="w-5 h-5" /> Characters
                    </button>
                    <button
                        onClick={() => setActiveTab('chapters')}
                        className={`flex-1 py-6 font-heading font-bold text-lg flex items-center justify-center gap-2 transition-colors ${activeTab === 'chapters' ? 'text-coral-burst bg-cream-soft' : 'text-cocoa-light hover:bg-cream-base'}`}
                    >
                        <BookOpen className="w-5 h-5" /> Chapters ({editedBlueprint.pages?.length ?? 0} Pages)
                    </button>
                </div>

                {/* Content Area */}
                <div className="p-8 md:p-12 min-h-[500px]">

                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div>
                                <label className="block font-heading font-bold text-sm text-cocoa-light uppercase tracking-wide mb-2">Book Title</label>
                                <input
                                    type="text"
                                    value={editedBlueprint.title}
                                    onChange={(e) => setEditedBlueprint({ ...editedBlueprint, title: e.target.value })}
                                    className="w-full text-4xl font-heading font-bold text-charcoal-soft bg-transparent border-b-2 border-peach-soft focus:border-coral-burst focus:outline-none pb-2 placeholder-cocoa-light/30"
                                    placeholder="Enter title..."
                                />
                            </div>

                            <div>
                                <label className="block font-heading font-bold text-sm text-cocoa-light uppercase tracking-wide mb-2">Synopsis</label>
                                <textarea
                                    value={editedBlueprint.synopsis}
                                    onChange={(e) => setEditedBlueprint({ ...editedBlueprint, synopsis: e.target.value })}
                                    className="w-full bg-cream-base rounded-2xl p-6 text-lg font-body text-charcoal-soft border-2 border-transparent focus:border-coral-burst focus:outline-none resize-none h-40"
                                    placeholder="Enter synopsis..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-mint-breeze/10 rounded-2xl p-6">
                                    <h3 className="font-heading font-bold text-emerald-700 mb-2">Narrative Arc</h3>
                                    <div className="space-y-4 text-sm text-emerald-800">
                                        <div><span className="font-bold">Intro:</span> {editedBlueprint.narrativeArc.introduction}</div>
                                        <div><span className="font-bold">Middle:</span> {editedBlueprint.narrativeArc.learning}</div>
                                        <div><span className="font-bold">Climax:</span> {editedBlueprint.narrativeArc.mastery}</div>
                                    </div>
                                </div>
                                <div className="bg-gold-sunshine/10 rounded-2xl p-6">
                                    <h3 className="font-heading font-bold text-orange-700 mb-2">Visual Strategy</h3>
                                    <div className="space-y-2 text-sm text-orange-800">
                                        <div><span className="font-bold">Style:</span> {editedBlueprint.visualStrategy.artStyleDetails}</div>
                                        <div><span className="font-bold">Motifs:</span> {editedBlueprint.visualStrategy.motifs.join(", ")}</div>
                                    </div>
                                </div>
                                <div className="bg-purple-100 rounded-2xl p-6">
                                    <h3 className="font-heading font-bold text-purple-700 mb-2">Color Palette</h3>
                                    <div className="flex gap-2 flex-wrap">
                                        {[...editedBlueprint.colorPalette.primary, ...editedBlueprint.colorPalette.accent].map((color, i) => (
                                            <div key={i} className="w-8 h-8 rounded-full shadow-sm border border-white/20" style={{ backgroundColor: color }} title={color}></div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CHARACTERS TAB */}
                    {activeTab === 'characters' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                            {editedBlueprint.characterNeeds.map((char, idx) => (
                                <div key={idx} className="bg-white border-2 border-peach-soft rounded-2xl p-6 hover:border-coral-burst transition-colors group">
                                    <div className="flex justify-between items-start mb-4">
                                        <input
                                            type="text"
                                            value={char.name}
                                            onChange={(e) => {
                                                const newChars = [...editedBlueprint.characterNeeds];
                                                newChars[idx].name = e.target.value;
                                                setEditedBlueprint({ ...editedBlueprint, characterNeeds: newChars });
                                            }}
                                            className="font-heading font-bold text-xl text-charcoal-soft bg-transparent border-b border-transparent focus:border-coral-burst focus:outline-none w-full"
                                        />
                                        <span className="bg-cream-base px-3 py-1 rounded-full text-xs font-bold text-cocoa-light uppercase">{char.role}</span>
                                    </div>
                                    <textarea
                                        value={char.description}
                                        onChange={(e) => {
                                            const newChars = [...editedBlueprint.characterNeeds];
                                            newChars[idx].description = e.target.value;
                                            setEditedBlueprint({ ...editedBlueprint, characterNeeds: newChars });
                                        }}
                                        className="w-full bg-cream-base/50 rounded-xl p-3 text-sm text-charcoal-soft border border-transparent focus:border-coral-burst focus:outline-none resize-none h-24 mb-4"
                                    />
                                    <div className="space-y-2">
                                        <div className="text-xs font-bold text-cocoa-light uppercase">Visual Traits</div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">{char.visualTraits.eyes}</span>
                                            <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded text-xs">{char.visualTraits.hair}</span>
                                            <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">{char.visualTraits.clothing}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* CHAPTERS TAB */}
                    {activeTab === 'chapters' && (
                        <div className="space-y-4 animate-fadeIn">
                            {editedBlueprint.pages.map((page, idx) => (
                                <div key={idx} className="flex gap-4 p-4 bg-cream-base/30 rounded-2xl border border-transparent hover:border-peach-soft transition-colors">
                                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-heading font-bold text-coral-burst shadow-sm shrink-0">
                                        {page.pageNumber}
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div className="flex justify-between">
                                            <span className="font-bold text-charcoal-soft">Page {page.pageNumber}: {page.scene.substring(0, 50)}...</span>
                                            <span className="text-xs text-cocoa-light bg-white px-2 py-1 rounded border border-peach-soft">{page.layoutTemplate}</span>
                                        </div>
                                        <textarea
                                            value={page.scene}
                                            onChange={(e) => {
                                                const newPages = [...editedBlueprint.pages];
                                                newPages[idx].scene = e.target.value;
                                                setEditedBlueprint({ ...editedBlueprint, pages: newPages });
                                            }}
                                            className="w-full bg-white rounded-xl p-3 text-sm text-charcoal-soft border border-peach-soft/50 focus:border-coral-burst focus:outline-none resize-none h-20"
                                            placeholder="Describe the scene..."
                                        />
                                        <div className="flex gap-2 text-xs text-cocoa-light">
                                            <span className="flex items-center gap-1"><Wand2 className="w-3 h-3" /> {page.visualEnergy}</span>
                                            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {page.characterAction}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                <div className="bg-cream-base p-8 flex justify-between items-center border-t border-peach-soft/30">
                    <div className="text-cocoa-light text-sm">
                        Make sure everything looks right before we start drawing!
                    </div>
                    <button
                        onClick={handleConfirm}
                        disabled={isGenerating}
                        className={`px-8 py-3 rounded-full font-heading font-bold text-lg transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center gap-2
                            ${isGenerating
                                ? 'bg-cocoa-light cursor-not-allowed text-white opacity-70'
                                : 'bg-gradient-to-r from-emerald-400 to-mint-breeze text-white hover:scale-105'
                            }`}
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Generating Assets...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                Approve Blueprint
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BlueprintReview;
