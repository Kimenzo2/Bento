// Audio Immersion Service - Text-to-Speech for story narration
// Uses Web Speech API for universal browser support

export interface NarrationOptions {
    voice?: SpeechSynthesisVoice;
    rate?: number;       // 0.1 to 10, default 1
    pitch?: number;      // 0 to 2, default 1
    volume?: number;     // 0 to 1, default 1
}

export interface NarrationState {
    isPlaying: boolean;
    isPaused: boolean;
    currentPage: number;
    progress: number;    // 0 to 1
}

type StateListener = (state: NarrationState) => void;

class AudioImmersionService {
    private synth: SpeechSynthesis | null = null;
    private currentUtterance: SpeechSynthesisUtterance | null = null;
    private voices: SpeechSynthesisVoice[] = [];
    private state: NarrationState = {
        isPlaying: false,
        isPaused: false,
        currentPage: 0,
        progress: 0
    };
    private listeners: Set<StateListener> = new Set();
    private pageTexts: string[] = [];
    private options: NarrationOptions = {
        rate: 0.9,
        pitch: 1,
        volume: 1
    };

    constructor() {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            this.synth = window.speechSynthesis;
            this.loadVoices();
            
            // Voices may load asynchronously
            if (this.synth.onvoiceschanged !== undefined) {
                this.synth.onvoiceschanged = () => this.loadVoices();
            }
        }
    }

    private loadVoices() {
        if (this.synth) {
            this.voices = this.synth.getVoices();
        }
    }

    /**
     * Get available voices, optionally filtered by language
     */
    getVoices(language?: string): SpeechSynthesisVoice[] {
        if (language) {
            return this.voices.filter(v => v.lang.startsWith(language));
        }
        return this.voices;
    }

    /**
     * Get child-friendly voices (higher pitch, clearer)
     */
    getChildFriendlyVoices(): SpeechSynthesisVoice[] {
        const preferredNames = ['Samantha', 'Karen', 'Fiona', 'Moira', 'Tessa', 'Google UK English Female'];
        
        const preferred = this.voices.filter(v => 
            preferredNames.some(name => v.name.includes(name))
        );

        if (preferred.length > 0) return preferred;

        // Fallback to any English female voice
        return this.voices.filter(v => 
            v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Woman'))
        );
    }

    /**
     * Set narration options
     */
    setOptions(options: Partial<NarrationOptions>) {
        this.options = { ...this.options, ...options };
    }

    /**
     * Load book pages for narration
     */
    loadBook(pages: string[]) {
        this.pageTexts = pages;
        this.updateState({ currentPage: 0, progress: 0 });
    }

    /**
     * Start narrating from a specific page
     */
    play(fromPage: number = 0) {
        if (!this.synth || this.pageTexts.length === 0) return;

        // Cancel any ongoing speech
        this.synth.cancel();

        this.updateState({
            isPlaying: true,
            isPaused: false,
            currentPage: fromPage,
            progress: 0
        });

        this.narratePage(fromPage);
    }

    /**
     * Pause narration
     */
    pause() {
        if (this.synth && this.state.isPlaying) {
            this.synth.pause();
            this.updateState({ isPaused: true });
        }
    }

    /**
     * Resume narration
     */
    resume() {
        if (this.synth && this.state.isPaused) {
            this.synth.resume();
            this.updateState({ isPaused: false });
        }
    }

    /**
     * Stop narration completely
     */
    stop() {
        if (this.synth) {
            this.synth.cancel();
            this.updateState({
                isPlaying: false,
                isPaused: false,
                progress: 0
            });
        }
    }

    /**
     * Skip to next page
     */
    nextPage() {
        if (this.state.currentPage < this.pageTexts.length - 1) {
            this.synth?.cancel();
            this.narratePage(this.state.currentPage + 1);
        }
    }

    /**
     * Go to previous page
     */
    previousPage() {
        if (this.state.currentPage > 0) {
            this.synth?.cancel();
            this.narratePage(this.state.currentPage - 1);
        }
    }

    private narratePage(pageIndex: number) {
        if (!this.synth || pageIndex >= this.pageTexts.length) {
            this.stop();
            return;
        }

        const text = this.pageTexts[pageIndex];
        const utterance = new SpeechSynthesisUtterance(text);

        // Apply options
        if (this.options.voice) {
            utterance.voice = this.options.voice;
        } else {
            // Auto-select a good voice
            const childVoices = this.getChildFriendlyVoices();
            if (childVoices.length > 0) {
                utterance.voice = childVoices[0];
            }
        }

        utterance.rate = this.options.rate || 0.9;
        utterance.pitch = this.options.pitch || 1;
        utterance.volume = this.options.volume || 1;

        // Track progress through the utterance
        utterance.onboundary = (event) => {
            if (event.charIndex !== undefined) {
                const progress = event.charIndex / text.length;
                this.updateState({ progress });
            }
        };

        // When page finishes, move to next
        utterance.onend = () => {
            if (pageIndex < this.pageTexts.length - 1 && this.state.isPlaying) {
                this.updateState({ progress: 1 });
                // Small delay between pages
                setTimeout(() => {
                    this.narratePage(pageIndex + 1);
                }, 500);
            } else {
                this.stop();
            }
        };

        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            this.stop();
        };

        this.updateState({ currentPage: pageIndex, progress: 0 });
        this.currentUtterance = utterance;
        this.synth.speak(utterance);
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: StateListener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    private updateState(partial: Partial<NarrationState>) {
        this.state = { ...this.state, ...partial };
        this.listeners.forEach(l => l(this.state));
    }

    /**
     * Get current state
     */
    getState(): NarrationState {
        return { ...this.state };
    }

    /**
     * Check if TTS is supported
     */
    isSupported(): boolean {
        return this.synth !== null;
    }
}

// Singleton instance
export const audioImmersion = new AudioImmersionService();

// React hook for audio immersion
import { useState, useEffect } from 'react';

export function useAudioImmersion() {
    const [state, setState] = useState<NarrationState>(audioImmersion.getState());
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        const unsubscribe = audioImmersion.subscribe(setState);
        
        // Load voices after a short delay (they load async)
        const timer = setTimeout(() => {
            setVoices(audioImmersion.getVoices());
        }, 100);

        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    return {
        ...state,
        voices,
        childFriendlyVoices: audioImmersion.getChildFriendlyVoices(),
        isSupported: audioImmersion.isSupported(),
        loadBook: (pages: string[]) => audioImmersion.loadBook(pages),
        play: (fromPage?: number) => audioImmersion.play(fromPage),
        pause: () => audioImmersion.pause(),
        resume: () => audioImmersion.resume(),
        stop: () => audioImmersion.stop(),
        nextPage: () => audioImmersion.nextPage(),
        previousPage: () => audioImmersion.previousPage(),
        setOptions: (options: Partial<NarrationOptions>) => audioImmersion.setOptions(options)
    };
}
