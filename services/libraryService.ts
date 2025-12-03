import { supabase } from './supabaseClient';
import { InfographicData } from '../types/infographic';

// Storage keys
const INFOGRAPHICS_KEY = 'genesis_saved_infographics';
const IMAGES_KEY = 'genesis_saved_images';

// Types
export interface SavedInfographic {
    id: string;
    title: string;
    topic: string;
    type: string;
    style: string;
    thumbnailUrl?: string;
    data: InfographicData;
    savedAt: Date;
    user_id?: string;
}

export interface SavedImage {
    id: string;
    title: string;
    prompt: string;
    imageUrl: string;
    style: string;
    savedAt: Date;
    user_id?: string;
}

// ===================== INFOGRAPHICS =====================

/**
 * Save an infographic to localStorage (Supabase integration can be added later)
 */
export const saveInfographic = async (data: InfographicData): Promise<void> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const savedInfographic: SavedInfographic = {
            id: data.id || `infographic_${Date.now()}`,
            title: data.title,
            topic: data.topic,
            type: data.type,
            style: data.style,
            data: data,
            savedAt: new Date(),
            user_id: session?.user?.id
        };

        const infographics = await getAllInfographics();
        const existingIndex = infographics.findIndex(i => i.id === savedInfographic.id);

        if (existingIndex >= 0) {
            infographics[existingIndex] = { ...savedInfographic, savedAt: infographics[existingIndex].savedAt };
        } else {
            infographics.unshift(savedInfographic); // Add to beginning
        }

        localStorage.setItem(INFOGRAPHICS_KEY, JSON.stringify(infographics));
        console.log('✅ Infographic saved:', data.title);
    } catch (error) {
        console.error('Failed to save infographic:', error);
        throw new Error('Failed to save infographic');
    }
};

/**
 * Get all saved infographics
 */
export const getAllInfographics = async (): Promise<SavedInfographic[]> => {
    try {
        const stored = localStorage.getItem(INFOGRAPHICS_KEY);
        if (!stored) return [];

        const infographics = JSON.parse(stored);
        return infographics.map((item: any) => ({
            ...item,
            savedAt: new Date(item.savedAt)
        }));
    } catch (error) {
        console.error('Failed to load infographics:', error);
        return [];
    }
};

/**
 * Delete an infographic by ID
 */
export const deleteInfographic = async (id: string): Promise<void> => {
    try {
        const infographics = await getAllInfographics();
        const filtered = infographics.filter(i => i.id !== id);
        localStorage.setItem(INFOGRAPHICS_KEY, JSON.stringify(filtered));
        console.log('✅ Infographic deleted:', id);
    } catch (error) {
        console.error('Failed to delete infographic:', error);
        throw new Error('Failed to delete infographic');
    }
};

// ===================== IMAGES =====================

/**
 * Save an image to localStorage
 */
export const saveImage = async (image: Omit<SavedImage, 'id' | 'savedAt' | 'user_id'>): Promise<void> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const savedImage: SavedImage = {
            id: `image_${Date.now()}`,
            ...image,
            savedAt: new Date(),
            user_id: session?.user?.id
        };

        const images = await getAllImages();
        images.unshift(savedImage);

        localStorage.setItem(IMAGES_KEY, JSON.stringify(images));
        console.log('✅ Image saved:', image.title);
    } catch (error) {
        console.error('Failed to save image:', error);
        throw new Error('Failed to save image');
    }
};

/**
 * Get all saved images
 */
export const getAllImages = async (): Promise<SavedImage[]> => {
    try {
        const stored = localStorage.getItem(IMAGES_KEY);
        if (!stored) return [];

        const images = JSON.parse(stored);
        return images.map((item: any) => ({
            ...item,
            savedAt: new Date(item.savedAt)
        }));
    } catch (error) {
        console.error('Failed to load images:', error);
        return [];
    }
};

/**
 * Delete an image by ID
 */
export const deleteImage = async (id: string): Promise<void> => {
    try {
        const images = await getAllImages();
        const filtered = images.filter(i => i.id !== id);
        localStorage.setItem(IMAGES_KEY, JSON.stringify(filtered));
        console.log('✅ Image deleted:', id);
    } catch (error) {
        console.error('Failed to delete image:', error);
        throw new Error('Failed to delete image');
    }
};

// ===================== LIBRARY STATS =====================

export const getLibraryStats = async () => {
    const [infographics, images] = await Promise.all([
        getAllInfographics(),
        getAllImages()
    ]);

    return {
        infographicsCount: infographics.length,
        imagesCount: images.length,
        totalItems: infographics.length + images.length
    };
};
