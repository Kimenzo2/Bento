/**
 * ElevenLabs Voice AI Integration
 *
 * Text-to-speech for audiobook narration and voice content.
 * Features: Multiple voices, 29 languages, voice cloning, streaming.
 *
 * @see https://elevenlabs.io/docs
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Voice {
  voice_id: string;
  name: string;
  category: 'premade' | 'cloned' | 'generated';
  description?: string;
  labels?: Record<string, string>;
  preview_url?: string;
  available_for_tiers?: string[];
  settings?: VoiceSettings;
}

export interface VoiceSettings {
  stability: number; // 0-1, higher = more consistent
  similarity_boost: number; // 0-1, higher = closer to original voice
  style?: number; // 0-1, style exaggeration
  use_speaker_boost?: boolean;
}

export interface TextToSpeechOptions {
  text: string;
  voiceId: string;
  modelId?: string;
  voiceSettings?: VoiceSettings;
  outputFormat?: 'mp3_44100_128' | 'mp3_44100_192' | 'pcm_16000' | 'pcm_22050' | 'pcm_44100';
}

export interface AudioResult {
  audio: ArrayBuffer;
  contentType: string;
  characterCount: number;
}

export interface StreamingOptions extends TextToSpeechOptions {
  onChunk?: (chunk: Uint8Array) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface GenerationHistory {
  history_item_id: string;
  voice_id: string;
  voice_name: string;
  text: string;
  date_unix: number;
  character_count_change_from: number;
  character_count_change_to: number;
  state: 'created' | 'deleted';
}

export interface ElevenLabsConfig {
  apiKey: string;
  defaultVoiceId?: string;
  defaultModel?: string;
}

// ============================================================================
// VOICE PRESETS
// ============================================================================

export const VOICE_PRESETS = {
  // Professional narration
  NARRATOR_MALE_DEEP: 'pNInz6obpgDQGcFmaJgB', // Adam
  NARRATOR_FEMALE_WARM: '21m00Tcm4TlvDq8ikWAM', // Rachel
  NARRATOR_BRITISH_MALE: 'IKne3meq5aSn9XLyUdCD', // Charlie

  // Storytelling
  STORYTELLER_MALE: 'VR6AewLTigWG4xSOukaG', // Arnold
  STORYTELLER_FEMALE: 'EXAVITQu4vr4xnSDxMaL', // Bella

  // Character voices
  CHARACTER_YOUNG_MALE: 'SOYHLrjzK2X1ezoPC6cr', // Harry
  CHARACTER_YOUNG_FEMALE: 'ThT5KcBeYPX3keUQqHPh', // Dorothy
  CHARACTER_ELDERLY_MALE: 'g5CIjZEefAph4nQFvHAz', // Grandpa
  CHARACTER_ELDERLY_FEMALE: 'zrHiDhphv9ZnVXBqCLjz', // Grandmother

  // Multilingual
  MULTILINGUAL_MALE: 'nPczCjzI2devNBz1zQrb', // Brian (multilingual)
  MULTILINGUAL_FEMALE: 'jsCqWAovK2LkecY7zXl4', // Freya (multilingual)
} as const;

export const MODELS = {
  MULTILINGUAL_V2: 'eleven_multilingual_v2', // Best quality, supports 29 languages
  TURBO_V2: 'eleven_turbo_v2', // Fastest, English-only
  MONOLINGUAL_V1: 'eleven_monolingual_v1', // Legacy English
} as const;

// ============================================================================
// ELEVENLABS SERVICE CLASS
// ============================================================================

class ElevenLabsService {
  private initialized = false;
  private config: ElevenLabsConfig | null = null;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private voiceCache: Map<string, Voice> = new Map();

  /**
   * Initialize ElevenLabs with API key
   */
  initialize(config?: Partial<ElevenLabsConfig>): boolean {
    // Server secret — never exposed to client bundle (no VITE_ prefix)
    const apiKey = config?.apiKey;

    if (!apiKey) {
      return false;
    }

    this.config = {
      apiKey,
      defaultVoiceId: config?.defaultVoiceId || VOICE_PRESETS.NARRATOR_MALE_DEEP,
      defaultModel: config?.defaultModel || MODELS.MULTILINGUAL_V2,
    };

    this.initialized = true;
    return true;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.config !== null;
  }

  /**
   * Make API request
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.config) {
      throw new Error('ElevenLabs not initialized');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'xi-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail?.message || `ElevenLabs API error: ${response.status}`);
    }

    // Check if response is audio
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('audio')) {
      return response.arrayBuffer() as unknown as T;
    }

    return response.json();
  }

  // ============================================================================
  // VOICE MANAGEMENT
  // ============================================================================

  /**
   * Get all available voices
   */
  async getVoices(): Promise<Voice[]> {
    const result = await this.request<{ voices: Voice[] }>('/voices');

    // Cache voices
    result.voices.forEach((voice) => {
      this.voiceCache.set(voice.voice_id, voice);
    });

    return result.voices;
  }

  /**
   * Get voice by ID
   */
  async getVoice(voiceId: string): Promise<Voice> {
    // Check cache first
    if (this.voiceCache.has(voiceId)) {
      return this.voiceCache.get(voiceId)!;
    }

    const voice = await this.request<Voice>(`/voices/${voiceId}`);
    this.voiceCache.set(voiceId, voice);
    return voice;
  }

  /**
   * Get voice settings
   */
  async getVoiceSettings(voiceId: string): Promise<VoiceSettings> {
    return this.request(`/voices/${voiceId}/settings`);
  }

  // ============================================================================
  // TEXT TO SPEECH
  // ============================================================================

  /**
   * Convert text to speech
   */
  async textToSpeech(options: TextToSpeechOptions): Promise<AudioResult> {
    const voiceId = options.voiceId || this.config?.defaultVoiceId;

    const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.config!.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: options.text,
        model_id: options.modelId || this.config?.defaultModel,
        voice_settings: options.voiceSettings || {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail?.message || 'Text-to-speech failed');
    }

    const audio = await response.arrayBuffer();

    return {
      audio,
      contentType: response.headers.get('content-type') || 'audio/mpeg',
      characterCount: options.text.length,
    };
  }

  /**
   * Stream text to speech
   */
  async streamTextToSpeech(options: StreamingOptions): Promise<void> {
    const voiceId = options.voiceId || this.config?.defaultVoiceId;

    const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.config!.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: options.text,
        model_id: options.modelId || this.config?.defaultModel,
        voice_settings: options.voiceSettings || {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      options.onError?.(new Error(error.detail?.message || 'Streaming failed'));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      options.onError?.(new Error('No response body'));
      return;
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        options.onChunk?.(value);
      }
      options.onComplete?.();
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error('Stream error'));
    }
  }

  // ============================================================================
  // AUDIOBOOK GENERATION
  // ============================================================================

  /**
   * Generate audiobook chapter
   */
  async generateChapterAudio(
    chapterText: string,
    voiceId?: string,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    // Split into chunks of ~2500 chars for API limits
    const maxChunkSize = 2500;
    const chunks: string[] = [];

    // Split by sentences to avoid cutting mid-sentence
    const sentences = chapterText.match(/[^.!?]+[.!?]+/g) || [chapterText];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkSize) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    // Generate audio for each chunk
    const audioBuffers: ArrayBuffer[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const result = await this.textToSpeech({
        text: chunks[i],
        voiceId: voiceId || VOICE_PRESETS.NARRATOR_MALE_DEEP,
      });

      audioBuffers.push(result.audio);
      onProgress?.(((i + 1) / chunks.length) * 100);
    }

    // Combine audio buffers
    const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;

    for (const buffer of audioBuffers) {
      combined.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }

    return new Blob([combined], { type: 'audio/mpeg' });
  }

  /**
   * Generate full audiobook
   */
  async generateAudiobook(
    chapters: { title: string; content: string }[],
    voiceId?: string,
    onChapterComplete?: (chapterIndex: number, total: number) => void
  ): Promise<Blob[]> {
    const audioChapters: Blob[] = [];

    for (let i = 0; i < chapters.length; i++) {
      const chapterIntro = `Chapter ${i + 1}: ${chapters[i].title}. `;
      const fullText = chapterIntro + chapters[i].content;

      const audio = await this.generateChapterAudio(fullText, voiceId);
      audioChapters.push(audio);

      onChapterComplete?.(i + 1, chapters.length);
    }

    return audioChapters;
  }

  // ============================================================================
  // USAGE & HISTORY
  // ============================================================================

  /**
   * Get user subscription info
   */
  async getSubscription(): Promise<{
    character_count: number;
    character_limit: number;
    tier: string;
  }> {
    return this.request('/user/subscription');
  }

  /**
   * Get generation history
   */
  async getHistory(pageSize = 100): Promise<GenerationHistory[]> {
    const result = await this.request<{ history: GenerationHistory[] }>(
      `/history?page_size=${pageSize}`
    );
    return result.history;
  }

  /**
   * Get remaining characters
   */
  async getRemainingCharacters(): Promise<number> {
    const sub = await this.getSubscription();
    return sub.character_limit - sub.character_count;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const elevenlabs = new ElevenLabsService();

export function initializeElevenLabs(config?: Partial<ElevenLabsConfig>): boolean {
  return elevenlabs.initialize(config);
}

export default elevenlabs;
