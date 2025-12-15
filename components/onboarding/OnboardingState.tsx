import { createContext, useContext, useState, type ReactNode } from 'react';

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
  const [step, setStep] = useState<OnboardingStep>('spark');
  const [theme, setTheme] = useState<ThemeOption | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers>({
    intent: null,
    skill: null,
    cadence: null,
  });
  const [sparkPoints, setSparkPoints] = useState(0);

  const addSparkPoints = (points: number) => {
    setSparkPoints(prev => prev + points);
  };

  return (
    <OnboardingContext.Provider
      value={{
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
      }}
    >
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
