import {
  ArrowLeft,
  BookOpen,
  Brush,
  Camera,
  Download,
  Flower2,
  Image as ImageIcon,
  Layers3,
  MapPin,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import type { ChangeEvent, DragEvent, ElementType } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { downloadPDF } from '../../services/generator/pdfService';
import { mastra } from '../../src/services/mastraClient';
import { usePageSEO } from '../../hooks/usePageSEO';
import { useLifeInColourHistory } from '../../hooks/useLifeInColourHistory';
import { useLifeInColourGeneration } from '../../hooks/useLifeInColourGeneration';
import {
  ArtStyle,
  BookTone,
  type BookProject,
  type ColoringOutlineMode,
  type GenerationSettings,
} from '../../types';
import {
  buildLifeInColourPrompt,
  COLORING_OUTLINE_MODES,
  getColoringOutlineModeConfig,
} from '../../services/generator/prompts/lifeInColourPrompts';
import { ColouringPageCanvas } from './ColouringPageCanvas';
import { SavedGenerationPanel } from './SavedGenerationPanel';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input, Label, Textarea } from '../ui/input';
import { Progress } from '../ui/progress';
import { Slider } from '../ui/slider';
import { toast } from '../ui/sonner';

type BookPreset = 'single' | 'family' | 'trip';

interface SelectedPhoto {
  name: string;
  sizeLabel: string;
  file: File;
}

const PRESETS: Record<
  BookPreset,
  {
    label: string;
    icon: ElementType;
    title: string;
    pageCount: number;
    tone: BookTone;
    audience: string;
    brief: string;
    helper: string;
  }
> = {
  single: {
    label: 'Single moment',
    icon: Camera,
    title: 'Life in Colour',
    pageCount: 6,
    tone: BookTone.CALM,
    audience: 'People preserving a single memory',
    brief:
      'Turn one treasured photo into a clean printable colouring page with strong outlines and generous open space.',
    helper: 'Best for one standout memory.',
  },
  family: {
    label: 'Family book',
    icon: Users,
    title: 'Family in Colour',
    pageCount: 12,
    tone: BookTone.PLAYFUL,
    audience: 'Families and shared home memories',
    brief:
      'Turn a camera-roll set into a shared family colouring book with matching line art and soft, friendly pacing.',
    helper: 'Best for siblings, grandparents, and shared moments.',
  },
  trip: {
    label: 'Trip album',
    icon: MapPin,
    title: 'Trip in Colour',
    pageCount: 18,
    tone: BookTone.ADVENTUROUS,
    audience: 'Families, travellers, and memory keepers',
    brief:
      'Turn a trip album into a colouring-book chapter that keeps the landmarks, motion, and feeling of the journey.',
    helper: 'Best for holidays, weekends away, and travel memories.',
  },
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const joinSignature = (parts: Array<string | number>) => parts.join('::');

function LoadingPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[28px] border border-peach-soft bg-surface/65 p-5">
      <div className="flex aspect-[4/5] items-center justify-center rounded-[24px] border border-peach-soft bg-white px-6 text-center">
        <div className="max-w-xs">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-burst/10 text-coral-burst">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="font-heading text-lg font-bold text-charcoal-soft">{message}</p>
          <p className="mt-2 text-sm leading-relaxed text-cocoa-light">
            Andrew is generating the primary page. The browser fallback stays warm in case the AI run stalls.
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorPanel({
  message,
  onReplacePhoto,
}: {
  message: string;
  onReplacePhoto: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-peach-soft bg-surface/65 p-5">
      <div className="flex aspect-[4/5] items-center justify-center rounded-[24px] border border-coral-burst/20 bg-white px-6 text-center">
        <div className="max-w-xs">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-burst/10 text-coral-burst">
            <ImageIcon className="h-6 w-6" />
          </div>
          <p className="font-heading text-lg font-bold text-charcoal-soft">Could not build the page</p>
          <p className="mt-2 text-sm leading-relaxed text-cocoa-light">{message}</p>
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={onReplacePhoto}>
              <Upload className="h-4 w-4" />
              Try another photo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const LifeInColourPageView = () => {
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [preset, setPreset] = useState<BookPreset>('family');
  const [title, setTitle] = useState(PRESETS.family.title);
  const [brief, setBrief] = useState(PRESETS.family.brief);
  const [pageCount, setPageCount] = useState(PRESETS.family.pageCount);
  const [outlineMode, setOutlineMode] = useState<ColoringOutlineMode>('detailed');
  const [bookFlowOpen, setBookFlowOpen] = useState(false);
  const [bookPhase, setBookPhase] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  const [bookProgress, setBookProgress] = useState(0);
  const [bookMessage, setBookMessage] = useState('');
  const [bookProject, setBookProject] = useState<BookProject | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSavedGenerationId, setSelectedSavedGenerationId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generationCancelRef = useRef<(() => void) | null>(null);
  const generatedBookSignatureRef = useRef<string | null>(null);
  const savedHistory = useLifeInColourHistory();

  usePageSEO({
    title: 'Life in Colour',
    description:
      'Upload a photo, generate an AI colouring page, and optionally expand it into a printable book.',
    canonical: '/life-in-colour',
  });

  useEffect(() => {
    return () => {
      generationCancelRef.current?.();
    };
  }, []);

  const currentPreset = PRESETS[preset];
  const currentOutlineMode = getColoringOutlineModeConfig(outlineMode);
  const pageGeneration = useLifeInColourGeneration({
    photo,
    title: title.trim() || currentPreset.title,
    brief: brief.trim() || currentPreset.brief,
    outlineMode,
  });
  const isPageReady = pageGeneration.phase === 'ready_ai' || pageGeneration.phase === 'fallback_local';
  const isBookWorking = bookPhase === 'generating';
  const selectedSavedGeneration =
    savedHistory.generations.find((generation: (typeof savedHistory.generations)[number]) => generation.id === selectedSavedGenerationId) ??
    null;
  const selectedSavedGenerationAnalysis = selectedSavedGeneration?.sourceAnalysisSummary;
  const selectedSavedGenerationCritique = selectedSavedGeneration?.critiqueSummary;

  const bookSignature = useMemo(
    () =>
      joinSignature([
        photo?.name ?? '',
        preset,
        outlineMode,
        title.trim() || currentPreset.title,
        brief.trim() || currentPreset.brief,
        pageCount,
      ]),
    [brief, currentPreset.brief, currentPreset.title, outlineMode, pageCount, photo?.name, preset, title]
  );

  const isBookResultStale = Boolean(bookProject) && generatedBookSignatureRef.current !== null
    ? generatedBookSignatureRef.current !== bookSignature
    : false;

  const handleChoosePhoto = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const clearDraft = useCallback(() => {
    generationCancelRef.current?.();
    generationCancelRef.current = null;
    generatedBookSignatureRef.current = null;
    setPhoto(null);
    setPreset('family');
    setTitle(PRESETS.family.title);
    setBrief(PRESETS.family.brief);
    setPageCount(PRESETS.family.pageCount);
    setOutlineMode('detailed');
    setBookFlowOpen(false);
    setBookPhase('idle');
    setBookProgress(0);
    setBookMessage('');
    setBookProject(null);
    setSelectedSavedGenerationId(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleFiles = useCallback(
    (fileList: FileList | File[] | null | undefined) => {
      const incomingFiles = Array.from(fileList ?? []).filter((file) => file.type.startsWith('image/'));

      if (incomingFiles.length === 0) {
        toast.error('Select image files only.', {
          description: 'Camera roll photos and uploaded images are supported.',
        });
        return;
      }

      if (incomingFiles.length > 1) {
        toast.info('Using the first photo only.', {
          description: 'Life in Colour starts from one image, then expands if you want a book.',
        });
      }

      const file = incomingFiles[0];
      if (!file) {
        return;
      }

      setPhoto({
        name: file.name,
        sizeLabel: formatFileSize(file.size),
        file,
      });
      setBookFlowOpen(false);
      setBookProject(null);
      setSelectedSavedGenerationId(null);
      setBookPhase('idle');
      setBookProgress(0);
      setBookMessage('');
      generatedBookSignatureRef.current = null;
    },
    []
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handleFiles(event.currentTarget.files);
      event.currentTarget.value = '';
    },
    [handleFiles]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles]
  );

  const applyPreset = useCallback((nextPreset: BookPreset) => {
    const config = PRESETS[nextPreset];
    setPreset(nextPreset);
    setTitle(config.title);
    setBrief(config.brief);
    setPageCount(config.pageCount);
    generationCancelRef.current?.();
    generationCancelRef.current = null;
    setBookPhase('idle');
    setBookProgress(0);
    setBookMessage('');
  }, []);

  const handleCancelGeneration = useCallback(() => {
    generationCancelRef.current?.();
    generationCancelRef.current = null;
    setBookPhase('idle');
    setBookProgress(0);
    setBookMessage('Generation cancelled.');
    toast.info('Generation cancelled', {
      description: 'The current run has been stopped.',
    });
  }, []);

  const handleGenerateBook = useCallback(async () => {
    if (!photo) {
      toast.error('Choose a photo first.', {
        description: 'The page canvas is built from one uploaded image.',
      });
      return;
    }

    if (!isPageReady) {
      toast.error('Wait for the page to finish processing.', {
        description: 'The colouring page has to be ready before the book flow can run.',
      });
      return;
    }

    const requestSignature = bookSignature;
    const prompt = buildLifeInColourPrompt({
      title: title.trim() || currentPreset.title,
      brief: brief.trim() || currentPreset.brief,
      photoCount: 1,
      outlineMode,
      audience: currentPreset.audience,
      presetLabel: currentPreset.label,
    });

    setBookProject(null);
    const bookPrompt = `${prompt}\n\nSource photo: ${photo.name}`;

    setBookPhase('generating');
    setBookProgress(8);
    setBookMessage('Building the book.');

    try {
      const settings: GenerationSettings = {
        prompt: bookPrompt,
        style: ArtStyle.BLUEPRINT,
        stylePrompt: `${currentOutlineMode.prompt} Use the uploaded photo as the visual source, preserve the memory of the scene, and keep the output clean enough to print and colour by hand.`,
        outlineMode,
        tone: currentPreset.tone,
        pageCount,
        audience: currentPreset.audience,
        isBranching: false,
      };

      generationCancelRef.current?.();
      setBookProgress(18);
      setBookMessage('Building the book.');

      const cancel = await mastra.workflows.startBookGeneration(
        settings,
        (event) => {
          if (event.phase) {
            setBookPhase('generating');
          }
          setBookProgress(Math.max(0, Math.min(100, event.percent)));
          setBookMessage(event.message || 'Composing the colouring book.');
        },
        (result) => {
          generationCancelRef.current = null;

          if (!result.success || !result.project) {
            setBookPhase('error');
            setBookMessage(result.message || result.error || 'Generation failed.');
            toast.error('Could not finish the book', {
              description: result.message || 'Please try again.',
            });
            return;
          }

          setBookProject(result.project);
          setBookPhase('ready');
          setBookProgress(100);
          setBookMessage(result.message || 'Colouring book ready.');
          generatedBookSignatureRef.current = requestSignature;
          toast.success('Colouring book ready', {
            description: 'Preview it here and export a PDF when you are ready.',
          });
        },
        (error) => {
          generationCancelRef.current = null;
          setBookPhase('error');
          setBookProgress(0);
          setBookMessage(error.message || 'Generation failed.');
          toast.error('Generation failed', { description: error.message });
        }
      );

      generationCancelRef.current = cancel;
    } catch (error) {
      generationCancelRef.current = null;
      setBookPhase('error');
      setBookProgress(0);
      const message = error instanceof Error ? error.message : 'Generation failed.';
      setBookMessage(message);
      toast.error('Generation failed', { description: message });
    }
  }, [
    bookSignature,
    currentOutlineMode.label,
    currentOutlineMode.prompt,
    currentOutlineMode.summary,
    currentPreset.audience,
    currentPreset.label,
    currentPreset.tone,
    currentPreset.title,
    isPageReady,
    outlineMode,
    pageCount,
    photo,
    brief,
    title,
  ]);

  const handleExportPdf = useCallback(async () => {
    if (!bookProject) {
      return;
    }

    if (isBookResultStale) {
      toast.error('Refresh the book first', {
        description: 'Generate again before exporting so the PDF matches the latest brief.',
      });
      return;
    }

    setIsExporting(true);
    try {
      await downloadPDF(bookProject, {
        includeImages: true,
        pageSize: 'A5',
        orientation: 'portrait',
        margins: {
          top: 16,
          right: 16,
          bottom: 16,
          left: 16,
        },
        fontSize: {
          title: 22,
          heading: 16,
          body: 11,
        },
        includeWatermark: false,
      });
      toast.success('PDF exported', {
        description: 'The colouring book was downloaded as a print-ready PDF.',
      });
    } catch (error) {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsExporting(false);
    }
  }, [bookProject, isBookResultStale]);

  const handleShareBook = useCallback(async () => {
    if (!bookProject) {
      return;
    }

    if (isBookResultStale) {
      toast.error('Refresh the book first', {
        description: 'Generate again before sharing so the summary matches the latest brief.',
      });
      return;
    }

    const shareText = `${bookProject.title}\n\n${bookProject.synopsis}`;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: bookProject.title,
          text: bookProject.synopsis,
        });
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        toast.success('Share text copied', {
          description: 'Paste it wherever you want to share the book.',
        });
        return;
      }

      throw new Error('Sharing is not available in this browser.');
    } catch (error) {
      toast.error('Share failed', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  }, [bookProject, isBookResultStale]);

  const uploadZone = (
    <button
      type="button"
      onClick={handleChoosePhoto}
      onDragEnter={() => undefined}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={handleDrop}
      className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-[28px] border border-peach-soft bg-cream-base/90 px-6 py-8 text-center outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-coral-burst/35 hover:bg-coral-burst/5 active:scale-[0.99]"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-linear-to-br from-sky-400 to-emerald-400 text-white shadow-sm">
        <Upload className="h-7 w-7" />
      </div>
      <p className="font-heading text-lg font-bold text-charcoal-soft">Drop one photo here</p>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-cocoa-light">
        Andrew turns one photo into a printable colouring page first. If the AI run fails, the browser fallback takes over automatically.
      </p>
    </button>
  );

  const savedGenerationPreview = selectedSavedGeneration ? (
    <div className="rounded-[28px] border border-peach-soft bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-cocoa-light">Saved page</div>
          <div className="mt-1 text-sm font-semibold text-charcoal-soft">{selectedSavedGeneration.title}</div>
        </div>
        <Badge variant="secondary">{selectedSavedGeneration.status}</Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="outline" className="text-[10px]">
          {selectedSavedGeneration.promptVersion || 'andrew-v2'}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {selectedSavedGeneration.analysisModel || 'gpt-5-nano'}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {selectedSavedGeneration.renderModel || selectedSavedGeneration.model || 'gpt-image-2'}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {selectedSavedGeneration.retryCount} repair{selectedSavedGeneration.retryCount === 1 ? '' : 's'}
        </Badge>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-peach-soft bg-cream-base">
        {selectedSavedGeneration.generatedPublicUrl ? (
          <img
            src={selectedSavedGeneration.generatedPublicUrl}
            alt={selectedSavedGeneration.title}
            className="aspect-[4/5] w-full object-contain bg-white"
          />
        ) : (
          <div className="flex aspect-[4/5] items-center justify-center px-6 text-center text-sm text-cocoa-light">
            This saved generation no longer has a public image URL.
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-peach-soft pt-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-cocoa-light">Source analysis</div>
            <p className="mt-1 text-sm leading-relaxed text-charcoal-soft">
              {selectedSavedGenerationAnalysis?.subjectSummary || selectedSavedGeneration.brief}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-cocoa-light">
              {selectedSavedGenerationAnalysis?.compositionSummary || 'Andrew preserved the source composition in simplified line art.'}
            </p>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-cocoa-light">Critique</div>
            <p className="mt-1 text-sm leading-relaxed text-charcoal-soft">
              {selectedSavedGenerationCritique?.summary || 'Andrew completed the page and stored the result.'}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-cocoa-light">
              {selectedSavedGenerationCritique?.retryRecommended
                ? 'A repair pass was recommended before the final result was saved.'
                : 'The final render did not require a repair pass.'}
            </p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-cocoa-light">
        {selectedSavedGeneration.brief}
      </p>
    </div>
  ) : null;

  return (
    <section className="w-full pb-24 animate-fadeIn">
      <div className="mx-auto max-w-6xl px-4 pt-6 md:px-6 md:pt-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/create')}
            className="rounded-full px-3.5 text-cocoa-light hover:text-coral-burst"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Create
          </Button>
          <Badge variant="primary" className="gap-2 px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Camera roll to colouring page
          </Badge>
        </div>

        <div className="mb-8 max-w-4xl md:mb-10">
          <h1 className="font-heading text-4xl font-bold tracking-tight text-charcoal-soft md:text-5xl">
            Life in Colour
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-cocoa-light md:text-lg">
            Upload one photo, trace it into a colouring page in your browser, and open the book flow only if you want
            to expand that page into a printable set.
          </p>
        </div>

        <div className={`grid gap-6 ${bookFlowOpen ? 'lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]' : 'lg:grid-cols-1'}`}>
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5 text-coral-burst" />
                    {photo ? 'Colouring page' : 'Photo source'}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {photo
                      ? pageGeneration.phase === 'fallback_local'
                        ? `Andrew fell back to a local page for ${photo.name}.`
                        : `Andrew is building ${photo.name} into a colouring page.`
                      : 'Camera roll or upload. The page is created automatically.'}
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  {photo
                    ? pageGeneration.phase === 'uploading'
                      ? 'Uploading'
                      : pageGeneration.phase === 'generating_ai'
                        ? 'Andrew'
                        : pageGeneration.phase === 'fallback_local'
                          ? 'Fallback'
                          : pageGeneration.phase === 'error'
                            ? 'Needs attention'
                            : 'Ready'
                    : '1 photo only'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleInputChange}
              />

              {!photo ? (
                uploadZone
              ) : pageGeneration.phase === 'uploading' || pageGeneration.phase === 'generating_ai' ? (
                <LoadingPanel message={pageGeneration.message || 'Andrew is drawing the colouring page...'} />
              ) : pageGeneration.phase === 'error' ? (
                <ErrorPanel
                  message={pageGeneration.errorMessage || pageGeneration.message || 'The page could not be processed.'}
                  onReplacePhoto={handleChoosePhoto}
                />
              ) : (
                <ColouringPageCanvas
                  key={photo.name}
                  canvas={
                    pageGeneration.phase === 'ready_ai' && pageGeneration.aiImageUrl
                      ? {
                          kind: 'image',
                          width: pageGeneration.localPipeline.width || 1536,
                          height: pageGeneration.localPipeline.height || 1536,
                          imageUrl: pageGeneration.aiImageUrl,
                        }
                      : {
                          kind: 'outline',
                          width: pageGeneration.localPipeline.width,
                          height: pageGeneration.localPipeline.height,
                          outlinePixels: pageGeneration.localPipeline.outlinePixels ?? new Uint8ClampedArray(),
                        }
                  }
                  sourceName={
                    pageGeneration.phase === 'ready_ai'
                      ? pageGeneration.generation?.title || photo.name
                      : pageGeneration.localPipeline.sourceName ?? photo.name
                  }
                  onReplacePhoto={handleChoosePhoto}
                  renderModeLabel={pageGeneration.phase === 'fallback_local' ? 'Local fallback' : 'Andrew page'}
                />
              )}

              <div className="flex flex-wrap gap-3">
                <Button variant="primary" size="sm" onClick={handleChoosePhoto}>
                  <Camera className="h-4 w-4" />
                  {photo ? 'Replace photo' : 'Choose photo'}
                </Button>
                <Button variant="outline" size="sm" onClick={clearDraft} disabled={!photo && !bookProject}>
                  <Trash2 className="h-4 w-4" />
                  Reset
                </Button>
                {photo && isPageReady && !bookFlowOpen ? (
                  <Button variant="ghost" size="sm" onClick={() => setBookFlowOpen(true)}>
                    Turn it into a Page
                    <Sparkles className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-1">
            <SavedGenerationPanel
              generations={savedHistory.generations}
              selectedId={selectedSavedGenerationId}
              onSelect={(generation) => setSelectedSavedGenerationId(generation.id)}
              onClear={() => setSelectedSavedGenerationId(null)}
              isLoading={savedHistory.isLoading}
              error={savedHistory.error}
            />
          </div>

          {savedGenerationPreview ? (
            <div className="lg:col-span-1">{savedGenerationPreview}</div>
          ) : null}

          <AnimatePresence>
            {bookFlowOpen ? (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                className="flex flex-col gap-6"
              >
                <Card className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-coral-burst" />
                      Book options
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Add the book details only when you want to turn the colouring page into a printable set.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="life-in-colour-title">Title</Label>
                      <Input
                        id="life-in-colour-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Life in Colour"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>Outline mode</Label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {(Object.entries(COLORING_OUTLINE_MODES) as Array<
                          [ColoringOutlineMode, (typeof COLORING_OUTLINE_MODES)[ColoringOutlineMode]]
                        >).map(([mode, config]) => {
                          const active = outlineMode === mode;
                          const Icon = mode === 'simple' ? Brush : mode === 'detailed' ? Layers3 : Flower2;

                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setOutlineMode(mode)}
                              className={`flex min-h-[124px] flex-col justify-start rounded-2xl border px-4 py-3 text-left transition-all duration-200 active:scale-[0.99] ${
                                active
                                  ? 'border-coral-burst/35 bg-coral-burst/5 shadow-sm'
                                  : 'border-peach-soft bg-cream-base hover:-translate-y-0.5 hover:border-coral-burst/30 hover:bg-coral-burst/5'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div
                                  className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                                    active
                                      ? 'border-coral-burst/20 bg-coral-burst/10 text-coral-burst'
                                      : 'border-peach-soft bg-surface/80 text-cocoa-light'
                                  }`}
                                >
                                  <Icon className="h-4 w-4" />
                                </div>
                                {config.recommended ? (
                                  <Badge variant="outline" className="px-2 py-0.5 text-[10px] leading-none">
                                    Recommended
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="mt-3">
                                <div className="font-heading text-sm font-bold leading-tight text-charcoal-soft">
                                  {config.label}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-cocoa-light">{config.description}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs leading-relaxed text-cocoa-light">{currentOutlineMode.summary}</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>Preset</Label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {(Object.keys(PRESETS) as BookPreset[]).map((key) => {
                          const config = PRESETS[key];
                          const Icon = config.icon;
                          const active = preset === key;

                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => applyPreset(key)}
                              className={`flex min-h-24 flex-col justify-between rounded-2xl border px-4 py-3 text-left transition-all ${
                                active
                                  ? 'border-coral-burst bg-coral-burst/5 shadow-sm'
                                  : 'border-peach-soft bg-cream-base hover:border-coral-burst/30'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className={`font-heading font-bold ${active ? 'text-coral-burst' : 'text-charcoal-soft'}`}>
                                  {config.label}
                                </span>
                                <Icon className={`h-4 w-4 ${active ? 'text-coral-burst' : 'text-cocoa-light'}`} />
                              </div>
                              <div className="mt-2 text-xs leading-relaxed text-cocoa-light">{config.helper}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="life-in-colour-brief">Brief</Label>
                      <Textarea
                        id="life-in-colour-brief"
                        value={brief}
                        onChange={(event) => setBrief(event.target.value)}
                        className="min-h-[132px]"
                        placeholder="Describe the moment you want to preserve..."
                      />
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <Label>Pages</Label>
                        <Badge variant="secondary">{pageCount} pages</Badge>
                      </div>
                      <Slider
                        min={4}
                        max={24}
                        step={2}
                        value={[pageCount]}
                        onValueChange={(values) => setPageCount(values[0] ?? pageCount)}
                        aria-label="Page count"
                      />
                    </div>

                    {(isBookWorking || bookProject) && (
                      <div className="rounded-2xl border border-peach-soft bg-surface/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-coral-burst" />
                            <span className="text-sm font-semibold text-charcoal-soft">
                              {bookPhase === 'generating'
                                  ? 'Building the book'
                                  : bookPhase === 'ready'
                                    ? 'Book ready'
                                    : 'Build failed'}
                          </span>
                        </div>
                        <Badge variant="secondary">
                            {bookPhase === 'generating'
                                ? 'Rendering'
                                : bookPhase === 'ready'
                                  ? 'Complete'
                                  : bookPhase === 'error'
                                    ? 'Stopped'
                                    : 'Idle'}
                          </Badge>
                        </div>
                        <Progress value={bookProgress} className="mt-3" />
                        <p className="mt-3 text-sm leading-relaxed text-cocoa-light">
                          {bookMessage || 'Preparing the book.'}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={handleGenerateBook}
                        className="flex-1 min-w-0"
                        disabled={!photo || !isPageReady || isBookWorking}
                      >
                        {bookProject ? 'Regenerate book' : 'Generate book'}
                        <Sparkles className="h-4 w-4" />
                      </Button>
                      {isBookWorking ? (
                        <Button variant="outline" size="lg" onClick={handleCancelGeneration} className="min-w-[120px]">
                          Cancel
                        </Button>
                      ) : (
                        <Button variant="outline" size="lg" onClick={clearDraft} className="min-w-[120px]">
                          Reset
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {photo && isPageReady && !bookFlowOpen ? (
            <motion.div
              key="life-in-colour-book-cta"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 140, damping: 20 }}
              className="fixed inset-x-4 bottom-4 z-20 mx-auto max-w-6xl md:inset-x-6"
            >
              <div className="rounded-[28px] border border-peach-soft bg-cream-base/96 px-4 py-3 shadow-[0_16px_44px_-30px_rgba(0,0,0,0.4)] backdrop-blur-md md:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-heading text-sm font-bold text-charcoal-soft">Colouring page ready</div>
                    <p className="mt-1 text-xs leading-relaxed text-cocoa-light">
                      {pageGeneration.phase === 'fallback_local'
                        ? 'Andrew did not finish, so the browser fallback is ready. Open the book flow only if you want a printable set.'
                        : 'Andrew finished the page. Open the book flow only if you want to turn it into a printable set.'}
                    </p>
                  </div>
                  <Button variant="primary" size="lg" onClick={() => setBookFlowOpen(true)} className="shrink-0">
                    Turn it into a Page
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {bookProject ? (
            <motion.section
              key={bookProject.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              className="mt-6 md:mt-8"
            >
              <Card className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-coral-burst" />
                        {bookProject.title}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {bookProject.targetAudience} · {bookProject.tone} · {bookProject.chapters.reduce(
                          (count, chapter) => count + chapter.pages.length,
                          0
                        )}{' '}
                        pages
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={handleShareBook} disabled={isBookResultStale || isBookWorking}>
                        <Share2 className="h-4 w-4" />
                        Share summary
                      </Button>
                      <Button variant="primary" size="sm" onClick={handleExportPdf} disabled={isExporting || isBookResultStale || isBookWorking}>
                        <Download className="h-4 w-4" />
                        {isExporting ? 'Exporting...' : 'Export PDF'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-6">
                  {isBookResultStale ? (
                    <div className="rounded-2xl border border-coral-burst/20 bg-coral-burst/5 px-4 py-3 text-sm text-charcoal-soft">
                      The inputs changed after this result was generated. Generate again to refresh the book and re-enable export.
                    </div>
                  ) : null}

                  <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="flex flex-col gap-4">
                      <div className="overflow-hidden rounded-xl border border-peach-soft bg-white">
                        {bookProject.coverImage ? (
                          <img
                            src={bookProject.coverImage}
                            alt={bookProject.title}
                            className="aspect-[4/5] w-full object-contain bg-white"
                          />
                        ) : (
                          <div className="flex aspect-[4/5] items-center justify-center bg-cream-base px-6 text-center">
                            <div>
                              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-burst/10 text-coral-burst">
                                <ImageIcon className="h-6 w-6" />
                              </div>
                              <p className="font-heading text-lg font-bold text-charcoal-soft">
                                Preview appears after generation
                              </p>
                              <p className="mt-2 text-sm leading-relaxed text-cocoa-light">
                                The first page appears here once the book is ready.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div className="rounded-2xl border border-peach-soft bg-cream-base p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-cocoa-light">Title</div>
                          <div className="mt-2 text-sm font-medium text-charcoal-soft">{bookProject.title}</div>
                        </div>
                        <div className="rounded-2xl border border-peach-soft bg-cream-base p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-cocoa-light">Audience</div>
                          <div className="mt-2 text-sm font-medium text-charcoal-soft">{bookProject.targetAudience}</div>
                        </div>
                        <div className="rounded-2xl border border-peach-soft bg-cream-base p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-cocoa-light">Tone</div>
                          <div className="mt-2 text-sm font-medium text-charcoal-soft">{bookProject.tone}</div>
                        </div>
                        <div className="rounded-2xl border border-peach-soft bg-cream-base p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-cocoa-light">Pages</div>
                          <div className="mt-2 text-sm font-medium text-charcoal-soft">
                            {bookProject.chapters.reduce((count, chapter) => count + chapter.pages.length, 0)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="rounded-xl border border-peach-soft bg-surface/70 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-cocoa-light">Synopsis</div>
                        <p className="mt-3 text-sm leading-relaxed text-charcoal-soft">{bookProject.synopsis}</p>
                      </div>

                      <div className="rounded-xl border border-peach-soft bg-surface/70 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-cocoa-light">Book timeline</div>
                          <Badge variant="secondary">
                            {bookProject.chapters.reduce((count, chapter) => count + chapter.pages.length, 0)} pages
                          </Badge>
                        </div>

                        <div className="mt-4 flex max-h-[420px] flex-col gap-3 overflow-auto pr-1">
                          {bookProject.chapters.flatMap((chapter) => chapter.pages).slice(0, 6).map((page) => (
                            <div key={page.id} className="rounded-2xl border border-peach-soft bg-white p-4">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-cocoa-light">
                                  Page {page.pageNumber}
                                </span>
                                <span className="text-[11px] text-cocoa-light">{page.layoutType.replace('-', ' ')}</span>
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-charcoal-soft">{page.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default LifeInColourPageView;
