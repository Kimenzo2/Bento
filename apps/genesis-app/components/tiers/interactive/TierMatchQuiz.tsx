import { AnimatePresence, motion } from 'framer-motion';
import { Building, Check, User, Users, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Button } from '@components/ui/button';

interface QuizQuestion {
  id: string;
  text: string;
  options: {
    label: string;
    value: string;
    icon: React.ElementType;
    score: { creator: number; studio: number; empire: number };
  }[];
}

const questions: QuizQuestion[] = [
  {
    id: 'role',
    text: 'What best describes your role?',
    options: [
      {
        label: 'Solo Creator / Freelancer',
        value: 'solo',
        icon: User,
        score: { creator: 5, studio: 1, empire: 0 },
      },
      {
        label: 'Small Team / Agency',
        value: 'team',
        icon: Users,
        score: { creator: 1, studio: 5, empire: 1 },
      },
      {
        label: 'Enterprise / Organization',
        value: 'org',
        icon: Building,
        score: { creator: 0, studio: 2, empire: 5 },
      },
    ],
  },
  {
    id: 'volume',
    text: 'How many books do you plan to create monthly?',
    options: [
      {
        label: '1-10 books',
        value: 'low',
        icon: Check,
        score: { creator: 5, studio: 3, empire: 0 },
      },
      {
        label: '10-50 books',
        value: 'medium',
        icon: Check,
        score: { creator: 3, studio: 5, empire: 2 },
      },
      {
        label: '50+ books',
        value: 'high',
        icon: Check,
        score: { creator: 0, studio: 4, empire: 5 },
      },
    ],
  },
  {
    id: 'goal',
    text: 'What is your primary goal?',
    options: [
      {
        label: 'Speed & Ease',
        value: 'speed',
        icon: Check,
        score: { creator: 5, studio: 4, empire: 2 },
      },
      {
        label: 'Quality & Control',
        value: 'quality',
        icon: Check,
        score: { creator: 3, studio: 5, empire: 3 },
      },
      {
        label: 'Scale & Automation',
        value: 'scale',
        icon: Check,
        score: { creator: 1, studio: 4, empire: 5 },
      },
    ],
  },
];

export const TierMatchQuiz: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [scores, setScores] = useState({ creator: 0, studio: 0, empire: 0 });
  const [result, setResult] = useState<'Creator' | 'Studio' | 'Empire' | null>(null);

  const handleOptionSelect = (optionScore: { creator: number; studio: number; empire: number }) => {
    const newScores = {
      creator: scores.creator + optionScore.creator,
      studio: scores.studio + optionScore.studio,
      empire: scores.empire + optionScore.empire,
    };
    setScores(newScores);

    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Determine winner
      const maxScore = Math.max(newScores.creator, newScores.studio, newScores.empire);
      if (maxScore === newScores.empire) setResult('Empire');
      else if (maxScore === newScores.studio) setResult('Studio');
      else setResult('Creator');
    }
  };

  const getResultContent = () => {
    switch (result) {
      case 'Creator':
        return {
          title: 'We recommend the Creator Tier',
          desc: 'Perfect for getting started and building your personal portfolio.',
          color: 'emerald',
          gradient: 'from-emerald-500 to-teal-400',
        };
      case 'Studio':
        return {
          title: 'We recommend the Studio Tier',
          desc: 'Ideal for teams and high-volume quality production.',
          color: 'indigo',
          gradient: 'from-violet-600 to-indigo-600',
        };
      case 'Empire':
        return {
          title: 'We recommend the Empire Tier',
          desc: 'The ultimate solution for enterprise-scale operations.',
          color: 'slate',
          gradient: 'from-slate-700 to-zinc-800',
        };
      default:
        return { title: '', desc: '', color: '', gradient: '' };
    }
  };

  if (result) {
    const content = getResultContent();
    return (
      <div className="bg-surface rounded-2xl p-8 text-center max-w-md mx-auto border border-peach-soft relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-full h-2 bg-linear-to-r ${content.gradient}`} />
        <h3 className="text-2xl font-bold font-heading mb-4 text-charcoal-soft">{content.title}</h3>
        <p className="text-charcoal-soft/70 mb-8">{content.desc}</p>
        <Button
          variant="primary"
          size="lg"
          className={`w-full py-4 text-white bg-linear-to-r ${content.gradient} hover:scale-105`}
        >
          View {result} Plan
        </Button>
      </div>
    );
  }

  const question = questions[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-soft/50 ">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface rounded-2xl w-full max-w-lg border border-peach-soft overflow-hidden"
      >
        <div className="p-6 border-b border-peach-soft/50 flex justify-between items-center bg-surface/50">
          <span className="text-xs font-bold text-cocoa-light/60 uppercase tracking-widest">
            Question {currentStep + 1} of {questions.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-peach-light/50 rounded-full"
          >
            <X className="w-5 h-5 text-cocoa-light/60" />
          </Button>
        </div>

        <div className="p-8">
          <h3 className="text-xl font-bold font-heading text-charcoal-soft mb-8">
            {question.text}
          </h3>

          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {question.options.map((option) => {
                const Icon = option.icon;
                return (
                  <motion.button
                    key={option.value}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleOptionSelect(option.score)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-transparent bg-surface/50 hover:bg-surface hover:border-coral-burst/30 transition-all group text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-surface group-hover:bg-coral-burst/10 flex items-center justify-center shrink-0 border border-peach-soft/50">
                      <Icon className="w-5 h-5 text-cocoa-light/60 group-hover:text-coral-burst" />
                    </div>
                    <span className="font-semibold text-charcoal-soft group-hover:text-coral-burst transition-colors">
                      {option.label}
                    </span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        <div className="h-1 bg-peach-soft/30 w-full">
          <motion.div
            className="h-full bg-coral-burst"
            initial={{ width: '0%' }}
            animate={{ width: `${(currentStep / questions.length) * 100}%` }}
          />
        </div>
      </motion.div>
    </div>
  );
};
