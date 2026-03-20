/**
 * Vercel Integrations - Barrel Export
 *
 * All third-party service integrations for Genesis.
 * These integrations provide enterprise-grade capabilities:
 *
 * INFRASTRUCTURE:
 * - Upstash: Redis caching, rate limiting, pub/sub
 * - Sentry: Error tracking, performance monitoring
 * - HyperDX: Observability, logging, tracing
 * - Checkly: Synthetic monitoring, health checks
 * - Arcjet: Edge security, bot protection
 *
 * ANALYTICS & EXPERIMENTATION:
 * - Statsig: Feature flags, A/B testing
 * - Vercel Analytics: Web vitals, custom events
 * - PostHog: Product analytics, session replay
 *
 * MESSAGING & NOTIFICATIONS:
 * - Resend: Transactional email
 * - Knock: Multi-channel notifications
 *
 * CONTENT & MEDIA:
 * - ElevenLabs: AI voice/audiobook generation
 * - Mux: Video streaming
 * - Algolia: Search
 *
 * COLLABORATION:
 * - Liveblocks: Real-time collaboration
 *
 * BACKGROUND JOBS:
 * - Inngest: Workflow orchestration
 *
 * @module services/integrations
 */

// ============================================================================
// UPSTASH REDIS
// ============================================================================

export {
  // Main service
  UpstashRedis,
  initializeUpstash,
  getUpstash,
  getUpstashOrNull,
  // Sub-services
  UpstashRateLimiter,
  UpstashSessionCache,
  UpstashCache,
  UpstashCircuitBreaker,
  UpstashLock,
  // Types
  type UpstashConfig,
  type RateLimitResult,
  type SessionData,
  type CacheEntry,
} from './upstash';

// ============================================================================
// SENTRY
// ============================================================================

export {
  // Main service
  sentry,
  initializeSentry,
  // Utilities
  createGenesisError,
  trackAction,
  withSentryErrorBoundary,
  withSentryProfiler,
  // Types
  type SentryConfig,
  type SentryUser,
  type SeverityLevel,
  type BreadcrumbData,
} from './sentry';

// ============================================================================
// STATSIG (Feature Flags)
// ============================================================================

export {
  // Main service
  statsig,
  initializeStatsig,
  // Constants
  FEATURE_FLAGS,
  DYNAMIC_CONFIGS,
  // Hooks
  useFeatureFlag,
  useDynamicConfig,
  useExperiment,
  useStatsigLogger,
  // Utilities
  checkGates,
  requireFeature,
  getTierFeatures,
  // Types
  type StatsigConfig,
  type StatsigUser,
  type FeatureFlagName,
  type DynamicConfigName,
} from './statsig';

// ============================================================================
// CHECKLY (Synthetic Monitoring)
// ============================================================================

export {
  // Main service
  checkly,
  initializeCheckly,
  // Check definitions
  GENESIS_HEALTH_CHECKS,
  // Config generators
  generateChecklyConfig,
  generateBrowserCheck,
  // Hooks
  useHealthChecks,
  // Types
  type ChecklyConfig,
  type HealthCheck,
  type CheckDefinition,
} from './checkly';

// ============================================================================
// ARCJET (Edge Security)
// ============================================================================

export {
  // Main service
  arcjet,
  initializeArcjet,
  // Rule factories
  rateLimit,
  detectBot,
  shield,
  validateEmail,
  sensitiveInfo,
  // Presets
  API_PROTECTION,
  AI_ENDPOINT_PROTECTION,
  AUTH_PROTECTION,
  WEBHOOK_PROTECTION,
  PUBLIC_PROTECTION,
  // Middleware
  createArcjetMiddleware,
  withArcjetProtection,
  // Types
  type ArcjetConfig,
  type ArcjetRule,
  type ArcjetDecision,
} from './arcjet';

// ============================================================================
// VERCEL ANALYTICS
// ============================================================================

export {
  // Main service
  analytics,
  // Event tracking
  trackEvent,
  trackFeatureUsage,
  trackError,
  trackTiming,
  // Funnels
  getFunnelProgress,
  CONVERSION_FUNNELS,
  ANALYTICS_EVENTS,
  // Hooks
  usePageTracking,
  useAnalytics,
  useComponentTracking,
  // Types
  type AnalyticsEvent,
  type AnalyticsEventName,
  type EventCategory,
  type FunnelName,
  type UserJourney,
  type ConversionStep,
} from './vercel-analytics';

// ============================================================================
// BRAINTRUST (LLM Observability)
// ============================================================================

export {
  braintrust,
  initializeBraintrust,
  type BraintrustConfig,
  type BraintrustLogPayload,
} from './braintrust';

// ============================================================================
// BOOTSTRAP & CONTEXT
// ============================================================================

export {
  // Bootstrap
  bootstrapIntegrations,
  updateIntegrationUser,
  clearIntegrationUser,
  getIntegrationHealth,
  shutdownIntegrations,
  isIntegrationsReady,
  getBootstrapResult,
  // Hook
  useIntegrations,
  // Types
  type IntegrationConfig,
  type BootstrapResult,
  type IntegrationHealth,
} from './bootstrap';

// ============================================================================
// RESEND EMAIL
// ============================================================================

export {
  resend,
  initializeResend,
  EMAIL_TEMPLATES,
  type SendEmailOptions,
  type EmailResult,
  type ResendConfig,
} from './resend';

// ============================================================================
// KNOCK NOTIFICATIONS
// ============================================================================

export {
  knock,
  initializeKnock,
  WORKFLOWS as KNOCK_WORKFLOWS,
  type KnockUser,
  type NotificationPreferences,
  type WorkflowTrigger,
  type NotificationFeed,
  type KnockConfig,
} from './knock';

// ============================================================================
// ELEVENLABS VOICE AI
// ============================================================================

export {
  elevenlabs,
  initializeElevenLabs,
  VOICE_PRESETS,
  MODELS as VOICE_MODELS,
  type Voice,
  type VoiceSettings,
  type TextToSpeechOptions,
  type AudioResult,
  type ElevenLabsConfig,
} from './elevenlabs';

// ============================================================================
// MUX VIDEO
// ============================================================================

export {
  mux,
  initializeMux,
  type MuxAsset,
  type PlaybackId,
  type LiveStream,
  type MuxConfig,
} from './mux';

// ============================================================================
// ALGOLIA SEARCH
// ============================================================================

export {
  algolia,
  initializeAlgolia,
  INDICES as ALGOLIA_INDICES,
  type SearchOptions,
  type SearchResult,
  type BookSearchRecord,
  type AlgoliaConfig,
} from './algolia';

// ============================================================================
// INNGEST BACKGROUND JOBS
// ============================================================================

export {
  inngest,
  initializeInngest,
  EVENTS as INNGEST_EVENTS,
  type InngestEvent,
  type WorkflowOptions,
  type InngestConfig,
} from './inngest';

// ============================================================================
// POSTHOG ANALYTICS
// ============================================================================

export {
  posthog,
  initializePostHog,
  POSTHOG_EVENTS,
  type PostHogUser,
  type PostHogConfig,
} from './posthog';

// ============================================================================
// CLOUDINARY MEDIA
// ============================================================================

export {
  cloudinary,
  useCloudinaryImage,
  useResponsiveImage,
  type CloudinaryConfig,
  type CloudinaryTransformOptions,
  type CloudinaryUploadOptions,
  type CloudinaryUploadResult,
  type CloudinaryVideoThumbnailOptions,
  type CloudinaryAIOptions,
} from './cloudinary';
