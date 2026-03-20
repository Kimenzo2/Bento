/**
 * CurriculumBuilder Component
 *
 * A comprehensive UI for educators to configure and generate
 * curriculum-aligned educational ebooks using the Genesis system.
 */

import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  type CASEL_SEL_COMPETENCIES,
  generateCurriculumEbook,
  getSELCompetencies,
  getStandardsForGrade,
} from '../services/curriculumService';
import type {
  CommonCoreStandard,
  CurriculumEbook,
  CurriculumGenerationRequest,
  GradeBand,
  LearningStyle,
  NGSSStandard,
  StandardsFramework,
  StudentProfile,
} from '../types/curriculum';
import { Button } from './ui/button';
import { Input, Label, Textarea } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface CurriculumBuilderProps {
  onEbookGenerated: (ebook: CurriculumEbook) => void;
  onClose: () => void;
  userTier?: string;
}

// Subject options by framework
const SUBJECTS_BY_FRAMEWORK: Record<StandardsFramework, string[]> = {
  CCSS: ['English Language Arts', 'Mathematics'],
  NGSS: ['Life Science', 'Physical Science', 'Earth & Space Science', 'Engineering'],
  SEL: ['Social-Emotional Learning'],
  State: ['Custom/State Standards'],
  CASEL: ['Social-Emotional Learning'],
  'State-Specific': ['Custom/State Standards'],
};

// Pedagogical approaches
const PEDAGOGICAL_APPROACHES = [
  {
    value: 'explicit',
    label: 'Explicit Instruction',
    description: 'Direct teaching with modeling and guided practice',
  },
  {
    value: 'inquiry',
    label: 'Inquiry-Based Learning',
    description: 'Student-driven exploration and discovery',
  },
  {
    value: 'project',
    label: 'Project-Based Learning',
    description: 'Learning through authentic projects',
  },
  {
    value: 'workshop',
    label: 'Workshop Model',
    description: 'Mini-lesson, work time, share structure',
  },
  {
    value: 'flipped',
    label: 'Flipped Classroom',
    description: 'Content at home, practice in class',
  },
];

export const CurriculumBuilder: React.FC<CurriculumBuilderProps> = ({
  onEbookGenerated,
  onClose,
  userTier: _userTier,
}) => {
  // Core configuration state
  const [framework, setFramework] = useState<StandardsFramework>('CCSS');
  const [subject, setSubject] = useState<string>('English Language Arts');
  const [gradeLevel, setGradeLevel] = useState<number>(3);
  const [topic, setTopic] = useState<string>('');
  const [pedagogicalApproach, setPedagogicalApproach] = useState<string>('explicit');
  const [pageCount, setPageCount] = useState<number>(10);

  // Standards selection
  const [availableStandards, setAvailableStandards] = useState<
    (CommonCoreStandard | NGSSStandard)[]
  >([]);
  const [selectedStandards, setSelectedStandards] = useState<string[]>([]);
  const [customStandard, setCustomStandard] = useState<string>('');

  // Student profile
  const [showStudentProfile, setShowStudentProfile] = useState<boolean>(false);
  const [readingLevel, setReadingLevel] = useState<'below' | 'at' | 'above'>('at');
  const [learningStyles, setLearningStyles] = useState<LearningStyle[]>(['visual']);
  const [interests, setInterests] = useState<string>('');
  const [hasIEP, setHasIEP] = useState<boolean>(false);
  const [has504, setHas504] = useState<boolean>(false);
  const [accommodations, setAccommodations] = useState<string>('');
  const [isEL, setIsEL] = useState<boolean>(false);
  const [elLevel, setElLevel] = useState<number>(3);

  // SEL Focus
  const [includeSEL, setIncludeSEL] = useState<boolean>(true);
  const [selCompetency, setSelCompetency] = useState<string>('selfAwareness');

  // Options
  const [includeAssessments, setIncludeAssessments] = useState<boolean>(true);
  const [includeFamilyEngagement, setIncludeFamilyEngagement] = useState<boolean>(true);
  const [language, setLanguage] = useState<string>('en');

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationStage, setGenerationStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'basics' | 'standards' | 'students' | 'options'>(
    'basics'
  );

  // Update available standards when framework/grade/subject changes
  useEffect(() => {
    const standards = getStandardsForGrade(framework, gradeLevel, subject);
    setAvailableStandards(standards);
    setSelectedStandards([]);
  }, [framework, gradeLevel, subject]);

  // Update subject options when framework changes
  useEffect(() => {
    const subjects = SUBJECTS_BY_FRAMEWORK[framework];
    if (subjects && !subjects.includes(subject)) {
      setSubject(subjects[0]);
    }
  }, [framework, subject]);

  // Get grade band from level
  const gradeBand = useMemo((): GradeBand => {
    if (gradeLevel <= 2) return 'K-2';
    if (gradeLevel <= 5) return '3-5';
    if (gradeLevel <= 8) return '6-8';
    return '9-12';
  }, [gradeLevel]);

  // SEL competencies
  const selCompetencies = getSELCompetencies();

  // Toggle standard selection
  const toggleStandard = (code: string) => {
    setSelectedStandards((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  // Toggle learning style
  const toggleLearningStyle = (style: LearningStyle) => {
    setLearningStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  // Add custom standard
  const addCustomStandard = () => {
    if (customStandard.trim()) {
      setSelectedStandards((prev) => [...prev, customStandard.trim()]);
      setCustomStandard('');
    }
  };

  // Generate curriculum ebook
  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic for the curriculum');
      return;
    }

    if (selectedStandards.length === 0) {
      setError('Please select at least one standard');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGenerationProgress(0);

    try {
      // Build student profile if enabled
      const studentProfile: StudentProfile | undefined = showStudentProfile
        ? {
            targetGradeLevel: gradeLevel,
            readingLevel,
            learningStyles,
            interests: interests
              .split(',')
              .map((i) => i.trim())
              .filter(Boolean),
            specialNeeds:
              hasIEP || has504
                ? {
                    hasIEP,
                    has504,
                    accommodations: accommodations
                      .split(',')
                      .map((a) => a.trim())
                      .filter(Boolean),
                    modifications: [],
                  }
                : undefined,
            englishLearnerStatus: isEL
              ? {
                  isEL: true,
                  proficiencyLevel: elLevel,
                  homeLanguage: '',
                }
              : undefined,
          }
        : undefined;

      // Build SEL focus if enabled
      const selFocus = includeSEL
        ? {
            primaryCompetency: selCompetency as keyof typeof CASEL_SEL_COMPETENCIES,
            indicators:
              selCompetencies[selCompetency as keyof typeof selCompetencies]?.indicators || [],
          }
        : undefined;

      // Build request
      const request: CurriculumGenerationRequest = {
        subject,
        gradeLevel,
        standards: selectedStandards.map((code) => {
          const found = availableStandards.find((s) => s.code === code);
          return found
            ? { code: found.code, description: found.description }
            : { code, description: code };
        }),
        topic,
        studentProfile,
        pedagogicalApproach,
        pageCount,
        includeAssessments,
        includeFamilyEngagement,
        selFocus,
        language,
      };

      // Generate
      const ebook = await generateCurriculumEbook(request, (stage, progress) => {
        setGenerationStage(stage);
        setGenerationProgress(progress);
      });

      onEbookGenerated(ebook);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate curriculum');
      console.error('Curriculum generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-cream-base via-cream-soft to-peach-soft/20 pb-24 md:pb-8">
      <div className="w-full h-full">
        {/* Main Card */}
        <div className="overflow-hidden font-body min-h-screen relative">
          {/* Header */}
          <div className="relative z-10 border-b border-peach-soft/30">
            <div className="bg-surface/80">
              <div className="max-w-4xl mx-auto flex items-center justify-between p-4 md:p-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-heading font-bold text-charcoal-soft flex items-center gap-2 md:gap-3">
                    <span className="text-2xl md:text-3xl">📚</span>
                    Curriculum Builder
                  </h2>
                  <p className="text-cocoa-dark text-xs md:text-sm mt-1 font-medium">
                    Create standards-aligned educational content
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="bg-cream-base hover:bg-peach-soft/30 text-cocoa-light hover:text-coral-burst"
                >
                  <svg
                    className="w-5 h-5 md:w-6 md:h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="relative z-10">
            <div className=" bg-surface/50">
              <div className="max-w-4xl mx-auto flex px-4 md:px-6 pt-3 md:pt-4">
                <div className="flex bg-surface/60  p-1 rounded-t-2xl border-t border-x border-white/50 gap-0.5 md:gap-1 w-full overflow-x-auto">
                  {[
                    { id: 'basics', label: 'Basics', icon: '📝' },
                    { id: 'standards', label: 'Standards', icon: '📋' },
                    { id: 'students', label: 'Students', icon: '👨‍🎓' },
                    { id: 'options', label: 'Options', icon: '⚙️' },
                  ].map((tab) => (
                    <Button
                      key={tab.id}
                      variant="ghost"
                      onClick={() => setActiveTab(tab.id as 'basics' | 'standards' | 'students' | 'options')}
                      className={`flex-1 min-w-0 px-2 md:px-4 py-2.5 md:py-3 text-xs md:text-sm whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'bg-surface text-coral-burst'
                          : 'text-cocoa-dark hover:text-charcoal-soft hover:bg-surface/70'
                      }`}
                    >
                      <span className="mr-1 md:mr-2">{tab.icon}</span>
                      <span className="hidden sm:inline">{tab.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Content - Glassmorphism Card */}
          <div className="relative z-10 pt-2">
            <div className="max-w-4xl mx-auto px-4 md:px-6 pb-6">
              <div className=" bg-surface/80 rounded-2xl border border-white/50 p-4 md:p-6">
                {/* Basics Tab */}
                {activeTab === 'basics' && (
                  <div className="space-y-5 md:space-y-6">
                    {/* Framework Selection - Compact Icons */}
                    <div>
                      <Label className="text-cocoa-dark mb-3 uppercase tracking-wide">
                        Standards Framework
                      </Label>
                      <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                        {(['CCSS', 'NGSS', 'SEL', 'State'] as StandardsFramework[]).map((fw) => (
                          <Button
                            key={fw}
                            variant="outline"
                            onClick={() => setFramework(fw)}
                            className={`flex flex-col items-center p-3 w-20 h-20 rounded-2xl border ${
                              framework === fw
                                ? 'border-coral-burst bg-linear-to-br from-coral-light/30 to-coral-burst/10 text-coral-burst scale-105'
                                : 'border-peach-soft/50 bg-surface/80 text-cocoa-light hover:border-coral-light hover:text-charcoal-soft'
                            }`}
                          >
                            <div className="text-2xl mb-1">
                              {fw === 'CCSS' && '📖'}
                              {fw === 'NGSS' && '🔬'}
                              {fw === 'SEL' && '💜'}
                              {fw === 'State' && '🏛️'}
                            </div>
                            <div className="text-xs font-bold">{fw}</div>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Subject */}
                    <div>
                      <Label className="text-cocoa-dark mb-2 uppercase tracking-wide">
                        Subject Area
                      </Label>
                      <Select value={subject} onValueChange={setSubject}>
                        <SelectTrigger className="w-full max-w-md">
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUBJECTS_BY_FRAMEWORK[framework].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Grade Level */}
                    <div>
                      <Label className="text-cocoa-dark mb-2 uppercase tracking-wide">
                        Grade Level: {gradeLevel === 0 ? 'Kindergarten' : `Grade ${gradeLevel}`}
                        <span className="text-coral-burst ml-2">({gradeBand})</span>
                      </Label>
                      <div className="max-w-md">
                        <input
                          type="range"
                          min="0"
                          max="12"
                          value={gradeLevel}
                          onChange={(e) => setGradeLevel(Number.parseInt(e.target.value))}
                          className="w-full accent-coral-burst"
                          aria-label="Grade level"
                        />
                        <div className="flex justify-between text-xs text-cocoa-light mt-1 font-medium">
                          <span>K</span>
                          <span>3</span>
                          <span>6</span>
                          <span>9</span>
                          <span>12</span>
                        </div>
                      </div>
                    </div>

                    {/* Topic */}
                    <div>
                      <Label className="text-cocoa-dark mb-2 uppercase tracking-wide">
                        Topic / Learning Focus
                      </Label>
                      <Textarea
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g., Understanding fractions through a pizza party adventure..."
                        className="max-w-xl bg-surface/80 border-peach-soft/50 focus:ring-1 focus:ring-coral-burst transition-colors"
                        rows={3}
                      />
                    </div>

                    {/* Pedagogical Approach - Compact Cards */}
                    <div>
                      <Label className="text-cocoa-dark mb-3 uppercase tracking-wide">
                        Pedagogical Approach
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {PEDAGOGICAL_APPROACHES.map((approach) => (
                          <Button
                            key={approach.value}
                            variant="outline"
                            onClick={() => setPedagogicalApproach(approach.value)}
                            className={`px-4 py-2.5 border text-left ${
                              pedagogicalApproach === approach.value
                                ? 'border-coral-burst bg-linear-to-br from-coral-light/30 to-coral-burst/10 scale-[1.02]'
                                : 'border-peach-soft/50 bg-surface/80 hover:border-coral-light'
                            }`}
                          >
                            <div
                              className={`font-bold text-sm ${pedagogicalApproach === approach.value ? 'text-coral-burst' : 'text-charcoal-soft'}`}
                            >
                              {approach.label}
                            </div>
                            <div className="text-[10px] text-cocoa-light mt-0.5 max-w-[180px]">
                              {approach.description}
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Page Count */}
                    <div>
                      <Label className="text-cocoa-dark mb-2 uppercase tracking-wide">
                        Number of Pages: {pageCount}
                      </Label>
                      <div className="max-w-md">
                        <input
                          type="range"
                          min="5"
                          max="20"
                          value={pageCount}
                          onChange={(e) => setPageCount(Number.parseInt(e.target.value))}
                          className="w-full accent-coral-burst"
                          aria-label="Number of pages"
                        />
                        <div className="flex justify-between text-xs text-cocoa-light mt-1 font-medium">
                          <span>5 (Short)</span>
                          <span>10</span>
                          <span>15</span>
                          <span>20 (Long)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Standards Tab */}
                {activeTab === 'standards' && (
                  <div className="space-y-4 md:space-y-6">
                    <div className="bg-surface/60  rounded-xl p-3 md:p-4 border border-peach-soft/30">
                      <p className="text-cocoa-dark text-xs md:text-sm font-medium">
                        Select the standards your curriculum should address. The AI will align all
                        content and assessments to these standards.
                      </p>
                    </div>

                    {/* Selected Standards */}
                    {selectedStandards.length > 0 && (
                      <div>
                        <Label className="text-cocoa-dark mb-2 uppercase tracking-wide">
                          Selected Standards ({selectedStandards.length})
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {selectedStandards.map((code) => (
                            <span
                              key={code}
                              className="inline-flex items-center gap-2 bg-coral-light/20 text-coral-burst px-3 py-1 rounded-full text-sm font-bold border border-coral-light/30"
                            >
                              {code}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleStandard(code)}
                                className="hover:text-coral-dark p-0 h-auto"
                              >
                                ×
                              </Button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Available Standards */}
                    <div>
                      <Label className="text-cocoa-dark mb-2 uppercase tracking-wide">
                        Available Standards
                      </Label>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {availableStandards.map((standard) => (
                          <Button
                            key={standard.code}
                            variant="outline"
                            onClick={() => toggleStandard(standard.code)}
                            className={`w-full p-3 text-left border ${
                              selectedStandards.includes(standard.code)
                                ? 'bg-coral-light/10 border-coral-burst'
                                : 'bg-surface border-peach-soft/50 hover:border-coral-light hover:bg-cream-base'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                  selectedStandards.includes(standard.code)
                                    ? 'bg-coral-burst border-coral-burst'
                                    : 'border-cocoa-light'
                                }`}
                              >
                                {selectedStandards.includes(standard.code) && (
                                  <svg
                                    className="w-3 h-3 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={3}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <div
                                  className={`font-mono text-sm font-bold ${selectedStandards.includes(standard.code) ? 'text-coral-burst' : 'text-charcoal-soft'}`}
                                >
                                  {standard.code}
                                </div>
                                <div className="text-cocoa-light text-sm">
                                  {standard.description}
                                </div>
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Standard Input */}
                    <div>
                      <Label className="text-cocoa-dark mb-2 uppercase tracking-wide">
                        Add Custom Standard
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={customStandard}
                          onChange={(e) => setCustomStandard(e.target.value)}
                          placeholder="Enter standard code (e.g., CCSS.ELA-LITERACY.RL.4.2)"
                          className="flex-1 bg-cream-base py-2"
                          onKeyDown={(e) => e.key === 'Enter' && addCustomStandard()}
                        />
                        <Button
                          variant="primary"
                          onClick={addCustomStandard}
                          className="px-4 py-2"
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Students Tab */}
                {activeTab === 'students' && (
                  <div className="space-y-4 md:space-y-6">
                    {/* Enable Student Profile */}
                    <div className="flex items-center justify-between p-3 md:p-4 bg-cream-soft rounded-xl border border-peach-soft/30">
                      <div>
                        <div className="font-bold text-charcoal-soft text-sm md:text-base">
                          Customize for Student Needs
                        </div>
                        <div className="text-xs md:text-sm text-cocoa-light">
                          Personalize content for specific learner profiles
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => setShowStudentProfile(!showStudentProfile)}
                        className={`w-12 h-6 rounded-full p-0 ${
                          showStudentProfile ? 'bg-coral-burst' : 'bg-cocoa-light/30'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-surface transform transition-transform ${
                            showStudentProfile ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </Button>
                    </div>

                    {showStudentProfile && (
                      <>
                        {/* Reading Level */}
                        <div>
                          <Label className="text-cocoa-dark mb-2 uppercase tracking-wide">
                            Reading Level
                          </Label>
                          <div className="grid grid-cols-3 gap-3">
                            {(['below', 'at', 'above'] as const).map((level) => (
                              <Button
                                key={level}
                                variant="outline"
                                onClick={() => setReadingLevel(level)}
                                className={`p-3 border ${
                                  readingLevel === level
                                    ? 'border-coral-burst bg-coral-light/20 text-coral-burst'
                                    : 'border-peach-soft/50 bg-cream-base text-cocoa-light hover:border-coral-light hover:text-charcoal-soft'
                                }`}
                              >
                                <div className="font-bold text-sm">
                                  {level === 'below' && '📉 Below Grade'}
                                  {level === 'at' && '📊 At Grade'}
                                  {level === 'above' && '📈 Above Grade'}
                                </div>
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Learning Styles */}
                        <div>
                          <Label className="text-cocoa-dark mb-2 uppercase tracking-wide">
                            Learning Styles (Select all that apply)
                          </Label>
                          <div className="grid grid-cols-2 gap-3">
                            {(
                              [
                                {
                                  value: 'visual',
                                  label: '👁️ Visual',
                                  desc: 'Learns through images and diagrams',
                                },
                                {
                                  value: 'auditory',
                                  label: '👂 Auditory',
                                  desc: 'Learns through listening',
                                },
                                {
                                  value: 'kinesthetic',
                                  label: '✋ Kinesthetic',
                                  desc: 'Learns through hands-on activities',
                                },
                                {
                                  value: 'read-write',
                                  label: '📝 Read/Write',
                                  desc: 'Learns through reading and writing',
                                },
                              ] as { value: LearningStyle; label: string; desc: string }[]
                            ).map((style) => (
                              <Button
                                key={style.value}
                                variant="outline"
                                onClick={() => toggleLearningStyle(style.value)}
                                className={`p-3 border text-left ${
                                  learningStyles.includes(style.value)
                                    ? 'border-coral-burst bg-coral-light/20'
                                    : 'border-peach-soft/50 bg-cream-base hover:border-coral-light'
                                }`}
                              >
                                <div
                                  className={`font-bold text-sm ${learningStyles.includes(style.value) ? 'text-coral-burst' : 'text-charcoal-soft'}`}
                                >
                                  {style.label}
                                </div>
                                <div className="text-xs text-cocoa-light mt-1">{style.desc}</div>
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Student Interests */}
                        <div>
                          <Label className="text-cocoa-dark mb-2 uppercase tracking-wide">
                            Student Interests (comma-separated)
                          </Label>
                          <Input
                            type="text"
                            value={interests}
                            onChange={(e) => setInterests(e.target.value)}
                            placeholder="e.g., sports, animals, video games, music"
                            className="bg-cream-base py-3"
                          />
                        </div>

                        {/* Special Education */}
                        <div className="p-4 bg-cream-soft rounded-xl space-y-4 border border-peach-soft/30">
                          <div className="font-bold text-charcoal-soft">
                            Special Education Supports
                          </div>

                          <div className="flex flex-wrap gap-4">
                            <Label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={hasIEP}
                                onChange={(e) => setHasIEP(e.target.checked)}
                                className="w-4 h-4 accent-coral-burst rounded"
                                aria-label="Has IEP"
                              />
                              Has IEP
                            </Label>
                            <Label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={has504}
                                onChange={(e) => setHas504(e.target.checked)}
                                className="w-4 h-4 accent-coral-burst rounded"
                                aria-label="Has 504 Plan"
                              />
                              Has 504 Plan
                            </Label>
                          </div>

                          {(hasIEP || has504) && (
                            <div>
                              <Label className="text-cocoa-dark mb-1">
                                Accommodations Needed (comma-separated)
                              </Label>
                              <Input
                                type="text"
                                value={accommodations}
                                onChange={(e) => setAccommodations(e.target.value)}
                                placeholder="e.g., extended time, text-to-speech, simplified language"
                                className="px-3 py-2"
                              />
                            </div>
                          )}
                        </div>

                        {/* English Learner */}
                        <div className="p-4 bg-cream-soft rounded-xl space-y-4 border border-peach-soft/30">
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-charcoal-soft">English Learner (EL)</div>
                            <Button
                              variant="ghost"
                              onClick={() => setIsEL(!isEL)}
                              className={`w-12 h-6 rounded-full p-0 ${
                                isEL ? 'bg-coral-burst' : 'bg-cocoa-light/30'
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded-full bg-surface transform transition-transform ${
                                  isEL ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </Button>
                          </div>

                          {isEL && (
                            <div>
                              <Label className="text-cocoa-dark mb-2">
                                English Proficiency Level: {elLevel}
                              </Label>
                              <input
                                type="range"
                                min="1"
                                max="5"
                                value={elLevel}
                                onChange={(e) => setElLevel(Number.parseInt(e.target.value))}
                                className="w-full accent-coral-burst"
                                aria-label="English proficiency level"
                              />
                              <div className="flex justify-between text-xs text-cocoa-light mt-1 font-medium">
                                <span>1 - Entering</span>
                                <span>3 - Developing</span>
                                <span>5 - Bridging</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Options Tab */}
                {activeTab === 'options' && (
                  <div className="space-y-4 md:space-y-6">
                    {/* SEL Integration */}
                    <div className="p-3 md:p-4 bg-cream-soft rounded-xl space-y-4 border border-peach-soft/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-charcoal-soft text-sm md:text-base">
                            💜 Social-Emotional Learning
                          </div>
                          <div className="text-xs md:text-sm text-cocoa-light">
                            Integrate SEL competencies into the narrative
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => setIncludeSEL(!includeSEL)}
                          className={`w-12 h-6 rounded-full p-0 shrink-0 ${
                            includeSEL ? 'bg-coral-burst' : 'bg-cocoa-light/30'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-surface transform transition-transform ${
                              includeSEL ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </Button>
                      </div>

                      {includeSEL && (
                        <div>
                          <Label className="text-cocoa-dark mb-2">
                            Primary Competency
                          </Label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {Object.entries(selCompetencies).map(([key, competency]) => (
                              <Button
                                key={key}
                                variant="outline"
                                onClick={() => setSelCompetency(key)}
                                className={`p-3 text-left border ${
                                  selCompetency === key
                                    ? 'bg-surface border-coral-burst'
                                    : 'bg-cream-base border-peach-soft/50 hover:border-coral-light'
                                }`}
                              >
                                <div
                                  className={`font-bold text-sm ${selCompetency === key ? 'text-coral-burst' : 'text-charcoal-soft'}`}
                                >
                                  {competency.name}
                                </div>
                                <div className="text-xs text-cocoa-light mt-1 line-clamp-2">
                                  {competency.description}
                                </div>
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Assessments */}
                    <div className="flex items-center justify-between p-4 bg-cream-soft rounded-xl border border-peach-soft/30">
                      <div>
                        <div className="font-bold text-charcoal-soft">📝 Include Assessments</div>
                        <div className="text-sm text-cocoa-light">
                          Generate formative & summative assessments
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => setIncludeAssessments(!includeAssessments)}
                        className={`w-12 h-6 rounded-full p-0 ${
                          includeAssessments ? 'bg-coral-burst' : 'bg-cocoa-light/30'
                        }`}
                      >
                        <div
                            className={`w-5 h-5 rounded-full bg-surface transform transition-transform ${
                            includeAssessments ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </Button>
                    </div>

                    {/* Family Engagement */}
                    <div className="flex items-center justify-between p-4 bg-cream-soft rounded-xl border border-peach-soft/30">
                      <div>
                        <div className="font-bold text-charcoal-soft">👨‍👩‍👧 Family Engagement</div>
                        <div className="text-sm text-cocoa-light">
                          Include parent letters & home activities
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => setIncludeFamilyEngagement(!includeFamilyEngagement)}
                        className={`w-12 h-6 rounded-full p-0 ${
                          includeFamilyEngagement ? 'bg-coral-burst' : 'bg-cocoa-light/30'
                        }`}
                      >
                        <div
                            className={`w-5 h-5 rounded-full bg-surface transform transition-transform ${
                            includeFamilyEngagement ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </Button>
                    </div>

                    {/* Language */}
                    <div>
                      <Label className="text-cocoa-dark mb-2 uppercase tracking-wide">
                        Content Language
                      </Label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger className="w-full max-w-md">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="zh">Chinese (Simplified)</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer / Generate Button - Glassmorphism */}
          <div className="relative z-10 mt-4">
            <div className="max-w-4xl mx-auto px-4 md:px-6 pb-6">
              <div className=" bg-linear-to-r from-gold-sunshine/90 to-coral-burst/90 rounded-2xl border border-white/30 p-4">
                {/* Error Display */}
                {error && (
                  <div className="mb-4 p-3 md:p-4 bg-red-50/90  border border-red-200 rounded-xl text-red-600 text-xs md:text-sm font-medium">
                    {error}
                  </div>
                )}

                {/* Generation Progress */}
                {isGenerating && (
                  <div className="mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="animate-spin w-5 h-5 border border-white border-t-transparent rounded-full" />
                      <span className="text-white text-xs md:text-sm font-bold">
                        {generationStage}
                      </span>
                    </div>
                    <div className="h-2 bg-surface/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-surface transition-all duration-500"
                        style={{ width: `${generationProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={`w-full py-3 md:py-4 font-heading text-base md:text-lg
                  ${
                    isGenerating
                      ? 'bg-surface/50 text-cocoa-light'
                      : 'bg-surface text-coral-burst hover:scale-[1.02] active:scale-100'
                  }`}
                >
                  {isGenerating ? 'Generating Curriculum...' : '✨ Generate Curriculum Ebook'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurriculumBuilder;
