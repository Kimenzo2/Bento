import { supabase } from './supabaseClient';
import { BookProject } from '../types';

export interface ShareSettings {
    isPublic: boolean;
    allowDownload: boolean;
    expiresAt: string | null;
    password: string | null;
    viewCount: number;
}

export interface ShareLink {
    id: string;
    bookId: string;
    shortCode: string;
    settings: ShareSettings;
    createdAt: string;
    userId: string;
}

export const shareService = {
    /**
     * Create a new share link for a book
     */
    async createShareLink(bookId: string, settings: ShareSettings): Promise<string> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User must be logged in to share');

        // Generate a unique short code
        // In a real app, we might want to check for collisions, but 6 chars is usually enough for low volume
        const shortCode = Math.random().toString(36).substring(2, 8);
        
        const { error } = await supabase
            .from('shared_books')
            .insert({
                book_id: bookId,
                user_id: user.id,
                short_code: shortCode,
                settings: settings
            });

        if (error) throw error;
        return shortCode;
    },

    /**
     * Get an existing share link for a book (for the owner)
     */
    async getShareLink(bookId: string): Promise<ShareLink | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('shared_books')
            .select('*')
            .eq('book_id', bookId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        return {
            id: data.id,
            bookId: data.book_id,
            shortCode: data.short_code,
            settings: data.settings,
            createdAt: data.created_at,
            userId: data.user_id
        };
    },

    /**
     * Update settings for a share link
     */
    async updateShareSettings(shortCode: string, settings: ShareSettings): Promise<void> {
        const { error } = await supabase
            .from('shared_books')
            .update({ settings })
            .eq('short_code', shortCode);

        if (error) throw error;
    },

    /**
     * Get book data via share code (Public/Shared View)
     * Uses a secure RPC function to bypass RLS on the books table
     */
    async getSharedBook(shortCode: string): Promise<{ 
        book: BookProject, 
        settings: ShareSettings, 
        sharerName: string,
        shareId: string 
    } | null> {
        const { data, error } = await supabase
            .rpc('get_book_via_share', { code_param: shortCode });

        if (error) throw error;
        if (!data || data.length === 0) return null;

        const result = data[0];
        
        return {
            book: result.book_project_data,
            settings: result.share_settings,
            sharerName: result.sharer_name || 'Anonymous',
            shareId: result.share_id
        };
    },

    /**
     * Increment the view count for a share link
     */
    async incrementViewCount(shareId: string): Promise<void> {
        await supabase.rpc('increment_share_view_count', { share_id_param: shareId });
    },

    /**
     * Delete a share link
     */
    async deleteShareLink(shortCode: string): Promise<void> {
        const { error } = await supabase
            .from('shared_books')
            .delete()
            .eq('short_code', shortCode);

        if (error) throw error;
    }
};
