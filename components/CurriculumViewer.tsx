/**
 * CurriculumViewer Component
 * 
 * Displays curriculum ebooks with instructional content, differentiated materials,
 * SEL integration, and teacher notes.
 */

import React, { useState } from 'react';
import {
  CurriculumEbook,
  InstructionalPage,
  DifferentiationTier
} from '../types/curriculum';
import CurriculumAssessment from './CurriculumAssessment';

// Helper type for accessing dynamic properties safely
type AnyRecord = Record<string, unknown>;

interface CurriculumViewerProps {
  ebook: CurriculumEbook;
  onClose?: () => void;
  onEdit?: () => void;
  userRole?: 'student' | 'teacher' | 'parent';
}

type ViewMode = 'story' | 'instruction' | 'assessment' | 'resources';

// Helper to safely get nested properties
const safeGet = (obj: unknown, ...keys: string[]): unknown => {
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = (current as AnyRecord)[key];
  }
  return current;
};

// Helper to check if value is a non-empty array
const isNonEmptyArray = (val: unknown): val is unknown[] =>
  Array.isArray(val) && val.length > 0;

export const CurriculumViewer: React.FC<CurriculumViewerProps> = ({
  ebook,
  onClose,
  onEdit,
  userRole = 'student'
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('story');
  const [differentiationTier, setDifferentiationTier] = useState<DifferentiationTier>('onLevel');
  const [showTeacherNotes, setShowTeacherNotes] = useState(userRole === 'teacher');
  const [showSEL, setShowSEL] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  // Handle both InstructionalPage[] and InstructionalSection[] formats
  const pages = (ebook.instructionalSequence || []) as unknown as InstructionalPage[];
  const currentPage = pages[currentPageIndex] as InstructionalPage | undefined;

  // Navigate pages
  const goToPage = (index: number) => {
    if (index >= 0 && index < pages.length) {
      setCurrentPageIndex(index);
    }
  };

  // Get differentiated content
  const getDifferentiatedContent = (page: InstructionalPage | undefined): string => {
    if (!page) return '';
    const diff = page.differentiatedContent;
    if (!diff) return page.narrativeContent || '';

    switch (differentiationTier) {
      case 'approaching':
        return diff.approaching?.content || page.narrativeContent || '';
      case 'advanced':
        return diff.advanced?.content || page.narrativeContent || '';
      default:
        return diff.onLevel?.content || page.narrativeContent || '';
    }
  };

  // Text-to-speech
  const speakContent = () => {
    if ('speechSynthesis' in window) {
      if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
      } else {
        const content = getDifferentiatedContent(currentPage);
        const utterance = new SpeechSynthesisUtterance(content);
        utterance.rate = 0.9;
        utterance.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
      }
    }
  };

  // Early return if no current page
  if (!currentPage) {
    return (
      <div className="min-h-screen bg-cream-base flex items-center justify-center">
        <p className="text-cocoa-light">No content available</p>
      </div>
    );
  }

  // Render story mode
  const renderStoryMode = () => (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Title */}
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-heading font-bold text-charcoal-soft mb-2">
          {currentPage.title || `Page ${currentPage.pageNumber}`}
        </h2>
        {currentPage.pageType && (
          <span className="px-3 py-1 bg-coral-light/20 text-coral-burst rounded-full text-sm font-bold uppercase tracking-wider">
            {currentPage.pageType}
          </span>
        )}
      </div>

      {/* Image Placeholder */}
      <div className="aspect-video bg-gradient-to-br from-peach-soft/30 to-coral-light/20 rounded-3xl flex items-center justify-center border border-peach-soft/50 shadow-inner">
        <div className="text-center p-4">
          <div className="text-4xl mb-2">🖼️</div>
          <p className="text-cocoa-light text-sm max-w-md font-medium">
            {currentPage.imagePrompt?.substring(0, 100)}...
          </p>
        </div>
      </div>

      {/* Narrative Content */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-soft-lg border border-peach-soft/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-bold text-coral-burst flex items-center gap-2">
            <span>📖</span> Story
          </h3>
          <button
            onClick={speakContent}
            className={`p-2.5 rounded-xl transition-all shadow-sm ${isPlaying
                ? 'bg-coral-burst text-white shadow-md scale-105'
                : 'bg-cream-soft text-cocoa-light hover:bg-peach-soft/50 hover:text-charcoal-soft'
              }`}
          >
            {isPlaying ? '⏹️' : '🔊'}
          </button>
        </div>
        <p className="text-charcoal-soft leading-relaxed text-lg font-body">
          {getDifferentiatedContent(currentPage)}
        </p>
      </div>

      {/* Vocabulary */}
      {isNonEmptyArray(currentPage.vocabularyFocus) && (
        <div className="bg-gold-sunshine/10 rounded-3xl p-6 border border-gold-sunshine/30">
          <h4 className="text-cocoa-dark font-heading font-bold mb-4 flex items-center gap-2">
            <span>📚</span> Vocabulary
          </h4>
          <div className="grid gap-3">
            {(currentPage.vocabularyFocus as Array<{ term: string; definition: string; example?: string }>).map((vocab, idx: number) => (
              <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-peach-soft/20">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-charcoal-soft text-lg">{vocab.term}</span>
                </div>
                <p className="text-cocoa-light text-sm mt-1">{vocab.definition}</p>
                {vocab.example && (
                  <p className="text-cocoa-light/70 text-xs mt-2 italic bg-cream-soft p-2 rounded-lg">"{vocab.example}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEL Integration */}
      {showSEL && currentPage.selIntegration && (
        <div className="bg-purple-500/5 rounded-3xl p-6 border border-purple-500/20">
          <h4 className="text-purple-600 font-heading font-bold mb-4 flex items-center gap-2">
            <span>💜</span> Social-Emotional Check-In
          </h4>
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full w-fit shadow-sm border border-purple-100">
              <span className="text-xs font-bold text-cocoa-light uppercase">Competency:</span>
              <span className="text-purple-600 font-bold text-sm">{currentPage.selIntegration.competency}</span>
            </div>
            <p className="text-charcoal-soft text-sm bg-white p-4 rounded-xl shadow-sm border border-purple-100">
              {currentPage.selIntegration.scenario}
            </p>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-100">
              <p className="text-purple-600 text-sm font-bold mb-2">🤔 Reflection:</p>
              <p className="text-charcoal-soft text-sm">{currentPage.selIntegration.reflectionPrompt}</p>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Elements */}
      {isNonEmptyArray(currentPage.interactiveElements) && (
        <div className="bg-green-500/10 rounded-3xl p-6 border border-green-500/20">
          <h4 className="text-green-700 font-heading font-bold mb-4 flex items-center gap-2">
            <span>✨</span> Interactive Activity
          </h4>
          {(currentPage.interactiveElements as Array<{ type: string; prompt: string; options?: string[] }>).map((element, idx: number) => (
            <div key={idx} className="space-y-3">
              <p className="text-charcoal-soft font-medium text-lg">{element.prompt}</p>
              {element.type === 'checkForUnderstanding' && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-green-100 flex items-center gap-3">
                  <span className="text-2xl">🤝</span>
                  <p className="text-cocoa-light text-sm font-medium">Think about this, then share with a partner!</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render instruction mode (teacher view)
  const renderInstructionMode = () => (
    <div className="p-4 md:p-6 space-y-6">
      {/* Instructional Content */}
      {currentPage.instructionalContent && (
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100 shadow-sm">
            <h4 className="text-blue-600 font-heading font-bold mb-3 text-lg flex items-center gap-2">
              <span>🎯</span> Concept: {currentPage.instructionalContent.concept}
            </h4>
            <p className="text-charcoal-soft leading-relaxed">{currentPage.instructionalContent.explanation}</p>
          </div>

          {/* Examples */}
          {currentPage.instructionalContent.examples && currentPage.instructionalContent.examples.length > 0 && (
            <div className="bg-green-50 rounded-3xl p-6 border border-green-100 shadow-sm">
              <h4 className="text-green-600 font-heading font-bold mb-3 flex items-center gap-2">
                <span>✅</span> Examples
              </h4>
              <ul className="space-y-3">
                {currentPage.instructionalContent.examples.map((example, idx) => (
                  <li key={idx} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-green-100">
                    <span className="text-green-500 mt-1">•</span>
                    <span className="text-charcoal-soft">{example}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Non-Examples */}
          {isNonEmptyArray(currentPage.instructionalContent.nonExamples) && (
            <div className="bg-red-50 rounded-3xl p-6 border border-red-100 shadow-sm">
              <h4 className="text-red-600 font-heading font-bold mb-3 flex items-center gap-2">
                <span>❌</span> Non-Examples (Common Misconceptions)
              </h4>
              <ul className="space-y-3">
                {(currentPage.instructionalContent.nonExamples as string[]).map((example: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-red-100">
                    <span className="text-red-500 mt-1">•</span>
                    <span className="text-charcoal-soft">{example}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Scaffolding */}
          {isNonEmptyArray(currentPage.instructionalContent.scaffolding) && (
            <div className="bg-purple-50 rounded-3xl p-6 border border-purple-100 shadow-sm">
              <h4 className="text-purple-600 font-heading font-bold mb-3 flex items-center gap-2">
                <span>🪜</span> Scaffolding Steps
              </h4>
              <ol className="space-y-3">
                {(currentPage.instructionalContent.scaffolding as string[]).map((step: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-purple-100">
                    <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-charcoal-soft">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Teacher Notes */}
      {showTeacherNotes && currentPage.teacherNotes && (
        <div className="bg-gold-sunshine/10 rounded-3xl p-6 border border-gold-sunshine/30 shadow-sm">
          <h4 className="text-cocoa-dark font-heading font-bold mb-4 flex items-center gap-2">
            <span>👩‍🏫</span> Teacher Notes
          </h4>

          {typeof currentPage.teacherNotes === 'string' ? (
            <p className="text-charcoal-soft text-sm">{currentPage.teacherNotes}</p>
          ) : (
            <div className="space-y-4">
              {isNonEmptyArray(safeGet(currentPage.teacherNotes, 'anticipatedMisconceptions')) && (
                <div className="bg-white rounded-xl p-4 border border-peach-soft/30">
                  <p className="text-sm font-bold text-cocoa-light uppercase mb-2">Anticipated Misconceptions:</p>
                  <ul className="space-y-2">
                    {(safeGet(currentPage.teacherNotes, 'anticipatedMisconceptions') as string[]).map((misc: string, idx: number) => (
                      <li key={idx} className="text-charcoal-soft text-sm flex items-start gap-2">
                        <span className="text-coral-burst">•</span>
                        {misc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {isNonEmptyArray(safeGet(currentPage.teacherNotes, 'discussionStarters')) && (
                <div className="bg-white rounded-xl p-4 border border-peach-soft/30">
                  <p className="text-sm font-bold text-cocoa-light uppercase mb-2">Discussion Starters:</p>
                  <ul className="space-y-2">
                    {(safeGet(currentPage.teacherNotes, 'discussionStarters') as string[]).map((question: string, idx: number) => (
                      <li key={idx} className="text-charcoal-soft text-sm flex items-start gap-2">
                        <span className="text-coral-burst">•</span>
                        {question}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {typeof safeGet(currentPage.teacherNotes, 'pacing') === 'string' && safeGet(currentPage.teacherNotes, 'pacing') ? (
                <div className="flex items-center gap-2 text-cocoa-light text-sm font-medium bg-white px-4 py-2 rounded-xl w-fit border border-peach-soft/30">
                  <span>⏱️</span>
                  Estimated Time: {String(safeGet(currentPage.teacherNotes, 'pacing'))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Render resources mode
  const renderResourcesMode = (): React.ReactNode => {
    const lessonPlanOutline = safeGet(ebook.teacherResources, 'lessonPlanOutline') as Record<string, string> | null;
    const standardsCorrelation = safeGet(ebook.teacherResources, 'standardsCorrelation') as AnyRecord | null;
    const primaryStandards = safeGet(ebook.teacherResources, 'standardsCorrelation', 'primaryStandards') as string[] | null;
    const hasLessonPlanOutline = lessonPlanOutline !== null && Object.keys(lessonPlanOutline).length > 0;
    const hasStandardsCorrelation = standardsCorrelation !== null && Object.keys(standardsCorrelation).length > 0;
    const hasDifferentiation = Boolean(ebook.teacherResources?.differentiationGuide || safeGet(ebook.teacherResources, 'differentiationStrategies'));
    const hasFamilyEngagement = Boolean(ebook.familyEngagement);

    return (
      <div className="p-4 md:p-6 space-y-6">
        {hasLessonPlanOutline ? (
          <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100 shadow-sm">
            <h4 className="text-blue-600 font-heading font-bold mb-4 flex items-center gap-2">
              <span>📋</span> Lesson Plan Outline
            </h4>
            <div className="space-y-3">
              {Object.entries(lessonPlanOutline!).map(([phase, description]) => (
                <div key={phase} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-blue-100">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <div>
                    <span className="text-charcoal-soft font-bold capitalize block mb-1">{phase.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <p className="text-cocoa-light text-sm">{typeof description === 'string' ? description : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {hasStandardsCorrelation ? (
          <div className="bg-purple-50 rounded-3xl p-6 border border-purple-100 shadow-sm">
            <h4 className="text-purple-600 font-heading font-bold mb-4 flex items-center gap-2">
              <span>📊</span> Standards Correlation
            </h4>
            <div className="grid gap-4">
              {primaryStandards && primaryStandards.length > 0 ? (
                <div>
                  <p className="text-sm font-bold text-cocoa-light uppercase mb-2">Primary Standards:</p>
                  <div className="flex flex-wrap gap-2">
                    {primaryStandards.map((std: string, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold font-mono border border-purple-200">
                        {std}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {isNonEmptyArray(safeGet(ebook.teacherResources, 'standardsCorrelation', 'supportingStandards')) ? (
                <div>
                  <p className="text-sm font-bold text-cocoa-light uppercase mb-2">Supporting Standards:</p>
                  <div className="flex flex-wrap gap-2">
                    {(safeGet(ebook.teacherResources, 'standardsCorrelation', 'supportingStandards') as string[]).map((std: string, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-white text-cocoa-light rounded-lg text-xs font-bold font-mono border border-peach-soft/30">
                        {std}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {hasDifferentiation ? (
          <div className="bg-green-50 rounded-3xl p-6 border border-green-100 shadow-sm">
            <h4 className="text-green-600 font-heading font-bold mb-4 flex items-center gap-2">
              <span>🎯</span> Differentiation Strategies
            </h4>
            <div className="grid gap-4">
              {isNonEmptyArray(safeGet(ebook.teacherResources, 'differentiationStrategies', 'elSupports') ||
                safeGet(ebook.teacherResources, 'differentiationGuide', 'universalDesign')) ? (
                <div className="bg-white rounded-xl p-4 border border-green-100">
                  <p className="text-sm font-bold text-blue-500 uppercase mb-2">🌐 English Learner Supports:</p>
                  <ul className="space-y-1">
                    {((safeGet(ebook.teacherResources, 'differentiationStrategies', 'elSupports') ||
                      safeGet(ebook.teacherResources, 'differentiationGuide', 'universalDesign')) as string[]).map((support: string, idx: number) => (
                        <li key={idx} className="text-charcoal-soft text-sm flex items-start gap-2">
                          <span className="text-green-500">•</span>
                          {support}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
              {isNonEmptyArray(safeGet(ebook.teacherResources, 'differentiationStrategies', 'giftedEnrichment') ||
                safeGet(ebook.teacherResources, 'extensions')) ? (
                <div className="bg-white rounded-xl p-4 border border-green-100">
                  <p className="text-sm font-bold text-amber-500 uppercase mb-2">⭐ Gifted/Advanced:</p>
                  <ul className="space-y-1">
                    {((safeGet(ebook.teacherResources, 'differentiationStrategies', 'giftedEnrichment') ||
                      safeGet(ebook.teacherResources, 'extensions') || []) as Array<string | AnyRecord>).slice(0, 5).map((enrichment, idx: number) => (
                        <li key={idx} className="text-charcoal-soft text-sm flex items-start gap-2">
                          <span className="text-amber-500">•</span>
                          {typeof enrichment === 'string' ? enrichment : String((enrichment as AnyRecord).title || '')}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {hasFamilyEngagement ? (
          <div className="bg-pink-50 rounded-3xl p-6 border border-pink-100 shadow-sm">
            <h4 className="text-pink-600 font-heading font-bold mb-4 flex items-center gap-2">
              <span>👨‍👩‍👧</span> Family Engagement
            </h4>

            {(ebook.familyEngagement?.parentLetter || ebook.familyEngagement?.welcomeLetter) ? (
              <div className="mb-4 bg-white rounded-xl p-4 border border-pink-100">
                <p className="text-charcoal-soft text-sm mb-4 leading-relaxed italic">
                  "{typeof ebook.familyEngagement?.parentLetter === 'string'
                    ? ebook.familyEngagement.parentLetter
                    : ebook.familyEngagement?.welcomeLetter || ''}"
                </p>

                {isNonEmptyArray(ebook.familyEngagement?.discussionQuestions) ? (
                  <div className="mt-3">
                    <p className="text-sm font-bold text-cocoa-light uppercase mb-2">Discussion Questions:</p>
                    <ul className="space-y-2">
                      {(ebook.familyEngagement!.discussionQuestions as string[]).map((q: string, idx: number) => (
                        <li key={idx} className="text-charcoal-soft text-sm flex items-start gap-2">
                          <span className="text-pink-400">•</span>
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isNonEmptyArray(ebook.familyEngagement?.extendedLearning || ebook.familyEngagement?.familyActivities) ? (
              <div>
                <p className="text-sm font-bold text-cocoa-light uppercase mb-2">Home Activities:</p>
                <div className="space-y-2">
                  {((ebook.familyEngagement?.extendedLearning || ebook.familyEngagement?.familyActivities || []) as AnyRecord[]).map((activity: AnyRecord, idx: number) => (
                    <div key={idx} className="bg-white rounded-xl p-4 border border-pink-100 shadow-sm">
                      <p className="text-charcoal-soft text-sm font-bold mb-1">{String(activity.title || activity.activity || activity.description || '')}</p>
                      {isNonEmptyArray(activity.materials) ? (
                        <p className="text-cocoa-light text-xs mt-1">
                          <span className="font-bold">Materials:</span> {(activity.materials as string[]).join(', ')}
                        </p>
                      ) : null}
                      {(activity.duration || activity.timeRequired) ? (
                        <p className="text-cocoa-light text-xs mt-1 flex items-center gap-1">
                          <span>⏱️</span> {String(activity.duration || activity.timeRequired || '')}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  // Assessment mode
  if (viewMode === 'assessment') {
    return (
      <div className="min-h-screen bg-cream-base font-body text-charcoal-soft">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-peach-soft/50 p-4 shadow-sm">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setViewMode('story')}
              className="flex items-center gap-2 text-coral-burst hover:text-coral-dark transition-colors font-heading font-bold"
            >
              ← Back to Lesson
            </button>
            <h2 className="text-charcoal-soft font-heading font-bold text-lg">{ebook.metadata.title} - Assessment</h2>
            {onClose && (
              <button onClick={onClose} className="text-cocoa-light hover:text-coral-burst transition-colors">
                ✕
              </button>
            )}
          </div>
        </div>
        <CurriculumAssessment ebook={ebook} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-base font-body text-charcoal-soft">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-peach-soft/50 shadow-sm">
        <div className="max-w-4xl mx-auto">
          {/* Title Bar */}
          <div className="flex items-center justify-between p-4">
            <div>
              <h1 className="text-xl md:text-2xl font-heading font-bold text-charcoal-soft">{ebook.metadata.title}</h1>
              <div className="flex items-center gap-2 text-sm text-cocoa-light font-medium">
                <span className="bg-peach-soft/30 px-2 py-0.5 rounded-full text-cocoa-dark">Grade {ebook.metadata.gradeLevel}</span>
                <span>•</span>
                <span>{ebook.metadata.subject}</span>
                <span>•</span>
                <span>{ebook.metadata.estimatedDuration}</span>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-cream-soft transition-colors text-cocoa-light hover:text-coral-burst"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* View Mode Tabs */}
          <div className="flex px-4 pb-0">
            <div className="flex bg-cream-soft p-1 rounded-t-2xl border-t border-x border-peach-soft/50 gap-1 w-full md:w-auto">
              {[
                { id: 'story', label: '📖 Story', show: true },
                { id: 'instruction', label: '🎓 Instruction', show: userRole === 'teacher' },
                { id: 'assessment', label: '📝 Assessment', show: isNonEmptyArray(ebook.assessmentBank) || ebook.assessmentSuite },
                { id: 'resources', label: '📚 Resources', show: userRole === 'teacher' || userRole === 'parent' }
              ].filter(tab => tab.show).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id as ViewMode)}
                  className={`flex-1 md:flex-none px-4 py-2.5 text-sm font-heading font-bold rounded-xl transition-all ${viewMode === tab.id
                      ? 'bg-white text-coral-burst shadow-sm'
                      : 'text-cocoa-light hover:text-charcoal-soft hover:bg-white/50'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Differentiation Selector */}
          {(viewMode === 'story' || viewMode === 'instruction') && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white border-b border-peach-soft/30 gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs font-bold text-cocoa-light uppercase whitespace-nowrap">Level:</span>
                <div className="flex bg-cream-soft p-1 rounded-lg w-full sm:w-auto">
                  {(['approaching', 'onLevel', 'advanced'] as DifferentiationTier[]).map(tier => (
                    <button
                      key={tier}
                      onClick={() => setDifferentiationTier(tier)}
                      className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all ${differentiationTier === tier
                          ? 'bg-white text-coral-burst shadow-sm'
                          : 'text-cocoa-light hover:text-charcoal-soft'
                        }`}
                    >
                      {tier === 'approaching' && '📉 Approaching'}
                      {tier === 'onLevel' && '📊 On Level'}
                      {tier === 'advanced' && '📈 Advanced'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                <label className="flex items-center gap-2 text-sm text-cocoa-dark font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showSEL}
                    onChange={e => setShowSEL(e.target.checked)}
                    className="w-4 h-4 accent-coral-burst rounded"
                  />
                  Show SEL
                </label>
                {userRole === 'teacher' && (
                  <label className="flex items-center gap-2 text-sm text-cocoa-dark font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showTeacherNotes}
                      onChange={e => setShowTeacherNotes(e.target.checked)}
                      className="w-4 h-4 accent-coral-burst rounded"
                    />
                    Teacher Notes
                  </label>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto pb-24">
        {viewMode === 'story' && renderStoryMode()}
        {viewMode === 'instruction' && renderInstructionMode()}
        {viewMode === 'resources' && renderResourcesMode()}
      </div>

      {/* Page Navigation */}
      {(viewMode === 'story' || viewMode === 'instruction') && pages.length > 1 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-peach-soft/50 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => goToPage(currentPageIndex - 1)}
                disabled={currentPageIndex === 0}
                className="px-4 py-2 text-coral-burst font-heading font-bold hover:text-coral-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                ← Previous
              </button>
              <span className="text-cocoa-light text-sm font-medium bg-cream-soft px-3 py-1 rounded-full">
                Page {currentPageIndex + 1} of {pages.length}
              </span>
              <button
                onClick={() => goToPage(currentPageIndex + 1)}
                disabled={currentPageIndex === pages.length - 1}
                className="px-4 py-2 text-coral-burst font-heading font-bold hover:text-coral-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                Next →
              </button>
            </div>

            {/* Page Dots */}
            <div className="flex justify-center gap-2 flex-wrap">
              {pages.map((page, idx) => (
                <button
                  key={idx}
                  onClick={() => goToPage(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${idx === currentPageIndex
                      ? 'bg-coral-burst scale-125'
                      : 'bg-peach-soft hover:bg-coral-light'
                    }`}
                  title={page.title || `Page ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CurriculumViewer;
