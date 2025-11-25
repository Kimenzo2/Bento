import { BaseApiService, BaseEntity } from './base';
import { SavedBook, BookProject } from '../../types';
import { supabase } from '../supabaseClient';

// Interface for the Supabase table structure (snake_case)
interface BookEntity extends BaseEntity {
    title: string;
    synopsis: string;
    cover_image?: string;
    project_data: BookProject; // JSONB column
    user_id: string;
}

export class BooksApiService extends BaseApiService<BookEntity> {
    constructor() {
        super('books');
    }

    // Override create to map camelCase to snake_case
    async createBook(book: SavedBook, userId: string): Promise<BookEntity> {
        const entity = {
            id: book.id,
            title: book.title,
            synopsis: book.synopsis,
            cover_image: book.coverImage,
            project_data: book.project,
            user_id: userId,
            updated_at: new Date().toISOString()
        };

        // We use upsert to handle both create and update for simplicity with the same ID
        const { data, error } = await supabase
            .from(this.table)
            .upsert(entity)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async getUserBooks(userId: string): Promise<SavedBook[]> {
        const { data, error } = await supabase
            .from(this.table)
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        return (data || []).map(this.mapEntityToSavedBook);
    }

    private mapEntityToSavedBook(entity: BookEntity): SavedBook {
        return {
            id: entity.id,
            title: entity.title,
            synopsis: entity.synopsis,
            coverImage: entity.cover_image,
            project: entity.project_data,
            savedAt: new Date(entity.created_at || new Date()),
            lastModified: new Date(entity.updated_at || new Date()),
            user_id: entity.user_id
        };
    }
}

export const booksApi = new BooksApiService();
