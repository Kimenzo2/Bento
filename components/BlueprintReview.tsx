import { IcoBook, IcoWand } from './IconscoutIcons';
import { ArrowLeft, Check, Layers, Users } from 'lucide-react';
import type React from 'react';
import { Button } from './ui/button';
import { Input, Label } from './ui/input';
import { Textarea } from './ui/input';
import { useState } from 'react';
import type { ContentStructure } from '../types/generator';
import { mastra } from '../src/services/mastraClient';

interface BlueprintReviewProps {
  blueprint: ContentStructure;
  onConfirm: (updatedBlueprint: ContentStructure) => void;
  onBack: () => void;
  isGenerating: boolean;
  /** MASTRA MIGRATION: If provided, approval resumes the suspended workflow */
  workflowId?: string;
}

const BlueprintReview: React.FC<BlueprintReviewProps> = ({
  blueprint,
  onConfirm,
  onBack,
  isGenerating,
  workflowId,
}) => {
  const [editedBlueprint, setEditedBlueprint] = useState<ContentStructure>(blueprint);
  const [activeTab, setActiveTab] = useState<'overview' | 'characters' | 'chapters'>('overview');
  const [isResuming, setIsResuming] = useState(false);

  const handleConfirm = async () => {
    // MASTRA MIGRATION: If we have a workflowId, resume the suspended workflow
    // with the approved (possibly edited) blueprint. Otherwise, use legacy path.
    if (workflowId) {
      setIsResuming(true);
      try {
        await mastra.workflows.resumeBookGeneration(workflowId, editedBlueprint);
      } catch (err) {
        console.warn('[BlueprintReview] Mastra resume failed, using legacy path:', err);
      } finally {
        setIsResuming(false);
      }
    }
    // Always call the parent handler (maintains backward compatibility)
    onConfirm(editedBlueprint);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pb-20 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 mt-8">
        <Button
          variant="ghost"
          onClick={onBack}
          className="flex text-cocoa-light hover:text-charcoal-soft"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Idea
        </Button>
        <h1 className="font-heading font-bold text-3xl text-charcoal-soft">
          Review Your Blueprint
        </h1>
        <div className="w-24"></div> {/* Spacer */}
      </div>

      <div className="bg-surface rounded-4xl overflow-hidden border border-peach-soft">
        {/* Tabs */}
        <div className="flex border-b border-peach-soft/30">
          <Button
            variant="ghost"
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-6 text-lg flex ${activeTab === 'overview' ? 'text-coral-burst bg-cream-soft' : 'text-cocoa-light hover:bg-cream-base'}`}
          >
            <Layers className="w-5 h-5" /> Overview
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab('characters')}
            className={`flex-1 py-6 text-lg flex ${activeTab === 'characters' ? 'text-coral-burst bg-cream-soft' : 'text-cocoa-light hover:bg-cream-base'}`}
          >
            <Users className="w-5 h-5" /> Characters
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab('chapters')}
            className={`flex-1 py-6 text-lg flex ${activeTab === 'chapters' ? 'text-coral-burst bg-cream-soft' : 'text-cocoa-light hover:bg-cream-base'}`}
          >
            <IcoBook className="w-5 h-5" /> Chapters ({editedBlueprint.pages?.length ?? 0} Pages)
          </Button>
        </div>

        {/* Content Area */}
        <div className="p-8 md:p-12 min-h-[500px]">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fadeIn">
              <div>
                <Label className="uppercase tracking-wide mb-2">
                  Book Title
                </Label>
                <Input
                  type="text"
                  value={editedBlueprint.title}
                  onChange={(e) =>
                    setEditedBlueprint({ ...editedBlueprint, title: e.target.value })
                  }
                  className="text-4xl font-heading font-bold bg-transparent border-0 border-b-2 border-peach-soft pb-2 placeholder-cocoa-light/30"
                  placeholder="Enter title..."
                />
              </div>

              <div>
                <Label className="uppercase tracking-wide mb-2">
                  Synopsis
                </Label>
                <Textarea
                  value={editedBlueprint.synopsis}
                  onChange={(e) =>
                    setEditedBlueprint({ ...editedBlueprint, synopsis: e.target.value })
                  }
                  className="bg-cream-base rounded-2xl p-6 text-lg border-transparent h-40"
                  placeholder="Enter synopsis..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-mint-breeze/10 rounded-2xl p-6">
                  <h3 className="font-heading font-bold text-emerald-700 mb-2">Narrative Arc</h3>
                  <div className="space-y-4 text-sm text-emerald-800">
                    <div>
                      <span className="font-bold">Intro:</span>{' '}
                      {editedBlueprint.narrativeArc.introduction}
                    </div>
                    <div>
                      <span className="font-bold">Middle:</span>{' '}
                      {editedBlueprint.narrativeArc.learning}
                    </div>
                    <div>
                      <span className="font-bold">Climax:</span>{' '}
                      {editedBlueprint.narrativeArc.mastery}
                    </div>
                  </div>
                </div>
                <div className="bg-gold-sunshine/10 rounded-2xl p-6">
                  <h3 className="font-heading font-bold text-orange-700 mb-2">Visual Strategy</h3>
                  <div className="space-y-2 text-sm text-orange-800">
                    <div>
                      <span className="font-bold">Style:</span>{' '}
                      {editedBlueprint.visualStrategy.artStyleDetails}
                    </div>
                    <div>
                      <span className="font-bold">Motifs:</span>{' '}
                      {editedBlueprint.visualStrategy.motifs.join(', ')}
                    </div>
                  </div>
                </div>
                <div className="bg-purple-100 rounded-2xl p-6">
                  <h3 className="font-heading font-bold text-purple-700 mb-2">Color Palette</h3>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      ...editedBlueprint.colorPalette.primary,
                      ...editedBlueprint.colorPalette.accent,
                    ].map((color, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full border border-white/20"
                        style={{ backgroundColor: color }}
                        title={color}
                      ></div>
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
                <div
                  key={idx}
                  className="bg-surface border border-peach-soft rounded-2xl p-6 hover:border-coral-burst transition-colors group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <Input
                      type="text"
                      value={char.name}
                      onChange={(e) => {
                        const newChars = [...editedBlueprint.characterNeeds];
                        newChars[idx].name = e.target.value;
                        setEditedBlueprint({ ...editedBlueprint, characterNeeds: newChars });
                      }}
                      className="font-heading font-bold text-xl bg-transparent border-0 border-b border-transparent"
                    />
                    <span className="bg-cream-base px-3 py-1 rounded-full text-xs font-bold text-cocoa-light uppercase">
                      {char.role}
                    </span>
                  </div>
                  <Textarea
                    value={char.description}
                    onChange={(e) => {
                      const newChars = [...editedBlueprint.characterNeeds];
                      newChars[idx].description = e.target.value;
                      setEditedBlueprint({ ...editedBlueprint, characterNeeds: newChars });
                    }}
                    className="bg-cream-base/50 p-3 border-transparent h-24 mb-4"
                  />
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-cocoa-light uppercase">
                      Visual Traits
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                        {char.visualTraits.eyes}
                      </span>
                      <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded text-xs">
                        {char.visualTraits.hair}
                      </span>
                      <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                        {char.visualTraits.clothing}
                      </span>
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
                <div
                  key={idx}
                  className="flex gap-4 p-4 bg-cream-base/30 rounded-2xl border border-transparent hover:border-peach-soft transition-colors"
                >
                  <div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center font-heading font-bold text-coral-burst border border-peach-soft/50 shrink-0">
                    {page.pageNumber}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between">
                      <span className="font-bold text-charcoal-soft">
                        Page {page.pageNumber}: {page.scene.substring(0, 50)}...
                      </span>
                      <span className="text-xs text-cocoa-light bg-surface px-2 py-1 rounded border border-peach-soft">
                        {page.layoutTemplate}
                      </span>
                    </div>
                    <Textarea
                      value={page.scene}
                      onChange={(e) => {
                        const newPages = [...editedBlueprint.pages];
                        newPages[idx].scene = e.target.value;
                        setEditedBlueprint({ ...editedBlueprint, pages: newPages });
                      }}
                      className="p-3 border-peach-soft/50 h-20"
                      placeholder="Describe the scene..."
                    />
                    <div className="flex gap-2 text-xs text-cocoa-light">
                      <span className="flex items-center gap-1">
                        <IcoWand className="w-3 h-3" /> {page.visualEnergy}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {page.characterAction}
                      </span>
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
          <Button
            variant="primary"
            size="lg"
            onClick={handleConfirm}
            disabled={isGenerating || isResuming}
            className={`rounded-full border border-white/20 hover:-translate-y-1 flex text-lg
                            ${
                              isGenerating || isResuming
                                ? 'bg-cocoa-light text-white opacity-70'
                                : 'bg-linear-to-r from-emerald-400 to-mint-breeze text-white hover:scale-105'
                            }`}
          >
            {isGenerating || isResuming ? (
              <>
                <div className="w-5 h-5 border border-white/30 border-t-white rounded-full animate-spin"></div>
                {isResuming ? 'Resuming Pipeline...' : 'Generating Assets...'}
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Approve Blueprint
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BlueprintReview;
