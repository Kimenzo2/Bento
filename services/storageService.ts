import { BookProject, SavedBook } from '../types';
import { supabase } from './supabaseClient';
import { booksApi } from './api/books';

const STORAGE_KEY = 'genesis_saved_books';

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
};

/**
 * Load a specific book by ID
 */
export const loadBook = async (id: string): Promise<BookProject | null> => {
    try {
        const books = await getAllBooks();
        const savedBook = books.find(b => b.id === id);
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
    try {
        if (!forceLocal) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                return await booksApi.getUserBooks(session.user.id);
            }
        }

        // Fallback to LocalStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];

        const books = JSON.parse(stored);

        // Convert date strings back to Date objects
        return books.map((book: any) => ({
            ...book,
            savedAt: new Date(book.savedAt),
            lastModified: new Date(book.lastModified)
        }));
    } catch (error) {
        console.error('Failed to load books:', error);
        return [];
    }
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
    console.log('✅ All books cleared');
};
