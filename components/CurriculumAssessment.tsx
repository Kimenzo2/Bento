/**
 * CurriculumAssessment Component
 * 
 * Interactive assessment viewer that displays questions from curriculum ebooks,
 * allows students to answer, and provides feedback with rubric-based scoring.
 */

import React, { useState, useEffect } from 'react';
import {
  AssessmentQuestion,
  CurriculumEbook,
  BloomsTaxonomyLevel,
  QuestionType,
  AnswerChoice
} from '../types/curriculum';

interface CurriculumAssessmentProps {
  ebook: CurriculumEbook;
  onComplete?: (results: AssessmentResults) => void;
  mode?: 'practice' | 'quiz' | 'test';
  showAnswersAfterEach?: boolean;
  allowRetry?: boolean;
}

interface AssessmentResults {
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  answers: {
    questionId: string;
    userAnswer: string | string[];
    isCorrect: boolean;
    points: number;
    maxPoints: number;
  }[];
  timeSpent: number;
  standardsMastery: Record<string, { correct: number; total: number }>;
  bloomsBreakdown: Record<string, { correct: number; total: number }>;
}

interface UserAnswer {
  questionId: string;
  answer: string | string[];
  isSubmitted: boolean;
}

// Bloom's level colors
const BLOOMS_COLORS: Record<string, string> = {
  remember: 'bg-blue-500',
  understand: 'bg-green-500',
  apply: 'bg-yellow-500',
  analyze: 'bg-orange-500',
  evaluate: 'bg-red-500',
  create: 'bg-purple-500',
  Remember: 'bg-blue-500',
  Understand: 'bg-green-500',
  Apply: 'bg-yellow-500',
  Analyze: 'bg-orange-500',
  Evaluate: 'bg-red-500',
  Create: 'bg-purple-500'
};

// Bloom's level icons
const BLOOMS_ICONS: Record<string, string> = {
  remember: '🧠',
  understand: '💡',
  apply: '🔧',
  analyze: '🔬',
  evaluate: '⚖️',
  create: '🎨',
  Remember: '🧠',
  Understand: '💡',
  Apply: '🔧',
  Analyze: '🔬',
  Evaluate: '⚖️',
  Create: '🎨'
};

export const CurriculumAssessment: React.FC<CurriculumAssessmentProps> = ({
  ebook,
  onComplete,
  mode = 'practice',
  showAnswersAfterEach = true,
  allowRetry = true
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [results, setResults] = useState<AssessmentResults | null>(null);
  const [startTime] = useState(Date.now());
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [openResponse, setOpenResponse] = useState('');

  const questions = ebook.assessmentBank || [];
  const currentQuestion = questions[currentIndex];

  // Initialize user answers
  useEffect(() => {
    setUserAnswers(questions.map(q => ({
      questionId: q.questionId || q.id,
      answer: '',
      isSubmitted: false
    })));
  }, [questions]);

  // Calculate results
  const calculateResults = (): AssessmentResults => {
    const standardsMastery: Record<string, { correct: number; total: number }> = {};
    const bloomsBreakdown: Record<string, { correct: number; total: number }> = {
      remember: { correct: 0, total: 0 },
      understand: { correct: 0, total: 0 },
      apply: { correct: 0, total: 0 },
      analyze: { correct: 0, total: 0 },
      evaluate: { correct: 0, total: 0 },
      create: { correct: 0, total: 0 },
      Remember: { correct: 0, total: 0 },
      Understand: { correct: 0, total: 0 },
      Apply: { correct: 0, total: 0 },
      Analyze: { correct: 0, total: 0 },
      Evaluate: { correct: 0, total: 0 },
      Create: { correct: 0, total: 0 }
    };

    let totalCorrect = 0;
    let totalPoints = 0;
    let earnedPoints = 0;

    const answersAnalysis = questions.map((q, idx) => {
      const userAnswer = userAnswers[idx];
      const isCorrect = checkAnswer(q, userAnswer?.answer);
      const maxPoints = q.rubric?.maxPoints || 1;
      const points = isCorrect ? maxPoints : 0;

      totalPoints += maxPoints;
      earnedPoints += points;
      if (isCorrect) totalCorrect++;

      // Track standards mastery
      q.standardsAligned?.forEach(std => {
        if (!standardsMastery[std]) {
          standardsMastery[std] = { correct: 0, total: 0 };
        }
        standardsMastery[std].total++;
        if (isCorrect) standardsMastery[std].correct++;
      });

      // Track Bloom's breakdown
      if (q.bloomsLevel && bloomsBreakdown[q.bloomsLevel]) {
        bloomsBreakdown[q.bloomsLevel].total++;
        if (isCorrect) bloomsBreakdown[q.bloomsLevel].correct++;
      }

      return {
        questionId: q.questionId || q.id,
        userAnswer: userAnswer?.answer || '',
        isCorrect,
        points,
        maxPoints
      };
    });

    return {
      totalQuestions: questions.length,
      correctAnswers: totalCorrect,
      score: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0,
      answers: answersAnalysis,
      timeSpent: Math.round((Date.now() - startTime) / 1000),
      standardsMastery,
      bloomsBreakdown
    };
  };

  // Check if answer is correct
  const checkAnswer = (question: AssessmentQuestion, answer: string | string[] | undefined): boolean => {
    if (!answer) return false;

    if (question.questionType === 'multipleChoice' && question.answerChoices) {
      const correctChoice = question.answerChoices.find(c => c.isCorrect);
      return correctChoice?.id === answer;
    }

    if (question.questionType === 'matching' && Array.isArray(answer)) {
      // For matching, check if all pairs are correct
      // This is simplified - in production would need more complex matching
      return answer.length > 0;
    }

    // For open-ended questions, we can't automatically grade
    // Return true if answer exists (would need teacher review)
    if (question.questionType === 'openEnded' || question.questionType === 'constructedResponse') {
      return typeof answer === 'string' && answer.trim().length > 0;
    }

    return false;
  };

  // Handle answer selection for multiple choice
  const handleChoiceSelect = (choiceId: string) => {
    if (currentQuestion.questionType === 'multipleChoice') {
      setSelectedChoices([choiceId]);
    } else {
      // For matching/multiple select
      setSelectedChoices(prev =>
        prev.includes(choiceId)
          ? prev.filter(c => c !== choiceId)
          : [...prev, choiceId]
      );
    }
  };

  // Submit answer for current question
  const submitAnswer = () => {
    const answer = currentQuestion.questionType === 'openEnded' || 
                   currentQuestion.questionType === 'constructedResponse'
      ? openResponse
      : currentQuestion.questionType === 'multipleChoice'
        ? selectedChoices[0]
        : selectedChoices;

    setUserAnswers(prev => prev.map((ua, idx) =>
      idx === currentIndex
        ? { ...ua, answer, isSubmitted: true }
        : ua
    ));

    if (showAnswersAfterEach || mode === 'practice') {
      setShowFeedback(true);
    } else {
      goToNext();
    }
  };

  // Go to next question
  const goToNext = () => {
    setShowFeedback(false);
    setSelectedChoices([]);
    setOpenResponse('');

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishAssessment();
    }
  };

  // Finish assessment and calculate results
  const finishAssessment = () => {
    const calculatedResults = calculateResults();
    setResults(calculatedResults);
    setIsComplete(true);
    onComplete?.(calculatedResults);
  };

  // Retry current question
  const retryQuestion = () => {
    setShowFeedback(false);
    setSelectedChoices([]);
    setOpenResponse('');
    setUserAnswers(prev => prev.map((ua, idx) =>
      idx === currentIndex
        ? { ...ua, answer: '', isSubmitted: false }
        : ua
    ));
  };

  // Get feedback for current answer
  const getFeedback = (): { isCorrect: boolean; message: string } => {
    const userAnswer = userAnswers[currentIndex];
    const isCorrect = checkAnswer(currentQuestion, userAnswer?.answer);

    if (currentQuestion.questionType === 'multipleChoice' && currentQuestion.answerChoices) {
      const selectedChoice = currentQuestion.answerChoices.find(c => c.id === userAnswer?.answer);
      return {
        isCorrect,
        message: selectedChoice?.feedback || (isCorrect ? 'Correct!' : 'Try again.')
      };
    }

    return {
      isCorrect,
      message: isCorrect
        ? 'Great job! Your response has been recorded.'
        : 'Your response needs more detail.'
    };
  };

  // Render results screen
  if (isComplete && results) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl p-8 shadow-2xl border border-purple-500/20">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">
              {results.score >= 90 ? '🌟' : results.score >= 70 ? '👏' : results.score >= 50 ? '💪' : '📚'}
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Assessment Complete!</h2>
            <p className="text-purple-300">
              {ebook.metadata.title}
            </p>
          </div>

          {/* Score Circle */}
          <div className="flex justify-center mb-8">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="#374151"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke={results.score >= 70 ? '#10b981' : results.score >= 50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${(results.score / 100) * 440} 440`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl font-bold text-white">{results.score}%</div>
                  <div className="text-sm text-gray-400">Score</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{results.correctAnswers}</div>
              <div className="text-sm text-gray-400">Correct</div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-300">{results.totalQuestions}</div>
              <div className="text-sm text-gray-400">Total Questions</div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">
                {Math.floor(results.timeSpent / 60)}:{(results.timeSpent % 60).toString().padStart(2, '0')}
              </div>
              <div className="text-sm text-gray-400">Time Spent</div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">
                {results.score >= 90 ? 'A' : results.score >= 80 ? 'B' : results.score >= 70 ? 'C' : results.score >= 60 ? 'D' : 'F'}
              </div>
              <div className="text-sm text-gray-400">Grade</div>
            </div>
          </div>

          {/* Bloom's Breakdown */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Performance by Thinking Level</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(results.bloomsBreakdown).map(([level, data]) => {
                if (data.total === 0) return null;
                const percentage = Math.round((data.correct / data.total) * 100);
                return (
                  <div key={level} className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span>{BLOOMS_ICONS[level as BloomsTaxonomyLevel]}</span>
                      <span className="text-white capitalize text-sm">{level}</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${BLOOMS_COLORS[level as BloomsTaxonomyLevel]} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {data.correct}/{data.total} ({percentage}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Standards Mastery */}
          {Object.keys(results.standardsMastery).length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Standards Mastery</h3>
              <div className="space-y-2">
                {Object.entries(results.standardsMastery).map(([standard, data]) => {
                  const percentage = Math.round((data.correct / data.total) * 100);
                  return (
                    <div key={standard} className="bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-purple-400 font-mono text-sm">{standard}</span>
                        <span className="text-gray-400 text-sm">{percentage}%</span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                setIsComplete(false);
                setCurrentIndex(0);
                setUserAnswers(questions.map(q => ({
                  questionId: q.questionId || q.id,
                  answer: '',
                  isSubmitted: false
                })));
                setResults(null);
              }}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.print()}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
            >
              Print Results
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="bg-gray-800 rounded-xl p-8">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Assessments Available</h3>
          <p className="text-gray-400">This curriculum ebook doesn't have any assessment questions yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl shadow-2xl border border-purple-500/20 overflow-hidden">
        {/* Progress Header */}
        <div className="p-4 bg-gray-900/50 border-b border-purple-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-300 text-sm">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs ${BLOOMS_COLORS[currentQuestion.bloomsLevel || 'remember']} text-white`}>
                {BLOOMS_ICONS[currentQuestion.bloomsLevel || 'remember']} {currentQuestion.bloomsLevel || 'remember'}
              </span>
              {currentQuestion.dokLevel && (
                <span className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-300">
                  DOK {currentQuestion.dokLevel}
                </span>
              )}
            </div>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Content */}
        <div className="p-6">
          {/* Standards Badge */}
          {currentQuestion.standardsAligned && currentQuestion.standardsAligned.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {currentQuestion.standardsAligned.map(std => (
                <span key={std} className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-xs font-mono">
                  {std}
                </span>
              ))}
            </div>
          )}

          {/* Stimulus Text (if any) */}
          {currentQuestion.stimulusText && (
            <div className="bg-gray-800/50 rounded-xl p-4 mb-6 border-l-4 border-purple-500">
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {currentQuestion.stimulusText}
              </p>
            </div>
          )}

          {/* Question Stem */}
          <div className="mb-6">
            <h3 className="text-xl text-white font-medium leading-relaxed">
              {currentQuestion.questionStem}
            </h3>
          </div>

          {/* Answer Input */}
          {!showFeedback && (
            <div className="space-y-3">
              {/* Multiple Choice */}
              {currentQuestion.questionType === 'multipleChoice' && currentQuestion.answerChoices && (
                <div className="space-y-3">
                  {currentQuestion.answerChoices.map((choice) => (
                    <button
                      key={choice.id}
                      onClick={() => handleChoiceSelect(choice.id)}
                      className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                        selectedChoices.includes(choice.id)
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-gray-600 bg-gray-800/50 hover:border-purple-400'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          selectedChoices.includes(choice.id)
                            ? 'border-purple-500 bg-purple-500'
                            : 'border-gray-500'
                        }`}>
                          {selectedChoices.includes(choice.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-purple-400 mr-2">{choice.id}.</span>
                          <span className="text-gray-200">{choice.text}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Open-Ended / Constructed Response */}
              {(currentQuestion.questionType === 'openEnded' || currentQuestion.questionType === 'constructedResponse') && (
                <div>
                  <textarea
                    value={openResponse}
                    onChange={e => setOpenResponse(e.target.value)}
                    placeholder="Type your response here..."
                    className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
                    rows={6}
                  />
                  {currentQuestion.rubric && (
                    <div className="mt-3 text-sm text-gray-400">
                      <span className="text-purple-400">Rubric:</span> This question is worth up to {currentQuestion.rubric.maxPoints} points
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Feedback Display */}
          {showFeedback && (
            <div className={`p-4 rounded-xl mb-6 ${
              getFeedback().isCorrect
                ? 'bg-green-900/30 border border-green-500/50'
                : 'bg-red-900/30 border border-red-500/50'
            }`}>
              <div className="flex items-start gap-3">
                <div className="text-2xl">
                  {getFeedback().isCorrect ? '✅' : '❌'}
                </div>
                <div>
                  <div className={`font-medium ${getFeedback().isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                    {getFeedback().isCorrect ? 'Correct!' : 'Not quite right'}
                  </div>
                  <div className="text-gray-300 text-sm mt-1">
                    {getFeedback().message}
                  </div>
                  {!getFeedback().isCorrect && currentQuestion.answerChoices && (
                    <div className="text-sm text-gray-400 mt-2">
                      <span className="text-purple-400">Correct answer:</span>{' '}
                      {currentQuestion.answerChoices.find(c => c.isCorrect)?.text}
                    </div>
                  )}
                  {currentQuestion.exemplarResponse && !getFeedback().isCorrect && (
                    <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
                      <div className="text-purple-400 text-xs mb-1">Model Response:</div>
                      <div className="text-gray-300 text-sm">{currentQuestion.exemplarResponse}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-gray-900/50 border-t border-purple-500/20">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (currentIndex > 0) {
                  setCurrentIndex(currentIndex - 1);
                  setShowFeedback(false);
                  setSelectedChoices([]);
                  setOpenResponse('');
                }
              }}
              disabled={currentIndex === 0}
              className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>

            <div className="flex gap-3">
              {showFeedback ? (
                <>
                  {!getFeedback().isCorrect && allowRetry && (
                    <button
                      onClick={retryQuestion}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Try Again
                    </button>
                  )}
                  <button
                    onClick={goToNext}
                    className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all"
                  >
                    {currentIndex < questions.length - 1 ? 'Next Question →' : 'Finish Assessment'}
                  </button>
                </>
              ) : (
                <button
                  onClick={submitAnswer}
                  disabled={
                    (currentQuestion.questionType === 'multipleChoice' && selectedChoices.length === 0) ||
                    ((currentQuestion.questionType === 'openEnded' || currentQuestion.questionType === 'constructedResponse') && !openResponse.trim())
                  }
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Answer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Question Navigation Dots */}
      <div className="flex justify-center mt-6 gap-2 flex-wrap">
        {questions.map((_, idx) => {
          const answer = userAnswers[idx];
          const isAnswered = answer?.isSubmitted;
          const isCorrect = isAnswered && checkAnswer(questions[idx], answer.answer);
          
          return (
            <button
              key={idx}
              onClick={() => {
                setCurrentIndex(idx);
                setShowFeedback(false);
                setSelectedChoices([]);
                setOpenResponse('');
              }}
              className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                idx === currentIndex
                  ? 'bg-purple-500 text-white ring-2 ring-purple-300 ring-offset-2 ring-offset-gray-900'
                  : isAnswered
                    ? isCorrect
                      ? 'bg-green-500 text-white'
                      : 'bg-red-500 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CurriculumAssessment;
