/**
 * Mux Video Integration
 *
 * Professional video streaming for book trailers, tutorials, and video content.
 * Features: Adaptive streaming, analytics, thumbnails, captions.
 *
 * @see https://docs.mux.com
 */

// ============================================================================
// TYPES
// ============================================================================

export interface MuxAsset {
  id: string;
  status: 'preparing' | 'ready' | 'errored';
  duration: number;
  max_stored_resolution: string;
  max_stored_frame_rate: number;
  aspect_ratio: string;
  playback_ids: PlaybackId[];
  tracks: Track[];
  created_at: string;
  errors?: { type: string; messages: string[] };
}

export interface PlaybackId {
  id: string;
  policy: 'public' | 'signed';
}

export interface Track {
  id: string;
  type: 'video' | 'audio' | 'text';
  max_width?: number;
  max_height?: number;
  max_frame_rate?: number;
  duration?: number;
  language_code?: string;
  name?: string;
  text_type?: 'subtitles' | 'captions';
}

export interface UploadUrl {
  id: string;
  url: string;
  timeout: number;
  status: 'waiting' | 'asset_created' | 'errored' | 'cancelled' | 'timed_out';
  new_asset_settings: {
    playback_policy: ('public' | 'signed')[];
    passthrough?: string;
  };
  asset_id?: string;
}

export interface LiveStream {
  id: string;
  stream_key: string;
  status: 'idle' | 'active' | 'disabled';
  playback_ids: PlaybackId[];
  new_asset_settings?: {
    playback_policy: ('public' | 'signed')[];
  };
  created_at: string;
  recent_asset_ids?: string[];
}

export interface VideoView {
  id: string;
  viewer_experience_score: number;
  video_startup_time: number;
  player_startup_time: number;
  buffering_count: number;
  buffering_duration: number;
  rebuffer_percentage: number;
  watch_time: number;
  view_end: string;
}

export interface MuxConfig {
  tokenId: string;
  tokenSecret: string;
  signingKeyId?: string;
  signingKeySecret?: string;
}

// ============================================================================
// MUX SERVICE CLASS
// ============================================================================

class MuxService {
  private initialized = false;
  private config: MuxConfig | null = null;
  private baseUrl = 'https://api.mux.com';

  /**
   * Initialize Mux with API tokens
   */
  initialize(config?: Partial<MuxConfig>): boolean {
    // Server secrets — never exposed to client bundle (no VITE_ prefix)
    const tokenId = config?.tokenId;
    const tokenSecret = config?.tokenSecret;

    if (!tokenId || !tokenSecret) {
      return false;
    }

    this.config = {
      tokenId,
      tokenSecret,
      signingKeyId: config?.signingKeyId,
      signingKeySecret: config?.signingKeySecret,
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
   * Get authorization header
   */
  private getAuthHeader(): string {
    if (!this.config) throw new Error('Mux not initialized');
    const credentials = btoa(`${this.config.tokenId}:${this.config.tokenSecret}`);
    return `Basic ${credentials}`;
  }

  /**
   * Make API request
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.config) {
      throw new Error('Mux not initialized');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.messages?.[0] || `Mux API error: ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  }

  // ============================================================================
  // ASSET MANAGEMENT
  // ============================================================================

  /**
   * Create asset from URL
   */
  async createAssetFromUrl(
    url: string,
    options?: {
      playbackPolicy?: ('public' | 'signed')[];
      passthrough?: string;
      mp4Support?: 'none' | 'standard' | 'capped-1080p';
    }
  ): Promise<MuxAsset> {
    return this.request('/video/v1/assets', {
      method: 'POST',
      body: JSON.stringify({
        input: url,
        playback_policy: options?.playbackPolicy || ['public'],
        passthrough: options?.passthrough,
        mp4_support: options?.mp4Support,
      }),
    });
  }

  /**
   * Get upload URL for direct upload
   */
  async createUploadUrl(options?: {
    corsOrigin?: string;
    playbackPolicy?: ('public' | 'signed')[];
    passthrough?: string;
  }): Promise<UploadUrl> {
    return this.request('/video/v1/uploads', {
      method: 'POST',
      body: JSON.stringify({
        cors_origin: options?.corsOrigin || '*',
        new_asset_settings: {
          playback_policy: options?.playbackPolicy || ['public'],
          passthrough: options?.passthrough,
        },
      }),
    });
  }

  /**
   * Get asset by ID
   */
  async getAsset(assetId: string): Promise<MuxAsset> {
    return this.request(`/video/v1/assets/${assetId}`);
  }

  /**
   * List assets
   */
  async listAssets(options?: {
    limit?: number;
    page?: number;
  }): Promise<MuxAsset[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.page) params.set('page', String(options.page));

    return this.request(`/video/v1/assets?${params}`);
  }

  /**
   * Delete asset
   */
  async deleteAsset(assetId: string): Promise<void> {
    await this.request(`/video/v1/assets/${assetId}`, { method: 'DELETE' });
  }

  // ============================================================================
  // PLAYBACK
  // ============================================================================

  /**
   * Get playback URL
   */
  getPlaybackUrl(playbackId: string, type: 'hls' | 'thumbnail' | 'gif' = 'hls'): string {
    switch (type) {
      case 'hls':
        return `https://stream.mux.com/${playbackId}.m3u8`;
      case 'thumbnail':
        return `https://image.mux.com/${playbackId}/thumbnail.jpg`;
      case 'gif':
        return `https://image.mux.com/${playbackId}/animated.gif`;
      default:
        return `https://stream.mux.com/${playbackId}.m3u8`;
    }
  }

  /**
   * Get thumbnail at specific time
   */
  getThumbnailUrl(
    playbackId: string,
    options?: {
      time?: number;
      width?: number;
      height?: number;
      format?: 'jpg' | 'png' | 'webp';
    }
  ): string {
    const params = new URLSearchParams();
    if (options?.time) params.set('time', String(options.time));
    if (options?.width) params.set('width', String(options.width));
    if (options?.height) params.set('height', String(options.height));

    const format = options?.format || 'jpg';
    return `https://image.mux.com/${playbackId}/thumbnail.${format}?${params}`;
  }

  /**
   * Get storyboard (sprite sheet)
   */
  getStoryboardUrl(playbackId: string): string {
    return `https://image.mux.com/${playbackId}/storyboard.vtt`;
  }

  // ============================================================================
  // LIVE STREAMING
  // ============================================================================

  /**
   * Create live stream
   */
  async createLiveStream(options?: {
    playbackPolicy?: ('public' | 'signed')[];
    recordAsset?: boolean;
    reducedLatency?: boolean;
  }): Promise<LiveStream> {
    return this.request('/video/v1/live-streams', {
      method: 'POST',
      body: JSON.stringify({
        playback_policy: options?.playbackPolicy || ['public'],
        new_asset_settings: options?.recordAsset
          ? {
              playback_policy: ['public'],
            }
          : undefined,
        reduced_latency: options?.reducedLatency,
      }),
    });
  }

  /**
   * Get live stream
   */
  async getLiveStream(streamId: string): Promise<LiveStream> {
    return this.request(`/video/v1/live-streams/${streamId}`);
  }

  /**
   * Delete live stream
   */
  async deleteLiveStream(streamId: string): Promise<void> {
    await this.request(`/video/v1/live-streams/${streamId}`, { method: 'DELETE' });
  }

  // ============================================================================
  // CAPTIONS
  // ============================================================================

  /**
   * Add caption track
   */
  async addCaptions(
    assetId: string,
    captionUrl: string,
    languageCode: string,
    options?: {
      name?: string;
      closedCaptions?: boolean;
    }
  ): Promise<Track> {
    return this.request(`/video/v1/assets/${assetId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({
        url: captionUrl,
        type: 'text',
        text_type: options?.closedCaptions ? 'captions' : 'subtitles',
        language_code: languageCode,
        name: options?.name,
      }),
    });
  }

  // ============================================================================
  // GENESIS-SPECIFIC HELPERS
  // ============================================================================

  /**
   * Create book trailer video asset
   */
  async createBookTrailer(videoUrl: string, bookId: string, bookTitle: string): Promise<MuxAsset> {
    return this.createAssetFromUrl(videoUrl, {
      playbackPolicy: ['public'],
      passthrough: JSON.stringify({ bookId, bookTitle, type: 'trailer' }),
      mp4Support: 'capped-1080p',
    });
  }

  /**
   * Upload book trailer directly
   */
  async getTrailerUploadUrl(bookId: string): Promise<{
    uploadUrl: string;
    uploadId: string;
  }> {
    const upload = await this.createUploadUrl({
      passthrough: JSON.stringify({ bookId, type: 'trailer' }),
    });

    return {
      uploadUrl: upload.url,
      uploadId: upload.id,
    };
  }

  /**
   * Get video embed HTML
   */
  getEmbedHtml(
    playbackId: string,
    options?: {
      width?: number;
      height?: number;
      autoplay?: boolean;
      muted?: boolean;
      loop?: boolean;
    }
  ): string {
    const width = options?.width || 640;
    const height = options?.height || 360;
    const autoplay = options?.autoplay ? 'autoplay' : '';
    const muted = options?.muted ? 'muted' : '';
    const loop = options?.loop ? 'loop' : '';

    return `
      <video 
        width="${width}" 
        height="${height}" 
        controls 
        ${autoplay} 
        ${muted} 
        ${loop}
        poster="${this.getThumbnailUrl(playbackId)}"
      >
        <source src="${this.getPlaybackUrl(playbackId)}" type="application/x-mpegURL">
      </video>
    `.trim();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const mux = new MuxService();

export function initializeMux(config?: Partial<MuxConfig>): boolean {
  return mux.initialize(config);
}

export default mux;
