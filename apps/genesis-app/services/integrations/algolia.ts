/**
 * Algolia Search Integration
 *
 * Lightning-fast search for books, content, and discovery.
 * Features: Typo tolerance, faceting, personalization, AI recommendations.
 *
 * @see https://www.algolia.com/doc
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SearchOptions {
  query: string;
  filters?: string;
  facets?: string[];
  facetFilters?: string | string[];
  page?: number;
  hitsPerPage?: number;
  attributesToRetrieve?: string[];
  attributesToHighlight?: string[];
  highlightPreTag?: string;
  highlightPostTag?: string;
  distinct?: boolean | number;
  analytics?: boolean;
  clickAnalytics?: boolean;
  userToken?: string;
  personalizationImpact?: number;
}

export interface SearchResult<T = Record<string, unknown>> {
  hits: Array<
    T & {
      objectID: string;
      _highlightResult?: Record<string, { value: string; matchLevel: string }>;
      _snippetResult?: Record<string, { value: string; matchLevel: string }>;
    }
  >;
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  processingTimeMS: number;
  query: string;
  facets?: Record<string, Record<string, number>>;
  queryID?: string;
}

export interface AlgoliaObject {
  objectID: string;
  [key: string]: unknown;
}

export interface BookSearchRecord {
  objectID: string;
  title: string;
  author: string;
  authorId: string;
  description: string;
  genre: string;
  tags: string[];
  language: string;
  coverUrl?: string;
  wordCount: number;
  chapterCount: number;
  rating: number;
  views: number;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AlgoliaConfig {
  appId: string;
  searchApiKey: string;
  writeApiKey?: string;
  indexPrefix?: string;
}

// ============================================================================
// INDEX NAMES
// ============================================================================

export const INDICES = {
  BOOKS: 'books',
  BOOKS_BY_POPULARITY: 'books_popularity_desc',
  BOOKS_BY_RATING: 'books_rating_desc',
  BOOKS_BY_DATE: 'books_created_at_desc',
  USERS: 'users',
  TEMPLATES: 'templates',
  HELP_ARTICLES: 'help_articles',
} as const;

// ============================================================================
// ALGOLIA SERVICE CLASS
// ============================================================================

class AlgoliaService {
  private initialized = false;
  private config: AlgoliaConfig | null = null;
  private searchClient: unknown = null;

  /**
   * Initialize Algolia with API keys
   */
  initialize(config?: Partial<AlgoliaConfig>): boolean {
    const appId = config?.appId || import.meta.env.VITE_ALGOLIA_APP_ID;
    const searchApiKey = config?.searchApiKey || import.meta.env.VITE_ALGOLIA_SEARCH_API_KEY;

    if (!appId || !searchApiKey) {
      return false;
    }

    this.config = {
      appId,
      searchApiKey,
      // Write key is server-only — never exposed to client bundle
      writeApiKey: config?.writeApiKey,
      indexPrefix: config?.indexPrefix || 'genesis_',
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
   * Get full index name with prefix
   */
  private getIndexName(index: string): string {
    return `${this.config?.indexPrefix || ''}${index}`;
  }

  /**
   * Make search API request
   */
  private async searchRequest<T>(index: string, options: SearchOptions): Promise<SearchResult<T>> {
    if (!this.config) {
      throw new Error('Algolia not initialized');
    }

    const response = await fetch(
      `https://${this.config.appId}-dsn.algolia.net/1/indexes/${this.getIndexName(index)}/query`,
      {
        method: 'POST',
        headers: {
          'X-Algolia-Application-Id': this.config.appId,
          'X-Algolia-API-Key': this.config.searchApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: options.query,
          filters: options.filters,
          facets: options.facets,
          facetFilters: options.facetFilters,
          page: options.page || 0,
          hitsPerPage: options.hitsPerPage || 20,
          attributesToRetrieve: options.attributesToRetrieve,
          attributesToHighlight: options.attributesToHighlight,
          highlightPreTag: options.highlightPreTag || '<mark>',
          highlightPostTag: options.highlightPostTag || '</mark>',
          distinct: options.distinct,
          analytics: options.analytics ?? true,
          clickAnalytics: options.clickAnalytics ?? true,
          userToken: options.userToken,
          personalizationImpact: options.personalizationImpact,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Algolia search error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Make write API request
   */
  private async writeRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.config?.writeApiKey) {
      throw new Error('Write API key not configured');
    }

    const response = await fetch(`https://${this.config.appId}.algolia.net/1${path}`, {
      method,
      headers: {
        'X-Algolia-Application-Id': this.config.appId,
        'X-Algolia-API-Key': this.config.writeApiKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Algolia write error: ${response.status}`);
    }

    return response.json();
  }

  // ============================================================================
  // SEARCH METHODS
  // ============================================================================

  /**
   * Search books
   */
  async searchBooks(
    query: string,
    options?: Partial<SearchOptions>
  ): Promise<SearchResult<BookSearchRecord>> {
    return this.searchRequest(INDICES.BOOKS, {
      query,
      facets: ['genre', 'language', 'tags'],
      attributesToRetrieve: [
        'objectID',
        'title',
        'author',
        'description',
        'genre',
        'tags',
        'language',
        'coverUrl',
        'rating',
        'views',
      ],
      attributesToHighlight: ['title', 'description'],
      ...options,
    });
  }

  /**
   * Search with filters
   */
  async searchBooksWithFilters(
    query: string,
    filters: {
      genre?: string;
      language?: string;
      minRating?: number;
      tags?: string[];
    }
  ): Promise<SearchResult<BookSearchRecord>> {
    const filterParts: string[] = ['isPublic:true'];

    if (filters.genre) {
      filterParts.push(`genre:"${filters.genre}"`);
    }
    if (filters.language) {
      filterParts.push(`language:"${filters.language}"`);
    }
    if (filters.minRating) {
      filterParts.push(`rating >= ${filters.minRating}`);
    }

    const facetFilters = filters.tags?.map((tag) => `tags:${tag}`);

    return this.searchBooks(query, {
      filters: filterParts.join(' AND '),
      facetFilters,
    });
  }

  /**
   * Get popular books (no query)
   */
  async getPopularBooks(limit = 10, genre?: string): Promise<SearchResult<BookSearchRecord>> {
    const filters = genre ? `isPublic:true AND genre:"${genre}"` : 'isPublic:true';

    return this.searchRequest(INDICES.BOOKS_BY_POPULARITY, {
      query: '',
      filters,
      hitsPerPage: limit,
    });
  }

  /**
   * Get recently added books
   */
  async getRecentBooks(limit = 10): Promise<SearchResult<BookSearchRecord>> {
    return this.searchRequest(INDICES.BOOKS_BY_DATE, {
      query: '',
      filters: 'isPublic:true',
      hitsPerPage: limit,
    });
  }

  /**
   * Search help articles
   */
  async searchHelp(query: string): Promise<
    SearchResult<{
      title: string;
      content: string;
      category: string;
      url: string;
    }>
  > {
    return this.searchRequest(INDICES.HELP_ARTICLES, {
      query,
      attributesToHighlight: ['title', 'content'],
      hitsPerPage: 10,
    });
  }

  // ============================================================================
  // INDEXING METHODS
  // ============================================================================

  /**
   * Index a book
   */
  async indexBook(book: BookSearchRecord): Promise<{ taskID: number }> {
    return this.writeRequest(
      'PUT',
      `/indexes/${this.getIndexName(INDICES.BOOKS)}/${book.objectID}`,
      book
    );
  }

  /**
   * Index multiple books
   */
  async indexBooks(books: BookSearchRecord[]): Promise<{ taskID: number }> {
    const requests = books.map((book) => ({
      action: 'updateObject',
      body: book,
    }));

    return this.writeRequest('POST', `/indexes/${this.getIndexName(INDICES.BOOKS)}/batch`, {
      requests,
    });
  }

  /**
   * Delete book from index
   */
  async deleteBook(bookId: string): Promise<{ taskID: number }> {
    return this.writeRequest('DELETE', `/indexes/${this.getIndexName(INDICES.BOOKS)}/${bookId}`);
  }

  /**
   * Partial update (only specified attributes)
   */
  async partialUpdateBook(
    bookId: string,
    attributes: Partial<BookSearchRecord>
  ): Promise<{ taskID: number }> {
    return this.writeRequest(
      'POST',
      `/indexes/${this.getIndexName(INDICES.BOOKS)}/${bookId}/partial`,
      attributes
    );
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  /**
   * Send click event for analytics
   */
  async sendClickEvent(
    userToken: string,
    eventName: string,
    index: string,
    objectIDs: string[],
    queryID?: string,
    positions?: number[]
  ): Promise<void> {
    if (!this.config) return;

    const event: Record<string, unknown> = {
      eventType: 'click',
      eventName,
      index: this.getIndexName(index),
      userToken,
      objectIDs,
      timestamp: Date.now(),
    };

    if (queryID) {
      event.queryID = queryID;
      event.positions = positions;
    }

    await fetch(`https://insights.algolia.io/1/events`, {
      method: 'POST',
      headers: {
        'X-Algolia-Application-Id': this.config.appId,
        'X-Algolia-API-Key': this.config.searchApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ events: [event] }),
    });
  }

  /**
   * Send conversion event
   */
  async sendConversionEvent(
    userToken: string,
    eventName: string,
    index: string,
    objectIDs: string[],
    queryID?: string
  ): Promise<void> {
    if (!this.config) return;

    const event: Record<string, unknown> = {
      eventType: 'conversion',
      eventName,
      index: this.getIndexName(index),
      userToken,
      objectIDs,
      timestamp: Date.now(),
    };

    if (queryID) {
      event.queryID = queryID;
    }

    await fetch(`https://insights.algolia.io/1/events`, {
      method: 'POST',
      headers: {
        'X-Algolia-Application-Id': this.config.appId,
        'X-Algolia-API-Key': this.config.searchApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ events: [event] }),
    });
  }

  // ============================================================================
  // AUTOCOMPLETE HELPERS
  // ============================================================================

  /**
   * Get search suggestions
   */
  async getSuggestions(query: string, limit = 5): Promise<string[]> {
    const result = await this.searchBooks(query, {
      hitsPerPage: limit,
      attributesToRetrieve: ['title'],
    });

    return result.hits.map((hit) => hit.title);
  }

  /**
   * Get instant search results for autocomplete
   */
  async instantSearch(query: string): Promise<{
    books: BookSearchRecord[];
    suggestions: string[];
    totalHits: number;
  }> {
    if (!query || query.length < 2) {
      return { books: [], suggestions: [], totalHits: 0 };
    }

    const result = await this.searchBooks(query, {
      hitsPerPage: 5,
    });

    return {
      books: result.hits,
      suggestions: result.hits.map((h) => h.title),
      totalHits: result.nbHits,
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const algolia = new AlgoliaService();

export function initializeAlgolia(config?: Partial<AlgoliaConfig>): boolean {
  return algolia.initialize(config);
}

export default algolia;
