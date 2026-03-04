/**
 * OnboardingState - PERFORMANCE OPTIMIZED + BROWSER HISTORY + AUTH PERSISTENCE
 *
 * Optimizations:
 * 1. ⚡ Stable context value with useMemo prevents child re-renders
 * 2. ⚡ Stable callbacks with useCallback
 * 3. ⚡ Lazy initial state computation
 * 4. 🔙 Browser back/forward synced with onboarding steps
 * 5. 💾 State persisted to localStorage for OAuth redirect survival
 */
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type OnboardingStep =
  | 'spark'
  | 'quiz'
  | 'magic'
  | 'proreveal'
  | 'pricing'
  | 'tour'
  | 'identity'
  | 'cliffhanger'
  | 'welcome';
export type ThemeOption = 'cosmos' | 'kingdom' | 'cell';
export type UserRole = 'mentor' | 'explorer' | 'guardian';

export interface QuizAnswers {
  intent: 'kids' | 'scifi' | 'brand' | null;
  skill: 'beginner' | 'pro' | null;
  cadence: 'daily' | 'occasional' | null;
}

interface OnboardingState {
  step: OnboardingStep;
  theme: ThemeOption | null;
  role: UserRole | null;
  generatedContent: string | null;
  quizAnswers: QuizAnswers;
  sparkPoints: number;
  setStep: (step: OnboardingStep) => void;
  setTheme: (theme: ThemeOption) => void;
  setRole: (role: UserRole) => void;
  setGeneratedContent: (content: string) => void;
  setQuizAnswers: (answers: QuizAnswers) => void;
  addSparkPoints: (points: number) => void;
}

const OnboardingContext = createContext<OnboardingState | undefined>(undefined);

// --- localStorage persistence helpers ---
const STORAGE_KEY = 'genesis_onboarding_state';

const VALID_STEPS: OnboardingStep[] = [
  'spark', 'quiz', 'magic', 'proreveal', 'pricing',
  'tour', 'identity', 'cliffhanger', 'welcome',
];

interface PersistedState {
  step: OnboardingStep;
  theme: ThemeOption | null;
  role: UserRole | null;
  generatedContent: string | null;
  quizAnswers: QuizAnswers;
  sparkPoints: number;
  timestamp: number;
}

function saveState(state: Omit<PersistedState, 'timestamp'>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, timestamp: Date.now() }));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    // Expire after 24 hours
    if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearOnboardingState(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// --- URL step helpers ---
function getStepFromURL(): OnboardingStep | null {
  const params = new URLSearchParams(window.location.search);
  const stepParam = params.get('step') as OnboardingStep;
  return VALID_STEPS.includes(stepParam) ? stepParam : null;
}

function setStepInURL(step: OnboardingStep, replace = false): void {
  const url = new URL(window.location.href);
  url.searchParams.set('step', step);
  if (replace) {
    window.history.replaceState({ obStep: step }, '', url.toString());
  } else {
    window.history.pushState({ obStep: step }, '', url.toString());
  }
}

// Step ordering for determining forward/back direction
const _STEP_ORDER: Record<OnboardingStep, number> = {
  spark: 0, quiz: 1, magic: 2, proreveal: 3, pricing: 4,
  tour: 5, identity: 6, cliffhanger: 7, welcome: 8,
};

export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const persisted = useMemo(() => loadState(), []);

  // ⚡ Lazy initial state computation
  // Priority: URL param > persisted state > default
  const [step, setStepState] = useState<OnboardingStep>(() => {
    const urlStep = getStepFromURL();
    if (urlStep) return urlStep;
    if (persisted?.step && VALID_STEPS.includes(persisted.step)) return persisted.step;
    return 'spark';
  });

  const [theme, setThemeState] = useState<ThemeOption | null>(() => persisted?.theme ?? null);
  const [role, setRoleState] = useState<UserRole | null>(() => persisted?.role ?? null);
  const [generatedContent, setGeneratedContentState] = useState<string | null>(
    () => persisted?.generatedContent ?? null
  );
  const [quizAnswers, setQuizAnswersState] = useState<QuizAnswers>(
    () => persisted?.quizAnswers ?? { intent: null, skill: null, cadence: null }
  );
  const [sparkPoints, setSparkPoints] = useState(() => persisted?.sparkPoints ?? 0);

  // Ref to track if step change came from popstate (browser back/forward)
  const isPopstateRef = useRef(false);

  // --- Set initial URL on mount (replace, don't push) ---
  useEffect(() => {
    setStepInURL(step, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Persist state on every change ---
  useEffect(() => {
    saveState({ step, theme, role, generatedContent, quizAnswers, sparkPoints });
  }, [step, theme, role, generatedContent, quizAnswers, sparkPoints]);

  // --- Listen for browser back/forward ---
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Try to get step from the history state first, then from URL
      const targetStep: OnboardingStep | null =
        (event.state?.obStep as OnboardingStep) || getStepFromURL();

      if (targetStep && VALID_STEPS.includes(targetStep)) {
        isPopstateRef.current = true;
        setStepState(targetStep);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ⚡ Stable callbacks with useCallback
  const setStep = useCallback((newStep: OnboardingStep) => {
    // Push browser history OUTSIDE the state updater (React 19 purity requirement)
    if (!isPopstateRef.current) {
      setStepInURL(newStep);
    }
    isPopstateRef.current = false;
    setStepState((prevStep) => {
      if (prevStep === newStep) return prevStep;
      return newStep;
    });
  }, []);

  const setTheme = useCallback((newTheme: ThemeOption) => {
    setThemeState(newTheme);
  }, []);

  const setRole = useCallback((newRole: UserRole) => {
    setRoleState(newRole);
  }, []);

  const setGeneratedContent = useCallback((content: string) => {
    setGeneratedContentState(content);
  }, []);

  const setQuizAnswers = useCallback((answers: QuizAnswers) => {
    setQuizAnswersState(answers);
  }, []);

  const addSparkPoints = useCallback((points: number) => {
    setSparkPoints((prev) => prev + points);
  }, []);

  // ⚡ Memoized context value prevents unnecessary re-renders
  const value = useMemo<OnboardingState>(
    () => ({
      step,
      theme,
      role,
      generatedContent,
      quizAnswers,
      sparkPoints,
      setStep,
      setTheme,
      setRole,
      setGeneratedContent,
      setQuizAnswers,
      addSparkPoints,
    }),
    [
      step,
      theme,
      role,
      generatedContent,
      quizAnswers,
      sparkPoints,
      setStep,
      setTheme,
      setRole,
      setGeneratedContent,
      setQuizAnswers,
      addSparkPoints,
    ]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
