/**
 * OnboardingState - PERFORMANCE OPTIMIZED
 * 
 * Optimizations:
 * 1. ⚡ Stable context value with useMemo prevents child re-renders
 * 2. ⚡ Stable callbacks with useCallback
 * 3. ⚡ Lazy initial state computation
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type OnboardingStep = 'spark' | 'quiz' | 'magic' | 'proreveal' | 'pricing' | 'tour' | 'identity' | 'cliffhanger' | 'welcome';
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

export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // ⚡ Lazy initial state computation (runs only once)
  const [step, setStepState] = useState<OnboardingStep>(() => {
    const params = new URLSearchParams(window.location.search);
    const stepParam = params.get('step') as OnboardingStep;
    const validSteps: OnboardingStep[] = ['spark', 'quiz', 'magic', 'proreveal', 'pricing', 'tour', 'identity', 'cliffhanger', 'welcome'];
    return validSteps.includes(stepParam) ? stepParam : 'spark';
  });

  const [theme, setThemeState] = useState<ThemeOption | null>(null);
  const [role, setRoleState] = useState<UserRole | null>(null);
  const [generatedContent, setGeneratedContentState] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswersState] = useState<QuizAnswers>({
    intent: null,
    skill: null,
    cadence: null,
  });
  const [sparkPoints, setSparkPoints] = useState(0);

  // ⚡ Stable callbacks with useCallback
  const setStep = useCallback((newStep: OnboardingStep) => {
    setStepState(newStep);
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
    setSparkPoints(prev => prev + points);
  }, []);

  // ⚡ Memoized context value prevents unnecessary re-renders
  const value = useMemo<OnboardingState>(() => ({
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
  }), [
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
  ]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
