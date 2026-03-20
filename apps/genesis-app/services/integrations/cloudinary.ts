/**
 * Cloudinary Integration for Genesis
 * AI-Powered Image & Media Processing
 *
 * Purpose: Dynamic image transformations, video thumbnails, AI-based
 * media optimization for the visual learning platform.
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret?: string; // Only on server-side
  uploadPreset?: string;
}

export interface CloudinaryTransformOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'scale' | 'thumb' | 'pad' | 'auto';
  gravity?: 'auto' | 'face' | 'faces' | 'center' | 'north' | 'south' | 'east' | 'west';
  quality?: 'auto' | 'auto:low' | 'auto:eco' | 'auto:good' | 'auto:best' | number;
  format?: 'auto' | 'webp' | 'avif' | 'png' | 'jpg' | 'gif';
  effect?: string;
  background?: string;
  radius?: number | 'max';
  aspectRatio?: string;
  dpr?: 'auto' | number;
  flags?: string[];
}

export interface CloudinaryUploadOptions {
  folder?: string;
  publicId?: string;
  tags?: string[];
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  transformation?: CloudinaryTransformOptions;
  eager?: CloudinaryTransformOptions[];
  moderation?: 'aws_rek' | 'webpurify' | 'google_video_intelligence';
}

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  resourceType: string;
  createdAt: string;
  tags: string[];
  moderationStatus?: string;
}

export interface CloudinaryVideoThumbnailOptions {
  startOffset?: number | string; // Seconds or 'auto'
  count?: number;
  transformation?: CloudinaryTransformOptions;
}

export interface CloudinaryAIOptions {
  removeBackground?: boolean;
  upscale?: boolean;
  enhance?: boolean;
  generativeFill?: string;
  generativeReplace?: { from: string; to: string };
}

// ============================================================================
// CLOUDINARY SERVICE CLASS
// ============================================================================

class CloudinaryService {
  private config: CloudinaryConfig | null = null;
  private initialized = false;

  /**
   * Initialize Cloudinary with configuration
   */
  async initialize(config?: Partial<CloudinaryConfig>): Promise<void> {
    const cloudName = config?.cloudName || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const apiKey = config?.apiKey || import.meta.env.VITE_CLOUDINARY_API_KEY;
    const uploadPreset = config?.uploadPreset || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName) {
      console.warn('[Cloudinary] Cloud name not configured - service disabled');
      return;
    }

    this.config = {
      cloudName,
      apiKey,
      uploadPreset,
    };

    this.initialized = true;
    console.log('[Cloudinary] ✅ Initialized for cloud:', cloudName);
  }

  /**
   * Check if Cloudinary is available
   */
  isAvailable(): boolean {
    return this.initialized && this.config !== null;
  }

  /**
   * Check if Cloudinary is initialized (alias for isAvailable)
   */
  isInitialized(): boolean {
    return this.initialized && this.config !== null;
  }

  // ==========================================================================
  // URL GENERATION
  // ==========================================================================

  /**
   * Generate optimized image URL with transformations
   */
  imageUrl(publicIdOrUrl: string, options: CloudinaryTransformOptions = {}): string {
    if (!this.config) {
      return publicIdOrUrl; // Return original if not initialized
    }

    const transforms = this.buildTransformString(options);
    const publicId = this.extractPublicId(publicIdOrUrl);

    return `https://res.cloudinary.com/${this.config.cloudName}/image/upload/${transforms}${publicId}`;
  }

  /**
   * Generate video URL with transformations
   */
  videoUrl(publicIdOrUrl: string, options: CloudinaryTransformOptions = {}): string {
    if (!this.config) {
      return publicIdOrUrl;
    }

    const transforms = this.buildTransformString(options);
    const publicId = this.extractPublicId(publicIdOrUrl);

    return `https://res.cloudinary.com/${this.config.cloudName}/video/upload/${transforms}${publicId}`;
  }

  /**
   * Generate video thumbnail URL
   */
  videoThumbnail(videoPublicId: string, options: CloudinaryVideoThumbnailOptions = {}): string {
    if (!this.config) {
      return '';
    }

    const {
      startOffset = 'auto',
      transformation = { width: 480, height: 270, crop: 'fill', quality: 'auto', format: 'auto' },
    } = options;

    const transforms = this.buildTransformString({
      ...transformation,
    });

    const offsetParam = `so_${startOffset}/`;
    const publicId = this.extractPublicId(videoPublicId);

    return `https://res.cloudinary.com/${this.config.cloudName}/video/upload/${offsetParam}${transforms}${publicId}.jpg`;
  }

  /**
   * Generate animated GIF preview from video
   */
  videoPreviewGif(
    videoPublicId: string,
    options: { duration?: number; width?: number; fps?: number } = {}
  ): string {
    if (!this.config) {
      return '';
    }

    const { duration = 5, width = 320, fps = 10 } = options;
    const publicId = this.extractPublicId(videoPublicId);

    return `https://res.cloudinary.com/${this.config.cloudName}/video/upload/w_${width},du_${duration},fps_${fps}/${publicId}.gif`;
  }

  // ==========================================================================
  // AI-POWERED TRANSFORMATIONS
  // ==========================================================================

  /**
   * Generate URL with AI background removal
   */
  removeBackground(publicIdOrUrl: string, options: CloudinaryTransformOptions = {}): string {
    if (!this.config) {
      return publicIdOrUrl;
    }

    const baseTransforms = this.buildTransformString(options);
    const publicId = this.extractPublicId(publicIdOrUrl);

    return `https://res.cloudinary.com/${this.config.cloudName}/image/upload/e_background_removal/${baseTransforms}${publicId}`;
  }

  /**
   * Generate URL with AI enhancement
   */
  enhance(publicIdOrUrl: string, options: CloudinaryTransformOptions = {}): string {
    if (!this.config) {
      return publicIdOrUrl;
    }

    const baseTransforms = this.buildTransformString(options);
    const publicId = this.extractPublicId(publicIdOrUrl);

    return `https://res.cloudinary.com/${this.config.cloudName}/image/upload/e_enhance/${baseTransforms}${publicId}`;
  }

  /**
   * Generate URL with AI upscaling
   */
  upscale(publicIdOrUrl: string, factor: 2 | 4 = 2): string {
    if (!this.config) {
      return publicIdOrUrl;
    }

    const publicId = this.extractPublicId(publicIdOrUrl);

    return `https://res.cloudinary.com/${this.config.cloudName}/image/upload/e_upscale:${factor}/${publicId}`;
  }

  /**
   * Generate URL with AI generative fill (extend image)
   */
  generativeFill(
    publicIdOrUrl: string,
    options: { width: number; height: number; background?: string }
  ): string {
    if (!this.config) {
      return publicIdOrUrl;
    }

    const { width, height, background = 'gen_fill' } = options;
    const publicId = this.extractPublicId(publicIdOrUrl);

    return `https://res.cloudinary.com/${this.config.cloudName}/image/upload/ar_${width}:${height},b_${background},c_pad/${publicId}`;
  }

  /**
   * Generate URL with AI object replacement
   */
  generativeReplace(publicIdOrUrl: string, from: string, to: string): string {
    if (!this.config) {
      return publicIdOrUrl;
    }

    const publicId = this.extractPublicId(publicIdOrUrl);

    return `https://res.cloudinary.com/${this.config.cloudName}/image/upload/e_gen_replace:from_${encodeURIComponent(from)};to_${encodeURIComponent(to)}/${publicId}`;
  }

  // ==========================================================================
  // LEARNING PLATFORM SPECIFIC
  // ==========================================================================

  /**
   * Generate lesson thumbnail with text overlay
   */
  lessonThumbnail(
    backgroundPublicId: string,
    lessonTitle: string,
    options: { width?: number; height?: number; subject?: string } = {}
  ): string {
    if (!this.config) {
      return '';
    }

    const { width = 1280, height = 720, subject } = options;
    const publicId = this.extractPublicId(backgroundPublicId);
    const encodedTitle = encodeURIComponent(lessonTitle);

    // Build complex transformation for lesson thumbnail
    let transforms = `w_${width},h_${height},c_fill/`;

    // Add gradient overlay for text readability
    transforms += 'e_gradient_fade,y_0.7/';

    // Add lesson title
    transforms += `l_text:Arial_60_bold:${encodedTitle},co_white,g_south_west,x_50,y_100/`;

    // Add subject badge if provided
    if (subject) {
      transforms += `l_text:Arial_24:${encodeURIComponent(subject)},co_white,bg_rgb:6366F1,r_8,pa_10,g_north_east,x_20,y_20/`;
    }

    return `https://res.cloudinary.com/${this.config.cloudName}/image/upload/${transforms}${publicId}`;
  }

  /**
   * Generate avatar image optimized for video generation
   */
  avatarImage(publicIdOrUrl: string, options: { size?: number; circular?: boolean } = {}): string {
    if (!this.config) {
      return publicIdOrUrl;
    }

    const { size = 256, circular = true } = options;
    const publicId = this.extractPublicId(publicIdOrUrl);

    const radius = circular ? 'max' : 0;

    return `https://res.cloudinary.com/${this.config.cloudName}/image/upload/w_${size},h_${size},c_fill,g_face,r_${radius},q_auto,f_auto/${publicId}`;
  }

  /**
   * Generate responsive image srcset for React
   */
  responsiveSrcSet(
    publicIdOrUrl: string,
    sizes: number[] = [320, 640, 960, 1280, 1920]
  ): { src: string; srcSet: string; sizes: string } {
    if (!this.config) {
      return { src: publicIdOrUrl, srcSet: '', sizes: '' };
    }

    const publicId = this.extractPublicId(publicIdOrUrl);

    const srcSet = sizes
      .map((width) => {
        const url = this.imageUrl(publicId, { width, quality: 'auto', format: 'auto' });
        return `${url} ${width}w`;
      })
      .join(', ');

    const sizesAttr = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';

    return {
      src: this.imageUrl(publicId, { width: 960, quality: 'auto', format: 'auto' }),
      srcSet,
      sizes: sizesAttr,
    };
  }

  // ==========================================================================
  // UPLOAD (Client-Side Unsigned)
  // ==========================================================================

  /**
   * Upload file using unsigned upload preset (client-side)
   */
  async upload(
    file: File | Blob,
    options: CloudinaryUploadOptions = {}
  ): Promise<CloudinaryUploadResult> {
    if (!this.config?.cloudName || !this.config?.uploadPreset) {
      throw new Error('Cloudinary not configured for uploads');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.config.uploadPreset);

    if (options.folder) {
      formData.append('folder', options.folder);
    }
    if (options.publicId) {
      formData.append('public_id', options.publicId);
    }
    if (options.tags?.length) {
      formData.append('tags', options.tags.join(','));
    }

    const resourceType = options.resourceType || 'auto';
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.config.cloudName}/${resourceType}/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudinary upload failed: ${error}`);
    }

    const result = await response.json();

    return {
      publicId: result.public_id,
      url: result.url,
      secureUrl: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      resourceType: result.resource_type,
      createdAt: result.created_at,
      tags: result.tags || [],
      moderationStatus: result.moderation?.status,
    };
  }

  /**
   * Upload from URL
   */
  async uploadFromUrl(
    url: string,
    options: CloudinaryUploadOptions = {}
  ): Promise<CloudinaryUploadResult> {
    if (!this.config?.cloudName || !this.config?.uploadPreset) {
      throw new Error('Cloudinary not configured for uploads');
    }

    const formData = new FormData();
    formData.append('file', url);
    formData.append('upload_preset', this.config.uploadPreset);

    if (options.folder) {
      formData.append('folder', options.folder);
    }
    if (options.publicId) {
      formData.append('public_id', options.publicId);
    }
    if (options.tags?.length) {
      formData.append('tags', options.tags.join(','));
    }

    const resourceType = options.resourceType || 'auto';
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.config.cloudName}/${resourceType}/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudinary upload failed: ${error}`);
    }

    const result = await response.json();

    return {
      publicId: result.public_id,
      url: result.url,
      secureUrl: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      resourceType: result.resource_type,
      createdAt: result.created_at,
      tags: result.tags || [],
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Build transformation string from options
   */
  private buildTransformString(options: CloudinaryTransformOptions): string {
    const parts: string[] = [];

    if (options.width) parts.push(`w_${options.width}`);
    if (options.height) parts.push(`h_${options.height}`);
    if (options.crop) parts.push(`c_${options.crop}`);
    if (options.gravity) parts.push(`g_${options.gravity}`);
    if (options.quality) parts.push(`q_${options.quality}`);
    if (options.format) parts.push(`f_${options.format}`);
    if (options.effect) parts.push(`e_${options.effect}`);
    if (options.background) parts.push(`b_${options.background}`);
    if (options.radius !== undefined) parts.push(`r_${options.radius}`);
    if (options.aspectRatio) parts.push(`ar_${options.aspectRatio}`);
    if (options.dpr) parts.push(`dpr_${options.dpr}`);
    if (options.flags?.length) parts.push(`fl_${options.flags.join('.')}`);

    return parts.length > 0 ? parts.join(',') + '/' : '';
  }

  /**
   * Extract public ID from URL or return as-is
   */
  private extractPublicId(input: string): string {
    // If it's already a public ID (no http), return as-is
    if (!input.startsWith('http')) {
      return input;
    }

    // Try to extract from Cloudinary URL
    const match = input.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
    if (match) {
      return match[1];
    }

    // Return original if can't parse
    return input;
  }

  /**
   * Get cloud name
   */
  getCloudName(): string | undefined {
    return this.config?.cloudName;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const cloudinary = new CloudinaryService();

// ============================================================================
// REACT HOOKS
// ============================================================================

/**
 * Hook for optimized image URL generation
 */
export function useCloudinaryImage(
  publicIdOrUrl: string,
  options: CloudinaryTransformOptions = {}
): string {
  if (!cloudinary.isAvailable()) {
    return publicIdOrUrl;
  }
  return cloudinary.imageUrl(publicIdOrUrl, options);
}

/**
 * Hook for responsive images
 */
export function useResponsiveImage(publicIdOrUrl: string) {
  if (!cloudinary.isAvailable()) {
    return { src: publicIdOrUrl, srcSet: '', sizes: '' };
  }
  return cloudinary.responsiveSrcSet(publicIdOrUrl);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default cloudinary;
