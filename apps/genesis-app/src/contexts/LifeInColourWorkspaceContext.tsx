import type React from 'react';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { BookProject, ColoringOutlineMode } from '../../types';
import type { LifeInColourPhotoItem } from '../../components/lifeInColour/LifeInColourPhotoRail';
import type { LifeInColourGenerationHookState } from '../../hooks/useLifeInColourGeneration';
import { useLifeInColourGeneration } from '../../hooks/useLifeInColourGeneration';
import { useLifeInColourHistory } from '../../hooks/useLifeInColourHistory';

export type BookPreset = 'single' | 'family' | 'trip';

const DEFAULT_PRESET: BookPreset = 'family';
const DEFAULT_TITLE = 'Family in Colour';
const DEFAULT_BRIEF =
  'Turn a camera-roll set into a shared family colouring book with matching line art and soft, friendly pacing.';
const DEFAULT_PAGE_COUNT = 12;

interface LifeInColourWorkspaceContextValue {
  photos: LifeInColourPhotoItem[];
  setPhotos: Dispatch<SetStateAction<LifeInColourPhotoItem[]>>;
  preset: BookPreset;
  setPreset: Dispatch<SetStateAction<BookPreset>>;
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  brief: string;
  setBrief: Dispatch<SetStateAction<string>>;
  pageCount: number;
  setPageCount: Dispatch<SetStateAction<number>>;
  outlineMode: ColoringOutlineMode;
  setOutlineMode: Dispatch<SetStateAction<ColoringOutlineMode>>;
  bookFlowOpen: boolean;
  setBookFlowOpen: Dispatch<SetStateAction<boolean>>;
  bookPhase: 'idle' | 'generating' | 'ready' | 'error';
  setBookPhase: Dispatch<SetStateAction<'idle' | 'generating' | 'ready' | 'error'>>;
  bookProgress: number;
  setBookProgress: Dispatch<SetStateAction<number>>;
  bookMessage: string;
  setBookMessage: Dispatch<SetStateAction<string>>;
  bookProject: BookProject | null;
  setBookProject: Dispatch<SetStateAction<BookProject | null>>;
  isExporting: boolean;
  setIsExporting: Dispatch<SetStateAction<boolean>>;
  selectedSavedGenerationId: string | null;
  setSelectedSavedGenerationId: Dispatch<SetStateAction<string | null>>;
  generationCancelRef: React.MutableRefObject<(() => void) | null>;
  generatedBookSignatureRef: React.MutableRefObject<string | null>;
  pageGeneration: LifeInColourGenerationHookState;
  savedHistory: ReturnType<typeof useLifeInColourHistory>;
}

const LifeInColourWorkspaceContext = createContext<LifeInColourWorkspaceContextValue | undefined>(undefined);

export function LifeInColourWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [photos, setPhotos] = useState<LifeInColourPhotoItem[]>([]);
  const [preset, setPreset] = useState<BookPreset>(DEFAULT_PRESET);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [brief, setBrief] = useState(DEFAULT_BRIEF);
  const [pageCount, setPageCount] = useState(DEFAULT_PAGE_COUNT);
  const [outlineMode, setOutlineMode] = useState<ColoringOutlineMode>('detailed');
  const [bookFlowOpen, setBookFlowOpen] = useState(false);
  const [bookPhase, setBookPhase] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  const [bookProgress, setBookProgress] = useState(0);
  const [bookMessage, setBookMessage] = useState('');
  const [bookProject, setBookProject] = useState<BookProject | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSavedGenerationId, setSelectedSavedGenerationId] = useState<string | null>(null);
  const generationCancelRef = useRef<(() => void) | null>(null);
  const generatedBookSignatureRef = useRef<string | null>(null);
  const photosRef = useRef<LifeInColourPhotoItem[]>([]);
  const photo = photos[0] ?? null;

  const pageGeneration = useLifeInColourGeneration({
    photo,
    title: title.trim() || DEFAULT_TITLE,
    brief: brief.trim() || DEFAULT_BRIEF,
    outlineMode,
  });
  const savedHistory = useLifeInColourHistory();

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      generationCancelRef.current?.();
      photosRef.current.forEach((photoItem) => URL.revokeObjectURL(photoItem.previewUrl));
      photosRef.current = [];
    };
  }, []);

  const value = useMemo<LifeInColourWorkspaceContextValue>(
    () => ({
      photos,
      setPhotos,
      preset,
      setPreset,
      title,
      setTitle,
      brief,
      setBrief,
      pageCount,
      setPageCount,
      outlineMode,
      setOutlineMode,
      bookFlowOpen,
      setBookFlowOpen,
      bookPhase,
      setBookPhase,
      bookProgress,
      setBookProgress,
      bookMessage,
      setBookMessage,
      bookProject,
      setBookProject,
      isExporting,
      setIsExporting,
      selectedSavedGenerationId,
      setSelectedSavedGenerationId,
      generationCancelRef,
      generatedBookSignatureRef,
      pageGeneration,
      savedHistory,
    }),
    [
      bookFlowOpen,
      bookMessage,
      bookPhase,
      bookProgress,
      bookProject,
      brief,
      generatedBookSignatureRef,
      isExporting,
      pageCount,
      pageGeneration,
      outlineMode,
      photos,
      preset,
      savedHistory,
      selectedSavedGenerationId,
      title,
    ]
  );

  return <LifeInColourWorkspaceContext.Provider value={value}>{children}</LifeInColourWorkspaceContext.Provider>;
}

export function useLifeInColourWorkspace() {
  const context = useContext(LifeInColourWorkspaceContext);
  if (!context) {
    throw new Error('useLifeInColourWorkspace must be used within LifeInColourWorkspaceProvider');
  }

  return context;
}
