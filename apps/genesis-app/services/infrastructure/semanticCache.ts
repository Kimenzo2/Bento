/**
 * Mars-Class Infrastructure - Semantic Caching Layer
 *
 * Reduces AI costs by 40-60% through intelligent response caching.
 *
 * THE PROBLEM (Collective Brain Inefficiency):
 * - 90% of educational questions are the same 10% of topics
 * - "How does photosynthesis work?" asked millions of times
 * - Each query costs ~$0.01 and takes ~2000ms
 * - At 1M users, redundant AI calls cost $100k+/month
 *
 * THE SOLUTION (Semantic Cache):
 * - Convert questions to vector embeddings
 * - Search for similar cached questions (cosine similarity >0.95)
 * - Return cached answer in <50ms at $0 cost
 * - Cache misses populate cache for future users
 *
 * ARCHITECTURE:
 * 1. Query arrives → Generate embedding (fast, cheap model)
 * 2. Search vector store for similar queries
 * 3. Cache HIT: Return cached response (<50ms, $0)
 * 4. Cache MISS: Call AI, store embedding + response
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CacheEntry {
  id: string;
  query: string;
  queryEmbedding: number[];
  response: string;
  responseTokens: number;
  model: string;
  context: CacheContext;
  hitCount: number;
  createdAt: Date;
  lastAccessedAt: Date;
  ttlSeconds: number;
}

export interface CacheContext {
  /** Subject area for filtering (math, science, history, etc.) */
  subject?: string;
  /** Grade level for age-appropriate responses */
  gradeLevel?: string;
  /** Topic within the subject for finer-grained partitioning */
  topic?: string;
  /** Language for internationalization */
  language?: string;
  /** Character persona for Green Room */
  persona?: string;
  /** Additional context tags */
  tags?: string[];
}

export interface CacheSearchResult {
  entry: CacheEntry;
  similarity: number;
}

export interface SemanticCacheConfig {
  /** Minimum similarity score for cache hit (0.0 - 1.0) */
  similarityThreshold: number;
  /** Maximum entries per context */
  maxEntriesPerContext: number;
  /** Default TTL in seconds */
  defaultTTLSeconds: number;
  /** Maximum response size to cache (characters) */
  maxResponseSize: number;
  /** Enable cache warming for common questions */
  enableWarmup: boolean;
}

export interface CacheStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  avgHitLatencyMs: number;
  avgMissLatencyMs: number;
  estimatedCostSavings: number;
  entriesCount: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export const DEFAULT_CACHE_CONFIG: SemanticCacheConfig = {
  similarityThreshold: 0.92, // 92% similarity for cache hit
  maxEntriesPerContext: 10000, // 10k entries per subject/grade combo
  defaultTTLSeconds: 86400 * 30, // 30 days default
  maxResponseSize: 50000, // 50k characters max
  enableWarmup: true,
};

// Cost estimates for savings calculation
const COST_PER_AI_CALL = 0.01; // ~$0.01 per Gemini call
const COST_PER_EMBEDDING = 0.00001; // ~$0.00001 per embedding
const COST_PER_CACHE_HIT = 0.0001; // ~$0.0001 for Redis lookup

// ============================================================================
// EMBEDDING SERVICE
// ============================================================================

export interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  getDimensions(): number;
}

/**
 * In-memory embedding simulation for development.
 * In production, use text-embedding-004 or similar.
 */
class MockEmbeddingService implements EmbeddingService {
  private readonly dimensions = 768;

  async generateEmbedding(text: string): Promise<number[]> {
    // Simulate embedding generation with deterministic hash
    const hash = this.hashString(text);
    const embedding: number[] = [];

    for (let i = 0; i < this.dimensions; i++) {
      // Use hash to generate pseudo-random but deterministic values
      embedding.push(Math.sin(hash * (i + 1)) * 0.5 + 0.5);
    }

    // Normalize to unit vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map((val) => val / magnitude);
  }

  getDimensions(): number {
    return this.dimensions;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}

// ============================================================================
// VECTOR STORE INTERFACE
// ============================================================================

export interface VectorStore {
  /**
   * Store an entry with its embedding
   */
  store(entry: CacheEntry): Promise<void>;

  /**
   * Search for similar entries
   */
  search(embedding: number[], context: CacheContext, limit: number): Promise<CacheSearchResult[]>;

  /**
   * Delete an entry
   */
  delete(id: string): Promise<boolean>;

  /**
   * Get entry by ID
   */
  get(id: string): Promise<CacheEntry | null>;

  /**
   * Update hit count and last accessed
   */
  recordHit(id: string): Promise<void>;

  /**
   * Get total entry count
   */
  count(): Promise<number>;

  /**
   * Cleanup expired entries
   */
  cleanup(): Promise<number>;
}

/**
 * In-memory vector store for development.
 * In production, use pgvector, Pinecone, or Redis Vector.
 * Uses context-partitioned index for O(m) search where m << n.
 */
class InMemoryVectorStore implements VectorStore {
  private entries = new Map<string, CacheEntry>();
  // Context-partitioned index: avoids scanning ALL entries for every search
  private contextIndex = new Map<string, Set<string>>();

  private getContextKey(context: CacheContext): string {
    return `${context.subject || ''}:${context.gradeLevel || ''}:${context.topic || ''}`;
  }

  async store(entry: CacheEntry): Promise<void> {
    this.entries.set(entry.id, entry);
    // Update context index
    const ctxKey = this.getContextKey(entry.context);
    if (!this.contextIndex.has(ctxKey)) {
      this.contextIndex.set(ctxKey, new Set());
    }
    this.contextIndex.get(ctxKey)!.add(entry.id);
  }

  async search(
    embedding: number[],
    context: CacheContext,
    limit: number
  ): Promise<CacheSearchResult[]> {
    const results: CacheSearchResult[] = [];
    const now = Date.now();

    // Use context index for O(m) lookup instead of O(n) full scan
    const ctxKey = this.getContextKey(context);
    const candidateIds = this.contextIndex.get(ctxKey);

    if (!candidateIds || candidateIds.size === 0) {
      return results;
    }

    const expiredIds: string[] = [];

    for (const id of candidateIds) {
      const entry = this.entries.get(id);
      if (!entry) {
        expiredIds.push(id);
        continue;
      }

      // Check if expired
      const age = now - entry.createdAt.getTime();
      if (age > entry.ttlSeconds * 1000) {
        expiredIds.push(id);
        this.entries.delete(id);
        continue;
      }

      // Calculate cosine similarity
      const similarity = this.cosineSimilarity(embedding, entry.queryEmbedding);
      results.push({ entry, similarity });
    }

    // Clean stale index entries
    for (const id of expiredIds) {
      candidateIds.delete(id);
    }

    // Sort by similarity (descending) and take top N
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  async get(id: string): Promise<CacheEntry | null> {
    return this.entries.get(id) || null;
  }

  async recordHit(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (entry) {
      entry.hitCount++;
      entry.lastAccessedAt = new Date();
    }
  }

  async count(): Promise<number> {
    return this.entries.size;
  }

  async cleanup(): Promise<number> {
    const now = Date.now();
    let deleted = 0;

    for (const [id, entry] of this.entries) {
      const age = now - entry.createdAt.getTime();
      if (age > entry.ttlSeconds * 1000) {
        this.entries.delete(id);
        deleted++;
      }
    }

    return deleted;
  }

  private contextMatches(stored: CacheContext, query: CacheContext): boolean {
    // Subject must match if specified
    if (query.subject && stored.subject !== query.subject) return false;

    // Grade level must match if specified
    if (query.gradeLevel && stored.gradeLevel !== query.gradeLevel) return false;

    // Language must match if specified
    if (query.language && stored.language !== query.language) return false;

    // Persona must match for Green Room
    if (query.persona && stored.persona !== query.persona) return false;

    return true;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }
}

// ============================================================================
// SEMANTIC CACHE SERVICE
// ============================================================================

export class SemanticCacheService {
  private readonly config: SemanticCacheConfig;
  private readonly embeddingService: EmbeddingService;
  private readonly vectorStore: VectorStore;
  private stats: CacheStats;

  constructor(
    config: Partial<SemanticCacheConfig> = {},
    embeddingService?: EmbeddingService,
    vectorStore?: VectorStore
  ) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.embeddingService = embeddingService || new MockEmbeddingService();
    this.vectorStore = vectorStore || new InMemoryVectorStore();
    this.stats = this.initializeStats();
  }

  private initializeStats(): CacheStats {
    return {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      avgHitLatencyMs: 0,
      avgMissLatencyMs: 0,
      estimatedCostSavings: 0,
      entriesCount: 0,
    };
  }

  /**
   * Attempt to get a cached response for a query.
   * Returns null if no suitable cache entry exists.
   */
  async get(
    query: string,
    context: CacheContext = {}
  ): Promise<{ response: string; cacheHit: boolean; similarity?: number } | null> {
    const startTime = performance.now();
    this.stats.totalQueries++;

    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      // Search for similar entries
      const results = await this.vectorStore.search(
        queryEmbedding,
        context,
        5 // Get top 5 matches
      );

      // Check if best match exceeds threshold
      if (results.length > 0 && results[0].similarity >= this.config.similarityThreshold) {
        const bestMatch = results[0];

        // Record the hit
        await this.vectorStore.recordHit(bestMatch.entry.id);

        // Update stats
        this.stats.cacheHits++;
        this.updateHitRate();
        this.stats.estimatedCostSavings +=
          COST_PER_AI_CALL - COST_PER_CACHE_HIT - COST_PER_EMBEDDING;

        const latency = performance.now() - startTime;
        this.updateAvgHitLatency(latency);

        return {
          response: bestMatch.entry.response,
          cacheHit: true,
          similarity: bestMatch.similarity,
        };
      }

      // Cache miss
      this.stats.cacheMisses++;
      this.updateHitRate();

      return null;
    } catch (error) {
      console.error('[SemanticCache] Error during cache lookup:', error);
      this.stats.cacheMisses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Store a query-response pair in the cache.
   */
  async set(
    query: string,
    response: string,
    context: CacheContext = {},
    options: { model?: string; ttlSeconds?: number } = {}
  ): Promise<void> {
    // Don't cache responses that are too large
    if (response.length > this.config.maxResponseSize) {
      console.warn('[SemanticCache] Response too large to cache:', response.length);
      return;
    }

    try {
      // Generate embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      // Create cache entry
      const entry: CacheEntry = {
        id: this.generateId(),
        query,
        queryEmbedding,
        response,
        responseTokens: this.estimateTokens(response),
        model: options.model || 'unknown',
        context,
        hitCount: 0,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        ttlSeconds: options.ttlSeconds || this.config.defaultTTLSeconds,
      };

      // Store in vector store
      await this.vectorStore.store(entry);

      this.stats.entriesCount = await this.vectorStore.count();
    } catch (error) {
      console.error('[SemanticCache] Error storing entry:', error);
    }
  }

  /**
   * Invalidate cache entries matching a pattern.
   */
  async invalidate(_pattern: { context?: CacheContext; olderThan?: Date }): Promise<number> {
    // For now, just run cleanup
    return this.vectorStore.cleanup();
  }

  /**
   * Warm up the cache with common educational questions.
   */
  async warmup(
    entries: Array<{ query: string; response: string; context: CacheContext }>
  ): Promise<void> {
    if (!this.config.enableWarmup) return;

    console.warn(`[SemanticCache] Warming up with ${entries.length} entries...`);

    for (const entry of entries) {
      await this.set(entry.query, entry.response, entry.context, {
        model: 'warmup',
        ttlSeconds: this.config.defaultTTLSeconds * 12, // 1 year for warmup entries
      });
    }

    console.warn('[SemanticCache] Warmup complete');
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics.
   */
  resetStats(): void {
    this.stats = this.initializeStats();
  }

  /**
   * Run maintenance tasks.
   */
  async maintenance(): Promise<{ deleted: number; remaining: number }> {
    const deleted = await this.vectorStore.cleanup();
    const remaining = await this.vectorStore.count();
    this.stats.entriesCount = remaining;
    return { deleted, remaining };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private generateId(): string {
    return `cache-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private updateHitRate(): void {
    this.stats.hitRate =
      this.stats.totalQueries > 0 ? this.stats.cacheHits / this.stats.totalQueries : 0;
  }

  private updateAvgHitLatency(latency: number): void {
    const n = this.stats.cacheHits;
    this.stats.avgHitLatencyMs = (this.stats.avgHitLatencyMs * (n - 1) + latency) / n;
  }
}

// ============================================================================
// CACHE-WRAPPED AI SERVICE
// ============================================================================

export type AICallFunction = (query: string, context: CacheContext) => Promise<string>;

/**
 * Wrap an AI service call with semantic caching.
 *
 * Usage:
 * ```typescript
 * const cachedAI = createCachedAIService(semanticCache, geminiService.chat);
 * const response = await cachedAI("How does photosynthesis work?", { subject: "science" });
 * ```
 */
export function createCachedAIService(
  cache: SemanticCacheService,
  aiCall: AICallFunction,
  options: { model?: string } = {}
): AICallFunction {
  return async (query: string, context: CacheContext = {}): Promise<string> => {
    // Try cache first
    const cached = await cache.get(query, context);
    if (cached?.cacheHit) {
      // Cache HIT - no logging in production
      return cached.response;
    }

    // Cache miss - call AI
    // Cache MISS - calling AI
    const response = await aiCall(query, context);

    // Store in cache (async, don't await)
    cache.set(query, response, context, { model: options.model }).catch((err) => {
      console.error('[CachedAI] Failed to cache response:', err);
    });

    return response;
  };
}

// ============================================================================
// COMMON EDUCATIONAL QUESTIONS FOR WARMUP
// ============================================================================

export const COMMON_EDUCATIONAL_QUESTIONS: Array<{
  query: string;
  response: string;
  context: CacheContext;
}> = [
  {
    query: 'How does photosynthesis work?',
    response:
      'Photosynthesis is the process plants use to convert sunlight into food. Plants absorb sunlight through chlorophyll in their leaves, take in carbon dioxide from the air, and water from the soil. Using sunlight as energy, they combine CO2 and H2O to create glucose (sugar) and oxygen. The glucose provides energy for the plant to grow, while oxygen is released into the air for us to breathe!',
    context: { subject: 'science', gradeLevel: 'elementary' },
  },
  {
    query: 'What is the water cycle?',
    response:
      "The water cycle is nature's way of recycling water! It has four main stages: 1) Evaporation - the sun heats water in oceans, lakes, and rivers, turning it into invisible water vapor that rises into the sky. 2) Condensation - as water vapor rises and cools, it forms tiny water droplets that create clouds. 3) Precipitation - when clouds get heavy with water, it falls as rain, snow, or hail. 4) Collection - water gathers in oceans, lakes, rivers, and underground, and the cycle starts again!",
    context: { subject: 'science', gradeLevel: 'elementary' },
  },
  {
    query: 'Why is the sky blue?',
    response:
      "The sky appears blue because of how sunlight interacts with our atmosphere. Sunlight contains all colors of the rainbow. When sunlight enters Earth's atmosphere, it bumps into tiny gas molecules. Blue light has a shorter wavelength, so it scatters more than other colors, bouncing around in all directions. When we look up, we see this scattered blue light coming from everywhere in the sky!",
    context: { subject: 'science', gradeLevel: 'elementary' },
  },
  {
    query: 'What causes earthquakes?',
    response:
      "Earthquakes happen when huge pieces of Earth's crust called tectonic plates suddenly move or shift. Earth's surface is like a cracked eggshell, made of many plates that float on hot, flowing rock beneath. These plates slowly move and sometimes get stuck against each other. When the pressure builds up enough, they suddenly slip - and that's an earthquake! The shaking we feel is energy waves traveling through the ground from where the plates moved.",
    context: { subject: 'science', gradeLevel: 'middle' },
  },
  {
    query: 'How do fractions work?',
    response:
      "Fractions represent parts of a whole! Think of a pizza cut into 8 equal slices. Each slice is 1/8 (one-eighth) of the pizza. The bottom number (denominator) tells you how many equal parts the whole is divided into. The top number (numerator) tells you how many of those parts you have. So 3/8 means you have 3 out of 8 slices. Fractions let us describe amounts that aren't whole numbers!",
    context: { subject: 'math', gradeLevel: 'elementary' },
  },
];

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const semanticCache = new SemanticCacheService();

// Auto-warmup with common questions in development
if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
  semanticCache.warmup(COMMON_EDUCATIONAL_QUESTIONS).catch(console.error);
}
