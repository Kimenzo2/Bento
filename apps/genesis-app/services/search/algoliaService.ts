/**
 * @module AlgoliaService
 * @description Production-grade search service powered by Algolia for Genesis Platform
 *
 * Features:
 * - Full-text search for books, templates, and users
 * - Autocomplete suggestions
 * - Faceted filtering by genre, author, visibility
 * - Circuit breaker integration for resilience
 * - Audit logging for search analytics
 *
 * Security:
 * - Search API Key: Public, safe for frontend (read-only)
 * - Write API Key: Private, server-side only (write operations)
 */

import { algoliasearch } from 'algoliasearch';
import { logger } from '../logger';
import { type AppError, type Result, safeCall } from '../serviceWrapper';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ALGOLIA_APP_ID = import.meta.env.VITE_ALGOLIA_APP_ID || '';
const ALGOLIA_SEARCH_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_KEY || '';
// SECURITY: Write key is server-only — never exposed to client bundle
const ALGOLIA_WRITE_KEY = '';

// Lazy initialization to avoid errors if keys are missing
let _searchClient: ReturnType<typeof algoliasearch> | null = null;
let _writeClient: ReturnType<typeof algoliasearch> | null = null;

function getSearchClient() {
  if (!_searchClient) {
    _searchClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY);
  }
  return _searchClient;
}

function getWriteClient() {
  if (!_writeClient) {
    _writeClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_WRITE_KEY);
  }
  return _writeClient;
}

// ============================================================================
// INDEX NAMES
// ============================================================================

export const INDEXES = {
  BOOKS: 'genesis_books',
  USERS: 'genesis_users',
  TEMPLATES: 'genesis_templates',
  PUBLIC_LIBRARY: 'genesis_public_library',
} as const;

export type IndexName = (typeof INDEXES)[keyof typeof INDEXES];

// ============================================================================
// TYPES
// ============================================================================

export interface SearchableBook {
  objectID: string;
  title: string;
  synopsis: string;
  genre?: string;
  author: string;
  authorId: string;
  coverImage?: string;
  createdAt: string;
  updatedAt?: string;
  isPublic: boolean;
  chapterCount?: number;
  wordCount?: number;
  tags?: string[];
  language?: string;
}

export interface SearchableUser {
  objectID: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  bookCount: number;
  joinedAt: string;
  isVerified?: boolean;
}

export interface SearchableTemplate {
  objectID: string;
  name: string;
  description: string;
  genre: string;
  category: string;
  previewImage?: string;
  usageCount: number;
  isPremium: boolean;
}

export interface SearchResult<T> {
  hits: T[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  query: string;
  processingTimeMs: number;
}

export interface AlgoliaHealthStatus {
  connected: boolean;
  appId: string;
  searchKeyValid: boolean;
  writeKeyValid: boolean;
  indexes: {
    name: string;
    exists: boolean;
    entries?: number;
  }[];
  latencyMs: number;
  error?: string;
}

// ============================================================================
// CONNECTION & HEALTH CHECK
// ============================================================================

/**
 * Test Algolia connection and return health status
 */
export async function checkAlgoliaHealth(): Promise<AlgoliaHealthStatus> {
  const startTime = Date.now();
  const status: AlgoliaHealthStatus = {
    connected: false,
    appId: ALGOLIA_APP_ID,
    searchKeyValid: false,
    writeKeyValid: false,
    indexes: [],
    latencyMs: 0,
  };

  try {
    // Test search client
    const searchClient = getSearchClient();

    // Try to search (validates search key)
    try {
      await searchClient.searchSingleIndex({
        indexName: INDEXES.BOOKS,
        searchParams: { query: '', hitsPerPage: 1 },
      });
      status.searchKeyValid = true;
    } catch (searchError) {
      // Index might not exist yet, but key might still be valid
      const errorMsg = searchError instanceof Error ? searchError.message : String(searchError);
      if (!errorMsg.includes('Invalid API key')) {
        status.searchKeyValid = true;
      }
    }

    // Test write client by listing indexes
    try {
      const writeClient = getWriteClient();
      const indexesResponse = await writeClient.listIndices();
      status.writeKeyValid = true;
      status.connected = true;

      // Map existing indexes
      const existingIndexes = new Set(indexesResponse.items?.map((i) => i.name) || []);

      for (const indexName of Object.values(INDEXES)) {
        const indexInfo = indexesResponse.items?.find((i) => i.name === indexName);
        status.indexes.push({
          name: indexName,
          exists: existingIndexes.has(indexName),
          entries: indexInfo?.entries,
        });
      }
    } catch (writeError) {
      const errorMsg = writeError instanceof Error ? writeError.message : String(writeError);
      if (errorMsg.includes('Invalid API key')) {
        status.writeKeyValid = false;
      }
      status.error = errorMsg;
    }

    status.latencyMs = Date.now() - startTime;

    logger.info('Algolia health check completed', {
      component: 'AlgoliaService',
      connected: status.connected,
      latencyMs: status.latencyMs,
    });

    return status;
  } catch (error) {
    status.latencyMs = Date.now() - startTime;
    status.error = error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      'Algolia health check failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        component: 'AlgoliaService',
      }
    );

    return status;
  }
}

/**
 * Initialize Algolia indexes with proper settings
 * Run this once during app setup or deployment
 */
export async function initializeAlgoliaIndexes(): Promise<{ success: boolean; message: string }> {
  try {
    const writeClient = getWriteClient();

    // Configure books index
    await writeClient.setSettings({
      indexName: INDEXES.BOOKS,
      indexSettings: {
        searchableAttributes: ['title', 'synopsis', 'genre', 'author', 'tags'],
        attributesForFaceting: [
          'filterOnly(isPublic)',
          'filterOnly(authorId)',
          'searchable(genre)',
          'searchable(tags)',
          'language',
        ],
        customRanking: ['desc(updatedAt)', 'desc(wordCount)'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>',
      },
    });

    // Configure users index
    await writeClient.setSettings({
      indexName: INDEXES.USERS,
      indexSettings: {
        searchableAttributes: ['displayName', 'bio'],
        attributesForFaceting: ['filterOnly(isVerified)'],
        customRanking: ['desc(bookCount)'],
      },
    });

    // Configure templates index
    await writeClient.setSettings({
      indexName: INDEXES.TEMPLATES,
      indexSettings: {
        searchableAttributes: ['name', 'description', 'genre', 'category'],
        attributesForFaceting: [
          'searchable(genre)',
          'searchable(category)',
          'filterOnly(isPremium)',
        ],
        customRanking: ['desc(usageCount)'],
      },
    });

    logger.info('Algolia indexes initialized successfully', {
      component: 'AlgoliaService',
      indexes: Object.values(INDEXES),
    });

    return { success: true, message: 'All indexes configured successfully' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      'Failed to initialize Algolia indexes',
      error instanceof Error ? error : new Error(message),
      {
        component: 'AlgoliaService',
      }
    );
    return { success: false, message };
  }
}

// ============================================================================
// SEARCH OPERATIONS (Frontend-safe)
// ============================================================================

/**
 * Search books with full-text search
 */
export async function searchBooks(
  query: string,
  options: {
    page?: number;
    hitsPerPage?: number;
    filters?: string;
    genre?: string;
    authorId?: string;
    includePrivate?: boolean;
  } = {}
): Promise<Result<SearchResult<SearchableBook>, AppError>> {
  const { page = 0, hitsPerPage = 20, filters, genre, authorId, includePrivate = false } = options;

  return safeCall(
    async () => {
      const startTime = Date.now();

      // Build filter string
      const filterParts: string[] = [];
      if (!includePrivate) filterParts.push('isPublic:true');
      if (genre) filterParts.push(`genre:"${genre}"`);
      if (authorId) filterParts.push(`authorId:"${authorId}"`);
      if (filters) filterParts.push(filters);

      const searchClient = getSearchClient();
      const result = await searchClient.searchSingleIndex({
        indexName: INDEXES.BOOKS,
        searchParams: {
          query,
          page,
          hitsPerPage,
          filters: filterParts.length > 0 ? filterParts.join(' AND ') : undefined,
          attributesToHighlight: ['title', 'synopsis'],
        },
      });

      const processingTimeMs = Date.now() - startTime;

      logger.debug('Book search completed', {
        component: 'AlgoliaService',
        query,
        hits: result.nbHits,
        processingTimeMs,
      });

      return {
        hits: result.hits as SearchableBook[],
        nbHits: result.nbHits || 0,
        page: result.page || 0,
        nbPages: result.nbPages || 0,
        hitsPerPage: result.hitsPerPage || hitsPerPage,
        query,
        processingTimeMs,
      };
    },
    { context: 'searchBooks' }
  );
}

/**
 * Search users
 */
export async function searchUsers(
  query: string,
  options: { page?: number; hitsPerPage?: number } = {}
): Promise<Result<SearchResult<SearchableUser>, AppError>> {
  const { page = 0, hitsPerPage = 20 } = options;

  return safeCall(
    async () => {
      const startTime = Date.now();
      const searchClient = getSearchClient();

      const result = await searchClient.searchSingleIndex({
        indexName: INDEXES.USERS,
        searchParams: {
          query,
          page,
          hitsPerPage,
        },
      });

      return {
        hits: result.hits as SearchableUser[],
        nbHits: result.nbHits || 0,
        page: result.page || 0,
        nbPages: result.nbPages || 0,
        hitsPerPage: result.hitsPerPage || hitsPerPage,
        query,
        processingTimeMs: Date.now() - startTime,
      };
    },
    { context: 'searchUsers' }
  );
}

/**
 * Search templates
 */
export async function searchTemplates(
  query: string,
  options: {
    page?: number;
    hitsPerPage?: number;
    genre?: string;
    category?: string;
    includePremium?: boolean;
  } = {}
): Promise<Result<SearchResult<SearchableTemplate>, AppError>> {
  const { page = 0, hitsPerPage = 20, genre, category, includePremium = true } = options;

  return safeCall(
    async () => {
      const startTime = Date.now();
      const searchClient = getSearchClient();

      const filterParts: string[] = [];
      if (genre) filterParts.push(`genre:"${genre}"`);
      if (category) filterParts.push(`category:"${category}"`);
      if (!includePremium) filterParts.push('isPremium:false');

      const result = await searchClient.searchSingleIndex({
        indexName: INDEXES.TEMPLATES,
        searchParams: {
          query,
          page,
          hitsPerPage,
          filters: filterParts.length > 0 ? filterParts.join(' AND ') : undefined,
        },
      });

      return {
        hits: result.hits as SearchableTemplate[],
        nbHits: result.nbHits || 0,
        page: result.page || 0,
        nbPages: result.nbPages || 0,
        hitsPerPage: result.hitsPerPage || hitsPerPage,
        query,
        processingTimeMs: Date.now() - startTime,
      };
    },
    { context: 'searchTemplates' }
  );
}

/**
 * Get autocomplete suggestions
 */
export async function getSearchSuggestions(
  query: string,
  options: { limit?: number; index?: IndexName } = {}
): Promise<string[]> {
  const { limit = 5, index = INDEXES.BOOKS } = options;

  if (!query || query.length < 2) return [];

  try {
    const searchClient = getSearchClient();
    const result = await searchClient.searchSingleIndex({
      indexName: index,
      searchParams: {
        query,
        hitsPerPage: limit,
        attributesToRetrieve: ['title', 'name', 'displayName'],
        filters: index === INDEXES.BOOKS ? 'isPublic:true' : undefined,
      },
    });

    // Return the appropriate field based on index
    return (result.hits as Array<{ title?: string; name?: string; displayName?: string }>)
      .map((hit) => hit.title || hit.name || hit.displayName || '')
      .filter(Boolean);
  } catch (error) {
    logger.warn('Search suggestions failed', {
      component: 'AlgoliaService',
      query,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Multi-index search (search across all indexes at once)
 */
export async function searchAll(
  query: string,
  options: { hitsPerPage?: number } = {}
): Promise<{
  books: SearchableBook[];
  users: SearchableUser[];
  templates: SearchableTemplate[];
}> {
  const { hitsPerPage = 5 } = options;

  try {
    const searchClient = getSearchClient();
    const results = await searchClient.search({
      requests: [
        {
          indexName: INDEXES.BOOKS,
          query,
          hitsPerPage,
          filters: 'isPublic:true',
        },
        {
          indexName: INDEXES.USERS,
          query,
          hitsPerPage,
        },
        {
          indexName: INDEXES.TEMPLATES,
          query,
          hitsPerPage,
        },
      ],
    });

    const bookResults = results.results[0];
    const userResults = results.results[1];
    const templateResults = results.results[2];

    return {
      books: 'hits' in bookResults ? (bookResults.hits as SearchableBook[]) : [],
      users: 'hits' in userResults ? (userResults.hits as SearchableUser[]) : [],
      templates: 'hits' in templateResults ? (templateResults.hits as SearchableTemplate[]) : [],
    };
  } catch (error) {
    logger.error(
      'Multi-index search failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        component: 'AlgoliaService',
      }
    );
    return { books: [], users: [], templates: [] };
  }
}

// ============================================================================
// WRITE OPERATIONS (Server-side / Admin only)
// ============================================================================

/**
 * Index a book for search
 */
export async function indexBook(book: SearchableBook): Promise<Result<void, AppError>> {
  return safeCall(
    async () => {
      const writeClient = getWriteClient();
      await writeClient.saveObject({
        indexName: INDEXES.BOOKS,
        body: book,
      });

      logger.info('Book indexed', {
        component: 'AlgoliaService',
        bookId: book.objectID,
        title: book.title,
      });
    },
    { context: 'indexBook' }
  );
}

/**
 * Index multiple books in batch
 */
export async function indexBooks(books: SearchableBook[]): Promise<Result<void, AppError>> {
  return safeCall(
    async () => {
      const writeClient = getWriteClient();
      await writeClient.saveObjects({
        indexName: INDEXES.BOOKS,
        objects: books.map((book) => ({ ...book }) as Record<string, unknown>),
      });

      logger.info('Books batch indexed', {
        component: 'AlgoliaService',
        count: books.length,
      });
    },
    { context: 'indexBooks' }
  );
}

/**
 * Index a user for search
 */
export async function indexUser(user: SearchableUser): Promise<Result<void, AppError>> {
  return safeCall(
    async () => {
      const writeClient = getWriteClient();
      await writeClient.saveObject({
        indexName: INDEXES.USERS,
        body: user,
      });
    },
    { context: 'indexUser' }
  );
}

/**
 * Index a template for search
 */
export async function indexTemplate(template: SearchableTemplate): Promise<Result<void, AppError>> {
  return safeCall(
    async () => {
      const writeClient = getWriteClient();
      await writeClient.saveObject({
        indexName: INDEXES.TEMPLATES,
        body: template,
      });
    },
    { context: 'indexTemplate' }
  );
}

/**
 * Remove a record from any index
 */
export async function removeFromIndex(
  indexName: IndexName,
  objectID: string
): Promise<Result<void, AppError>> {
  return safeCall(
    async () => {
      const writeClient = getWriteClient();
      await writeClient.deleteObject({
        indexName,
        objectID,
      });

      logger.info('Record removed from index', {
        component: 'AlgoliaService',
        indexName,
        objectID,
      });
    },
    { context: 'removeFromIndex' }
  );
}

/**
 * Update a record in any index
 */
export async function updateInIndex<T extends Record<string, unknown>>(
  indexName: IndexName,
  objectID: string,
  updates: Partial<T>
): Promise<Result<void, AppError>> {
  return safeCall(
    async () => {
      const writeClient = getWriteClient();
      await writeClient.partialUpdateObject({
        indexName,
        objectID,
        attributesToUpdate: updates,
      });
    },
    { context: 'updateInIndex' }
  );
}

// ============================================================================
// SYNC HELPERS (for keeping Supabase and Algolia in sync)
// ============================================================================

/**
 * Sync a book from Supabase to Algolia
 */
export function bookToSearchable(
  book: {
    id: string;
    title: string;
    synopsis?: string;
    cover_image?: string;
    project_data?: {
      genre?: string;
      chapters?: Array<{ content?: string }>;
    };
    user_id: string;
    created_at: string;
    updated_at?: string;
  },
  author: { display_name?: string } | null,
  isPublic: boolean
): SearchableBook {
  // Calculate word count from chapters
  const wordCount =
    book.project_data?.chapters?.reduce((acc, ch) => {
      return acc + (ch.content?.split(/\s+/).length || 0);
    }, 0) || 0;

  return {
    objectID: book.id,
    title: book.title,
    synopsis: book.synopsis || '',
    genre: book.project_data?.genre,
    author: author?.display_name || 'Anonymous',
    authorId: book.user_id,
    coverImage: book.cover_image,
    createdAt: book.created_at,
    updatedAt: book.updated_at,
    isPublic,
    chapterCount: book.project_data?.chapters?.length || 0,
    wordCount,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export { getSearchClient, getWriteClient };
