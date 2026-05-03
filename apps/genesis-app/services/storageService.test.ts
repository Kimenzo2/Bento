import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
const mockExistsForUser = vi.fn();
const mockCreateBook = vi.fn();
const mockTrackAction = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock('./api/books', () => ({
  booksApi: {
    existsForUser: mockExistsForUser,
    createBook: mockCreateBook,
  },
}));

vi.mock('./performanceOptimizations', () => ({
  LRUCache: class {
    private store = new Map<string, unknown>();

    constructor(_maxSize: number) {}

    get(key: string) {
      return this.store.get(key);
    }

    set(key: string, value: unknown) {
      this.store.set(key, value);
    }

    has(key: string) {
      return this.store.has(key);
    }

    delete(key: string) {
      this.store.delete(key);
    }

    clear() {
      this.store.clear();
    }
  },
  deduplicateRequest: async <T>(_key: string, fn: () => Promise<T>) => fn(),
}));

vi.mock('../src/services/mastraClient', () => ({
  mastra: {
    agents: {
      gamification: {
        trackAction: mockTrackAction,
      },
    },
  },
}));

import { saveBook } from './storageService';

describe('storageService.saveBook', () => {
  const project = {
    id: 'book-1',
    title: 'Genesis Test Book',
    synopsis: 'Synopsis',
    chapters: [
      {
        pages: [
          {
            pageNumber: 1,
            imageUrl: 'https://example.com/cover.png',
          },
        ],
      },
    ],
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateBook.mockResolvedValue({});
    mockTrackAction.mockResolvedValue({});
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-1',
          },
        },
      },
    });
  });

  it('tracks book_created for first-time authenticated saves only', async () => {
    mockExistsForUser.mockResolvedValue(false);

    await saveBook(project);

    expect(mockExistsForUser).toHaveBeenCalledWith('book-1', 'user-1');
    expect(mockCreateBook).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'book-1' }),
      'user-1'
    );
    expect(mockTrackAction).toHaveBeenCalledWith(
      'book_created',
      expect.objectContaining({ bookId: 'book-1', title: 'Genesis Test Book' })
    );
  });

  it('does not track book_created when saving an existing authenticated book', async () => {
    mockExistsForUser.mockResolvedValue(true);

    await saveBook(project);

    expect(mockCreateBook).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'book-1' }),
      'user-1'
    );
    expect(mockTrackAction).not.toHaveBeenCalled();
  });
});
