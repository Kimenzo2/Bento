import { BookProject, SavedBook } from '../types';
import { supabase } from './supabaseClient';
import { booksApi } from './api/books';
import { LRUCache, deduplicateRequest } from './performanceOptimizations';

const STORAGE_KEY = 'genesis_saved_books';

// PERFORMANCE: Cache for books to reduce localStorage/DB reads
const booksCache = new LRUCache<string, SavedBook[]>(10);
const singleBookCache = new LRUCache<string, BookProject>(50);
const CACHE_KEY_ALL_BOOKS = 'all_books';
let cacheInvalidated = true; // Flag to invalidate cache on save/delete

/**
 * Save a book to Supabase (if logged in) or localStorage
 */
export const saveBook = async (project: BookProject): Promise<void> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        // Prepare the book object
        const savedBook: SavedBook = {
            id: project.id,
            title: project.title,
            synopsis: project.synopsis || '',
            coverImage: project.chapters[0]?.pages[0]?.imageUrl,
            project: project,
            savedAt: new Date(),
            lastModified: new Date(),
            user_id: session?.user?.id
        };

        if (session?.user) {
            // Save to Supabase
            await booksApi.createBook(savedBook, session.user.id);
            console.log('✅ Book saved to Supabase:', project.title);
        } else {
            // Save to LocalStorage
            const books = await getAllBooks(false); // Force local fetch
            const existingIndex = books.findIndex(b => b.id === project.id);

            if (existingIndex >= 0) {
                books[existingIndex] = { ...savedBook, savedAt: books[existingIndex].savedAt };
            } else {
                books.push(savedBook);
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
            console.log('✅ Book saved to LocalStorage:', project.title);
        }
    } catch (error) {
        console.error('Failed to save book:', error);
        throw new Error('Failed to save book');
    }
    
    // PERFORMANCE: Invalidate cache after save
    cacheInvalidated = true;
    booksCache.delete(CACHE_KEY_ALL_BOOKS);
};

/**
 * Load a specific book by ID
 */
export const loadBook = async (id: string): Promise<BookProject | null> => {
    // PERFORMANCE: Check single book cache first
    const cachedBook = singleBookCache.get(id);
    if (cachedBook) {
        return cachedBook;
    }

    try {
        const books = await getAllBooks();
        const savedBook = books.find(b => b.id === id);
        if (savedBook?.project) {
            // Cache the loaded book
            singleBookCache.set(id, savedBook.project);
        }
        return savedBook ? savedBook.project : null;
    } catch (error) {
        console.error('Failed to load book:', error);
        return null;
    }
};

/**
 * Get all saved books (merges local and remote if needed, or just remote if logged in)
 * For now, we'll prioritize remote if logged in, or maybe show both?
 * Let's just show remote if logged in, local if not.
 */
export const getAllBooks = async (forceLocal: boolean = false): Promise<SavedBook[]> => {
    // PERFORMANCE: Use deduplication to prevent concurrent identical requests
    return deduplicateRequest('getAllBooks:' + forceLocal, async () => {
        // PERFORMANCE: Return cached books if available and not invalidated
        if (!cacheInvalidated && booksCache.has(CACHE_KEY_ALL_BOOKS)) {
            return booksCache.get(CACHE_KEY_ALL_BOOKS)!;
        }

        try {
            if (!forceLocal) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    const books = await booksApi.getUserBooks(session.user.id);
                    // Cache the result
                    booksCache.set(CACHE_KEY_ALL_BOOKS, books);
                    cacheInvalidated = false;
                    return books;
                }
            }

            // Fallback to LocalStorage
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return [];

            const parsedBooks = JSON.parse(stored);

            // Convert date strings back to Date objects
            const books = parsedBooks.map((book: any) => ({
                ...book,
                savedAt: new Date(book.savedAt),
                lastModified: new Date(book.lastModified)
            }));
            
            // Cache local books too
            booksCache.set(CACHE_KEY_ALL_BOOKS, books);
            cacheInvalidated = false;
            return books;
        } catch (error) {
            console.error('Failed to load books:', error);
            return [];
        }
    }, 5000); // 5 second deduplication window
};

/**
 * Delete a book by ID
 */
export const deleteBook = async (id: string): Promise<void> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
            await booksApi.delete(id);
            console.log('✅ Book deleted from Supabase:', id);
        } else {
            const books = await getAllBooks(true);
            const filtered = books.filter(b => b.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
            console.log('✅ Book deleted from LocalStorage:', id);
        }
        
        // PERFORMANCE: Invalidate cache after delete
        cacheInvalidated = true;
        booksCache.delete(CACHE_KEY_ALL_BOOKS);
        singleBookCache.delete(id);
    } catch (error) {
        console.error('Failed to delete book:', error);
        throw new Error('Failed to delete book');
    }
};

/**
 * Get total count of saved books
 */
export const getBookCount = async (): Promise<number> => {
    const books = await getAllBooks();
    return books.length;
};

/**
 * Clear all saved books (for testing/reset)
 */
export const clearAllBooks = async (): Promise<void> => {
    localStorage.removeItem(STORAGE_KEY);
    // PERFORMANCE: Clear caches
    booksCache.clear();
    singleBookCache.clear();
    cacheInvalidated = true;
    console.log('✅ All books cleared');
};
