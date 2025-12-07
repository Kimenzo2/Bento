/**
 * Interactive Character Tutor
 * Visual character that speaks and animates while tutoring
 * Like Talking Tom but for educational content
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Play, Pause, RotateCcw } from 'lucide-react';
import { Character } from '../types';
import { characterVoiceTutoringService } from '../services/characterVoiceTutoringService';

interface InteractiveCharacterTutorProps {
    character: Character;
    learningContent?: {
        topic: string;
        mentorDialogue: string;
        quiz?: {
            question: string;
            options: string[];
            correctAnswer: string;
            explanation?: string;
        };
    };
    onQuizComplete?: (correct: boolean) => void;
    autoStart?: boolean;
}

export const InteractiveCharacterTutor: React.FC<InteractiveCharacterTutorProps> = ({
    character,
    learningContent,
    onQuizComplete,
    autoStart = false
}) => {
    const [isActive, setIsActive] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [expression, setExpression] = useState<string>('neutral');
    const [showQuiz, setShowQuiz] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [quizFeedback, setQuizFeedback] = useState<{ show: boolean; correct: boolean } | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const sessionStarted = useRef(false);

    // Start session on mount
    useEffect(() => {
        if (autoStart && !sessionStarted.current && learningContent) {
            startTutoring();
            sessionStarted.current = true;
        }

        return () => {
            characterVoiceTutoringService.stop();
        };
    }, [autoStart, learningContent]);

    const startTutoring = async () => {
        setIsActive(true);
        
        // Start session with expression callback
        characterVoiceTutoringService.startSession(character, (expr) => {
            setExpression(expr);
        });

        // Set speech state callback
        characterVoiceTutoringService.onSpeechEnd(() => {
            setIsSpeaking(false);
        });

        setIsSpeaking(true);

        // Wait for greeting
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (learningContent) {
            // Speak the learning content
            setIsSpeaking(true);
            await characterVoiceTutoringService.speakLearningContent(
                learningContent.mentorDialogue,
                learningContent.topic
            );
            setIsSpeaking(false);

            // Show quiz if available
            if (learningContent.quiz) {
                setTimeout(() => {
                    askQuiz();
                }, 500);
            }
        }
    };

    const askQuiz = async () => {
        if (!learningContent?.quiz) return;

        setShowQuiz(true);
        setIsSpeaking(true);
        
        await characterVoiceTutoringService.speakQuizQuestion(learningContent.quiz.question);
        
        setIsSpeaking(false);
    };

    const handleAnswerSelect = async (answer: string) => {
        if (!learningContent?.quiz) return;

        setSelectedAnswer(answer);
        const isCorrect = answer === learningContent.quiz.correctAnswer;

        setQuizFeedback({ show: true, correct: isCorrect });
        setIsSpeaking(true);

        await characterVoiceTutoringService.giveQuizFeedback(
            isCorrect,
            learningContent.quiz.explanation
        );

        setIsSpeaking(false);

        if (onQuizComplete) {
            onQuizComplete(isCorrect);
        }

        // Hide quiz after feedback
        setTimeout(() => {
            setShowQuiz(false);
            setQuizFeedback(null);
            setSelectedAnswer(null);
        }, 3000);
    };

    const togglePause = () => {
        if (isPaused) {
            characterVoiceTutoringService.resume();
        } else {
            characterVoiceTutoringService.pause();
        }
        setIsPaused(!isPaused);
    };

    const stopTutoring = () => {
        characterVoiceTutoringService.stop();
        setIsActive(false);
        setIsSpeaking(false);
        setShowQuiz(false);
        setExpression('neutral');
    };

    const restartTutoring = () => {
        stopTutoring();
        setTimeout(() => startTutoring(), 300);
    };

    // Character expression classes
    const getExpressionClasses = () => {
        switch (expression) {
            case 'happy':
                return 'scale-110 rotate-2';
            case 'thinking':
                return 'scale-105 -rotate-1';
            case 'excited':
                return 'scale-125 animate-bounce';
            case 'encouraging':
                return 'scale-105';
            default:
                return 'scale-100';
        }
    };

    // Speaking animation (mouth movement)
    const getSpeakingAnimation = () => {
        if (isSpeaking) {
            return {
                scale: [1, 1.05, 1]
            };
        }
        return {};
    };

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-3xl">
            {/* Character Avatar with Expressions */}
            <motion.div
                className={`relative mb-6 transition-all duration-300 ${getExpressionClasses()}`}
                animate={getSpeakingAnimation()}
            >
                {/* Main Character Image */}
                <div className="relative w-48 h-48 rounded-full overflow-hidden border-8 border-white shadow-2xl">
                    <img
                        src={character.imageUrl}
                        alt={character.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${character.name}`;
                        }}
                    />
                    
                    {/* Speaking indicator - animated mouth overlay */}
                    {isSpeaking && (
                        <motion.div
                            className="absolute bottom-12 left-1/2 -translate-x-1/2 w-16 h-8 bg-white/40 rounded-full backdrop-blur-sm"
                            animate={{
                                scaleY: [1, 1.3, 0.8, 1.2, 1],
                                scaleX: [1, 0.9, 1.1, 0.95, 1]
                            }}
                            transition={{
                                duration: 0.5,
                                repeat: Infinity,
                                ease: 'easeInOut'
                            }}
                        />
                    )}
                </div>

                {/* Expression Emoji Overlay */}
                <AnimatePresence>
                    {expression !== 'neutral' && (
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 180 }}
                            className="absolute -top-4 -right-4 w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center text-3xl shadow-lg border-4 border-white"
                        >
                            {expression === 'happy' && '😊'}
                            {expression === 'thinking' && '🤔'}
                            {expression === 'excited' && '🎉'}
                            {expression === 'encouraging' && '💪'}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Speaking Wave Animation */}
                {isSpeaking && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {[...Array(5)].map((_, i) => (
                            <motion.div
                                key={i}
                                className="w-1 bg-gradient-to-t from-blue-500 to-purple-500 rounded-full"
                                animate={{
                                    height: ['8px', '24px', '8px']
                                }}
                                transition={{
                                    duration: 0.6,
                                    repeat: Infinity,
                                    delay: i * 0.1,
                                    ease: 'easeInOut'
                                }}
                            />
                        ))}
                    </div>
                )}
            </motion.div>

            {/* Character Name & Topic */}
            <div className="text-center mb-4">
                <h3 className="text-2xl font-heading font-bold text-charcoal-soft mb-1">
                    {character.name}
                </h3>
                {learningContent && (
                    <p className="text-sm text-blue-600 font-medium">
                        Teaching: {learningContent.topic}
                    </p>
                )}
            </div>

            {/* Quiz Section */}
            <AnimatePresence>
                {showQuiz && learningContent?.quiz && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border-2 border-blue-200"
                    >
                        <p className="text-lg font-bold text-charcoal-soft mb-4">
                            {learningContent.quiz.question}
                        </p>

                        <div className="space-y-2">
                            {learningContent.quiz.options.map((option, index) => (
                                <motion.button
                                    key={index}
                                    onClick={() => !quizFeedback && handleAnswerSelect(option)}
                                    disabled={!!quizFeedback}
                                    whileHover={{ scale: quizFeedback ? 1 : 1.02 }}
                                    whileTap={{ scale: quizFeedback ? 1 : 0.98 }}
                                    className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                                        selectedAnswer === option
                                            ? quizFeedback?.correct
                                                ? 'border-green-500 bg-green-50 text-green-800'
                                                : 'border-red-500 bg-red-50 text-red-800'
                                            : option === learningContent.quiz?.correctAnswer && quizFeedback
                                                ? 'border-green-500 bg-green-50'
                                                : 'border-blue-200 bg-white hover:border-blue-400 hover:bg-blue-50'
                                    }`}
                                >
                                    <span className="font-bold mr-2">{String.fromCharCode(65 + index)}.</span>
                                    {option}
                                </motion.button>
                            ))}
                        </div>

                        {/* Quiz Feedback */}
                        {quizFeedback && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`mt-4 p-4 rounded-xl ${
                                    quizFeedback.correct
                                        ? 'bg-green-100 border-2 border-green-500'
                                        : 'bg-yellow-100 border-2 border-yellow-500'
                                }`}
                            >
                                <p className={`font-bold ${quizFeedback.correct ? 'text-green-800' : 'text-yellow-800'}`}>
                                    {quizFeedback.correct ? '🎉 Excellent!' : '💪 Good try!'}
                                </p>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Control Buttons */}
            <div className="absolute bottom-4 right-4 flex gap-2">
                {isActive ? (
                    <>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={togglePause}
                            className="p-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors"
                            title={isPaused ? 'Resume' : 'Pause'}
                        >
                            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={stopTutoring}
                            className="p-3 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                            title="Stop"
                        >
                            <VolumeX className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={restartTutoring}
                            className="p-3 bg-purple-500 text-white rounded-full shadow-lg hover:bg-purple-600 transition-colors"
                            title="Restart"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </motion.button>
                    </>
                ) : (
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={startTutoring}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all font-bold flex items-center gap-2"
                    >
                        <Volume2 className="w-5 h-5" />
                        Start Learning
                    </motion.button>
                )}
            </div>
        </div>
    );
};

export default InteractiveCharacterTutor;
