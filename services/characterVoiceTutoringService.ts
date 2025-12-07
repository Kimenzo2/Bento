/**
 * Character Voice Tutoring Service
 * Real-time character speech for educational content - like Talking Tom
 * 
 * Features:
 * - Character-specific voice profiles (pitch, rate, accent)
 * - Interactive tutoring with voice responses
 * - Expression animations synchronized with speech
 * - Quiz feedback with character personality
 * - Encouragement and correction in character voice
 */

import { Character } from '../types';

export interface CharacterVoiceProfile {
    characterId: string;
    characterName: string;
    
    // Voice characteristics
    basePitch: number;        // 0.5 to 2 (1 = normal)
    baseRate: number;         // 0.5 to 2 (1 = normal)
    volume: number;           // 0 to 1
    voiceName?: string;       // Preferred system voice
    
    // Personality
    expressiveness: number;   // 0 to 1 - how much pitch varies
    enthusiasm: number;       // 0 to 1 - affects rate changes
    pauseDuration: number;    // ms between phrases
    
    // Teaching style
    encouragementPhrases: string[];
    correctionPhrases: string[];
    thinkingPhrases: string[];
    celebrationPhrases: string[];
}

export interface TutoringSession {
    character: Character;
    voiceProfile: CharacterVoiceProfile;
    currentTopic: string;
    isActive: boolean;
    isSpeaking: boolean;
    expressionState: 'neutral' | 'happy' | 'thinking' | 'excited' | 'encouraging';
}

export interface SpeechOptions {
    addExpression?: boolean;
    animate?: boolean;
    pauseBefore?: number;
    pauseAfter?: number;
    emphasisWords?: string[];
}

class CharacterVoiceTutoringService {
    private synth: SpeechSynthesis | null = null;
    private currentSession: TutoringSession | null = null;
    private currentUtterance: SpeechSynthesisUtterance | null = null;
    private expressionCallback?: (expression: string) => void;
    private speechEndCallback?: () => void;
    private voices: SpeechSynthesisVoice[] = [];

    constructor() {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            this.synth = window.speechSynthesis;
            this.loadVoices();
            
            if (this.synth.onvoiceschanged !== undefined) {
                this.synth.onvoiceschanged = () => this.loadVoices();
            }
        }
    }

    private loadVoices() {
        if (this.synth) {
            this.voices = this.synth.getVoices();
            console.log(`🎤 Loaded ${this.voices.length} voices`);
        }
    }

    /**
     * Create a voice profile for a character
     */
    createVoiceProfile(character: Character): CharacterVoiceProfile {
        const teachingStyle = character.teachingStyle?.teachingApproach || 'nurturing';
        
        // Base characteristics on teaching style
        let basePitch = 1.0;
        let baseRate = 1.0;
        let expressiveness = 0.5;
        let enthusiasm = 0.5;
        
        switch (teachingStyle) {
            case 'playful':
                basePitch = 1.3;
                baseRate = 1.1;
                expressiveness = 0.8;
                enthusiasm = 0.9;
                break;
            case 'nurturing':
                basePitch = 1.1;
                baseRate = 0.9;
                expressiveness = 0.6;
                enthusiasm = 0.5;
                break;
            case 'challenging':
                basePitch = 0.95;
                baseRate = 1.0;
                expressiveness = 0.4;
                enthusiasm = 0.6;
                break;
            case 'socratic':
                basePitch = 0.9;
                baseRate = 0.85;
                expressiveness = 0.5;
                enthusiasm = 0.4;
                break;
            case 'storytelling':
                basePitch = 1.05;
                baseRate = 0.9;
                expressiveness = 0.7;
                enthusiasm = 0.7;
                break;
        }

        return {
            characterId: character.id || '',
            characterName: character.name,
            basePitch,
            baseRate,
            volume: 1.0,
            expressiveness,
            enthusiasm,
            pauseDuration: 300,
            encouragementPhrases: character.teachingStyle?.encouragementStyle 
                ? [character.teachingStyle.encouragementStyle]
                : ['Great job!', 'Excellent!', 'You got it!'],
            correctionPhrases: character.teachingStyle?.correctionStyle
                ? [character.teachingStyle.correctionStyle]
                : ['Let\'s try again!', 'Almost there!', 'Good effort!'],
            thinkingPhrases: [
                'Hmm, let me think...',
                'Interesting question!',
                'Let me explain...'
            ],
            celebrationPhrases: [
                'Amazing work!',
                'You\'re a star!',
                'I knew you could do it!'
            ]
        };
    }

    /**
     * Start a tutoring session with a character
     */
    startSession(character: Character, onExpressionChange?: (expression: string) => void) {
        const voiceProfile = this.createVoiceProfile(character);
        
        this.currentSession = {
            character,
            voiceProfile,
            currentTopic: '',
            isActive: true,
            isSpeaking: false,
            expressionState: 'neutral'
        };

        this.expressionCallback = onExpressionChange;
        
        console.log(`🎓 Started tutoring session with ${character.name}`);
        
        // Greeting
        const greeting = character.voiceProfile?.catchphrases?.[0] 
            || `Hi! I'm ${character.name}, and I'll be your guide today!`;
        
        this.speak(greeting, { addExpression: true });
    }

    /**
     * Speak text in character's voice
     */
    speak(text: string, options: SpeechOptions = {}): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.synth || !this.currentSession) {
                reject(new Error('No active session'));
                return;
            }

            // Cancel any current speech
            this.synth.cancel();

            const { voiceProfile } = this.currentSession;

            // Add pause before if requested
            if (options.pauseBefore) {
                setTimeout(() => this.speakInternal(text, options, resolve, reject), options.pauseBefore);
            } else {
                this.speakInternal(text, options, resolve, reject);
            }
        });
    }

    private speakInternal(
        text: string, 
        options: SpeechOptions,
        resolve: () => void,
        reject: (error: Error) => void
    ) {
        if (!this.synth || !this.currentSession) {
            reject(new Error('No active session'));
            return;
        }

        const { voiceProfile } = this.currentSession;
        const utterance = new SpeechSynthesisUtterance(text);

        // Apply character voice settings
        utterance.pitch = voiceProfile.basePitch;
        utterance.rate = voiceProfile.baseRate;
        utterance.volume = voiceProfile.volume;

        // Select appropriate voice
        const voice = this.selectVoice(voiceProfile);
        if (voice) {
            utterance.voice = voice;
        }

        // Add expression animation if requested
        if (options.addExpression && this.expressionCallback) {
            this.updateExpression('happy');
        }

        // Handle emphasis words (increase pitch slightly)
        if (options.emphasisWords && options.emphasisWords.length > 0) {
            utterance.pitch = voiceProfile.basePitch * (1 + voiceProfile.expressiveness * 0.3);
        }

        utterance.onstart = () => {
            if (this.currentSession) {
                this.currentSession.isSpeaking = true;
            }
        };

        utterance.onend = () => {
            if (this.currentSession) {
                this.currentSession.isSpeaking = false;
            }
            
            if (options.addExpression && this.expressionCallback) {
                this.updateExpression('neutral');
            }

            if (options.pauseAfter) {
                setTimeout(() => resolve(), options.pauseAfter);
            } else {
                resolve();
            }

            if (this.speechEndCallback) {
                this.speechEndCallback();
            }
        };

        utterance.onerror = (event) => {
            console.error('Speech error:', event);
            reject(new Error(`Speech failed: ${event.error}`));
        };

        this.currentUtterance = utterance;
        this.synth!.speak(utterance);
    }

    /**
     * Speak learning content (mentor dialogue)
     */
    async speakLearningContent(mentorDialogue: string, topic: string) {
        if (!this.currentSession) return;

        this.currentSession.currentTopic = topic;

        // Introduction phrase
        const intro = this.getRandomPhrase(this.currentSession.voiceProfile.thinkingPhrases);
        await this.speak(intro, { addExpression: true, pauseAfter: 200 });

        // Main content
        this.updateExpression('thinking');
        await this.speak(mentorDialogue, { addExpression: true, pauseAfter: 300 });
        this.updateExpression('neutral');
    }

    /**
     * Speak quiz question
     */
    async speakQuizQuestion(question: string) {
        if (!this.currentSession) return;

        this.updateExpression('thinking');
        await this.speak(question, { pauseBefore: 200, addExpression: true });
    }

    /**
     * Give feedback on quiz answer
     */
    async giveQuizFeedback(isCorrect: boolean, explanation?: string) {
        if (!this.currentSession) return;

        const { voiceProfile } = this.currentSession;

        if (isCorrect) {
            // Celebration!
            this.updateExpression('excited');
            const praise = this.getRandomPhrase(voiceProfile.encouragementPhrases);
            
            // Slightly higher pitch and faster rate for excitement
            const originalPitch = voiceProfile.basePitch;
            const originalRate = voiceProfile.baseRate;
            voiceProfile.basePitch *= 1.1;
            voiceProfile.baseRate *= 1.1;
            
            await this.speak(praise, { addExpression: true, pauseAfter: 300 });
            
            // Restore original voice settings
            voiceProfile.basePitch = originalPitch;
            voiceProfile.baseRate = originalRate;
        } else {
            // Gentle correction
            this.updateExpression('encouraging');
            const encouragement = this.getRandomPhrase(voiceProfile.correctionPhrases);
            await this.speak(encouragement, { addExpression: true, pauseAfter: 200 });
        }

        // Speak explanation if provided
        if (explanation) {
            this.updateExpression('thinking');
            await this.speak(explanation, { addExpression: true });
            this.updateExpression('neutral');
        }
    }

    /**
     * Select best matching voice for character
     */
    private selectVoice(profile: CharacterVoiceProfile): SpeechSynthesisVoice | null {
        if (profile.voiceName) {
            const matchingVoice = this.voices.find(v => v.name.includes(profile.voiceName!));
            if (matchingVoice) return matchingVoice;
        }

        // Select based on pitch (higher pitch = female voices, lower = male)
        const isHighPitch = profile.basePitch > 1.1;
        const preferredGender = isHighPitch ? 'Female' : 'Male';

        // Try to find gender-matching English voice
        const genderMatch = this.voices.find(v => 
            v.lang.startsWith('en') && v.name.includes(preferredGender)
        );
        if (genderMatch) return genderMatch;

        // Fallback to any English voice
        const anyEnglish = this.voices.find(v => v.lang.startsWith('en'));
        return anyEnglish || null;
    }

    /**
     * Update character expression state
     */
    private updateExpression(expression: TutoringSession['expressionState']) {
        if (this.currentSession) {
            this.currentSession.expressionState = expression;
            if (this.expressionCallback) {
                this.expressionCallback(expression);
            }
        }
    }

    /**
     * Get random phrase from array
     */
    private getRandomPhrase(phrases: string[]): string {
        return phrases[Math.floor(Math.random() * phrases.length)];
    }

    /**
     * Stop current speech
     */
    stop() {
        if (this.synth) {
            this.synth.cancel();
        }
        if (this.currentSession) {
            this.currentSession.isSpeaking = false;
            this.updateExpression('neutral');
        }
    }

    /**
     * Pause current speech
     */
    pause() {
        if (this.synth) {
            this.synth.pause();
        }
    }

    /**
     * Resume paused speech
     */
    resume() {
        if (this.synth) {
            this.synth.resume();
        }
    }

    /**
     * End tutoring session
     */
    async endSession() {
        if (!this.currentSession) return;

        const goodbye = `Thanks for learning with me! See you next time!`;
        await this.speak(goodbye, { addExpression: true });

        this.stop();
        this.currentSession = null;
        this.expressionCallback = undefined;
    }

    /**
     * Check if TTS is supported
     */
    isSupported(): boolean {
        return this.synth !== null;
    }

    /**
     * Get current session
     */
    getSession(): TutoringSession | null {
        return this.currentSession;
    }

    /**
     * Set callback for when speech ends
     */
    onSpeechEnd(callback: () => void) {
        this.speechEndCallback = callback;
    }
}

// Export singleton instance
export const characterVoiceTutoringService = new CharacterVoiceTutoringService();
