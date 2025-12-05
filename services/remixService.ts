/**
 * Remix Service
 * 
 * Handles the "Genesis Remix" feature - allowing users to fork and remix worlds.
 * Features:
 * 1. Publishing worlds as "Open Source"
 * 2. Forking worlds with lineage tracking
 * 3. Credit attribution chain
 * 4. Discovering remixable worlds
 */

import { 
    RemixableWorld, 
    WorldFork, 
    RemixCredits,
    BookProject
} from '../types';
import { supabase } from './supabaseClient';

// Helper to generate UUID v4 (compatible with Supabase UUID columns)
const generateUUID = () => { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { const r = Math.random() * 16 | 0; const v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }); };

export interface WorldSearchFilters {
    tags?: string[];
    era?: string;
    license?: 'open' | 'attribution' | 'non-commercial' | 'restricted';
    sortBy?: 'popular' | 'recent' | 'trending';
    limit?: number;
}

export const remixService = {
    /**
     * Convert a BookProject into a RemixableWorld
     */
    createWorldFromProject(
        project: BookProject, 
        userId: string, 
        userName: string,
        settings: {
            isPublic?: boolean;
            allowRemix?: boolean;
            requireCredit?: boolean;
            license?: 'open' | 'attribution' | 'non-commercial' | 'restricted';
            description?: string;
            tags?: string[];
            magicSystem?: string;
            era?: string;
            rules?: string[];
        } = {}
    ): RemixableWorld {
        // Extract locations from chapters/pages
        const locations = (project.storyBible?.entities || [])
            .filter(e => e.type === 'location')
            .map(loc => ({
                id: loc.id,
                name: loc.name,
                description: loc.description,
                visualDescription: loc.visualTraits
            }));

        // Extract lore from themes and story
        const lore = [
            project.synopsis,
            ...(project.storyBible?.globalThemes || [])
        ].join('\n\n');

        return {
            id: generateUUID(),
            name: `${project.title} World`,
            description: settings.description || `The world of "${project.title}"`,
            coverImage: project.coverImage,
            creatorId: userId,
            creatorName: userName,
            
            magicSystem: settings.magicSystem || '',
            locations,
            lore,
            rules: settings.rules || [],
            era: settings.era || 'Fantasy',
            
            isPublic: settings.isPublic ?? true,
            allowRemix: settings.allowRemix ?? true,
            requireCredit: settings.requireCredit ?? true,
            license: settings.license || 'attribution',
            
            totalRemixes: 0,
            totalLikes: 0,
            totalViews: 0,
            tags: settings.tags || [],
            
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    },

    /**
     * Publish a world to the public gallery
     */
    async publishWorld(world: RemixableWorld): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('remixable_worlds')
                .upsert({
                    id: world.id,
                    name: world.name,
                    description: world.description,
                    cover_image: world.coverImage,
                    creator_id: world.creatorId,
                    creator_name: world.creatorName,
                    magic_system: world.magicSystem,
                    locations: world.locations,
                    lore: world.lore,
                    rules: world.rules,
                    era: world.era,
                    is_public: world.isPublic,
                    allow_remix: world.allowRemix,
                    require_credit: world.requireCredit,
                    license: world.license,
                    total_remixes: world.totalRemixes,
                    total_likes: world.totalLikes,
                    total_views: world.totalViews,
                    tags: world.tags,
                    created_at: new Date(world.createdAt).toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            return { success: true };
        } catch (error: any) {
            console.error('Error publishing world:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Fork a world to create your own version
     */
    async forkWorld(
        originalWorld: RemixableWorld,
        userId: string,
        userName: string,
        modifications?: Partial<RemixableWorld>
    ): Promise<{ world: RemixableWorld; fork: WorldFork } | null> {
        try {
            // Create the forked world
            const forkedWorld: RemixableWorld = {
                ...originalWorld,
                ...modifications,
                id: generateUUID(),
                creatorId: userId,
                creatorName: userName,
                totalRemixes: 0,
                totalLikes: 0,
                totalViews: 0,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            // Get the ancestor chain
            const existingFork = await this.getWorldFork(originalWorld.id);
            const ancestorChain = existingFork 
                ? [...existingFork.ancestorChain, originalWorld.id]
                : [originalWorld.id];

            // Create fork record
            const fork: WorldFork = {
                id: generateUUID(),
                parentWorldId: originalWorld.id,
                parentWorldName: originalWorld.name,
                originalCreatorId: originalWorld.creatorId,
                originalCreatorName: originalWorld.creatorName,
                forkedWorldId: forkedWorld.id,
                forkedByUserId: userId,
                forkedByUserName: userName,
                generationNumber: ancestorChain.length,
                ancestorChain,
                createdAt: Date.now()
            };

            // Save to Supabase
            const [worldResult, forkResult] = await Promise.all([
                supabase.from('remixable_worlds').insert({
                    id: forkedWorld.id,
                    name: forkedWorld.name,
                    description: forkedWorld.description,
                    cover_image: forkedWorld.coverImage,
                    creator_id: forkedWorld.creatorId,
                    creator_name: forkedWorld.creatorName,
                    magic_system: forkedWorld.magicSystem,
                    locations: forkedWorld.locations,
                    lore: forkedWorld.lore,
                    rules: forkedWorld.rules,
                    era: forkedWorld.era,
                    is_public: forkedWorld.isPublic,
                    allow_remix: forkedWorld.allowRemix,
                    require_credit: forkedWorld.requireCredit,
                    license: forkedWorld.license,
                    total_remixes: 0,
                    total_likes: 0,
                    total_views: 0,
                    tags: forkedWorld.tags,
                    created_at: new Date(forkedWorld.createdAt).toISOString(),
                    updated_at: new Date().toISOString()
                }),
                supabase.from('world_forks').insert({
                    id: fork.id,
                    parent_world_id: fork.parentWorldId,
                    parent_world_name: fork.parentWorldName,
                    original_creator_id: fork.originalCreatorId,
                    original_creator_name: fork.originalCreatorName,
                    forked_world_id: fork.forkedWorldId,
                    forked_by_user_id: fork.forkedByUserId,
                    forked_by_user_name: fork.forkedByUserName,
                    generation_number: fork.generationNumber,
                    ancestor_chain: fork.ancestorChain,
                    created_at: new Date(fork.createdAt).toISOString()
                })
            ]);

            if (worldResult.error) throw worldResult.error;
            if (forkResult.error) throw forkResult.error;

            // Increment remix count on original
            await supabase.rpc('increment_remix_count', { world_id: originalWorld.id });

            return { world: forkedWorld, fork };
        } catch (error) {
            console.error('Error forking world:', error);
            return null;
        }
    },

    /**
     * Get fork information for a world
     */
    async getWorldFork(worldId: string): Promise<WorldFork | null> {
        try {
            const { data, error } = await supabase
                .from('world_forks')
                .select('*')
                .eq('forked_world_id', worldId)
                .single();

            if (error || !data) return null;

            return {
                id: data.id,
                parentWorldId: data.parent_world_id,
                parentWorldName: data.parent_world_name,
                originalCreatorId: data.original_creator_id,
                originalCreatorName: data.original_creator_name,
                forkedWorldId: data.forked_world_id,
                forkedByUserId: data.forked_by_user_id,
                forkedByUserName: data.forked_by_user_name,
                generationNumber: data.generation_number,
                ancestorChain: data.ancestor_chain,
                createdAt: new Date(data.created_at).getTime()
            };
        } catch (error) {
            console.error('Error getting world fork:', error);
            return null;
        }
    },

    /**
     * Get remix credits for a project
     */
    async getRemixCredits(worldId: string): Promise<RemixCredits | null> {
        try {
            const fork = await this.getWorldFork(worldId);
            if (!fork) return null;

            // Build credits chain
            const credits: RemixCredits['credits'] = [];
            
            for (let i = 0; i < fork.ancestorChain.length; i++) {
                const ancestorId = fork.ancestorChain[i];
                const { data } = await supabase
                    .from('remixable_worlds')
                    .select('id, name, creator_id, creator_name')
                    .eq('id', ancestorId)
                    .single();

                if (data) {
                    credits.push({
                        worldId: data.id,
                        worldName: data.name,
                        creatorId: data.creator_id,
                        creatorName: data.creator_name,
                        generationNumber: i + 1
                    });
                }
            }

            return {
                projectId: worldId,
                credits
            };
        } catch (error) {
            console.error('Error getting remix credits:', error);
            return null;
        }
    },

    /**
     * Search for remixable worlds
     */
    async searchWorlds(filters: WorldSearchFilters = {}): Promise<RemixableWorld[]> {
        try {
            let query = supabase
                .from('remixable_worlds')
                .select('*')
                .eq('is_public', true)
                .eq('allow_remix', true);

            // Apply filters
            if (filters.era) {
                query = query.eq('era', filters.era);
            }

            if (filters.license) {
                query = query.eq('license', filters.license);
            }

            if (filters.tags && filters.tags.length > 0) {
                query = query.contains('tags', filters.tags);
            }

            // Apply sorting
            switch (filters.sortBy) {
                case 'popular':
                    query = query.order('total_remixes', { ascending: false });
                    break;
                case 'trending':
                    query = query.order('total_views', { ascending: false });
                    break;
                case 'recent':
                default:
                    query = query.order('created_at', { ascending: false });
            }

            // Apply limit
            query = query.limit(filters.limit || 20);

            const { data, error } = await query;

            if (error) throw error;

            return (data || []).map((row: any) => ({
                id: row.id,
                name: row.name,
                description: row.description,
                coverImage: row.cover_image,
                creatorId: row.creator_id,
                creatorName: row.creator_name,
                creatorAvatar: row.creator_avatar,
                magicSystem: row.magic_system,
                locations: row.locations || [],
                lore: row.lore,
                rules: row.rules || [],
                era: row.era,
                isPublic: row.is_public,
                allowRemix: row.allow_remix,
                requireCredit: row.require_credit,
                license: row.license,
                totalRemixes: row.total_remixes,
                totalLikes: row.total_likes,
                totalViews: row.total_views,
                tags: row.tags || [],
                createdAt: new Date(row.created_at).getTime(),
                updatedAt: new Date(row.updated_at).getTime()
            }));
        } catch (error) {
            console.error('Error searching worlds:', error);
            return [];
        }
    },

    /**
     * Get featured/trending worlds for the home page
     */
    async getFeaturedWorlds(): Promise<RemixableWorld[]> {
        return this.searchWorlds({ sortBy: 'trending', limit: 6 });
    },

    /**
     * Get worlds by a specific creator
     */
    async getWorldsByCreator(creatorId: string): Promise<RemixableWorld[]> {
        try {
            const { data, error } = await supabase
                .from('remixable_worlds')
                .select('*')
                .eq('creator_id', creatorId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return (data || []).map((row: any) => ({
                id: row.id,
                name: row.name,
                description: row.description,
                coverImage: row.cover_image,
                creatorId: row.creator_id,
                creatorName: row.creator_name,
                magicSystem: row.magic_system,
                locations: row.locations || [],
                lore: row.lore,
                rules: row.rules || [],
                era: row.era,
                isPublic: row.is_public,
                allowRemix: row.allow_remix,
                requireCredit: row.require_credit,
                license: row.license,
                totalRemixes: row.total_remixes,
                totalLikes: row.total_likes,
                totalViews: row.total_views,
                tags: row.tags || [],
                createdAt: new Date(row.created_at).getTime(),
                updatedAt: new Date(row.updated_at).getTime()
            }));
        } catch (error) {
            console.error('Error getting creator worlds:', error);
            return [];
        }
    },

    /**
     * Like a world
     */
    async likeWorld(worldId: string, userId: string): Promise<boolean> {
        try {
            // Check if already liked
            const { data: existing } = await supabase
                .from('world_likes')
                .select('id')
                .eq('world_id', worldId)
                .eq('user_id', userId)
                .single();

            if (existing) {
                // Unlike
                await supabase.from('world_likes').delete().eq('id', existing.id);
                await supabase.rpc('decrement_like_count', { world_id: worldId });
                return false;
            } else {
                // Like
                await supabase.from('world_likes').insert({ world_id: worldId, user_id: userId });
                await supabase.rpc('increment_like_count', { world_id: worldId });
                return true;
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            return false;
        }
    },

    /**
     * Increment view count for a world
     */
    async viewWorld(worldId: string): Promise<void> {
        try {
            await supabase.rpc('increment_view_count', { world_id: worldId });
        } catch (error) {
            console.error('Error incrementing view count:', error);
        }
    },

    /**
     * Get all forks of a world (the "family tree")
     */
    async getWorldForks(worldId: string): Promise<WorldFork[]> {
        try {
            const { data, error } = await supabase
                .from('world_forks')
                .select('*')
                .eq('parent_world_id', worldId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return (data || []).map((row: any) => ({
                id: row.id,
                parentWorldId: row.parent_world_id,
                parentWorldName: row.parent_world_name,
                originalCreatorId: row.original_creator_id,
                originalCreatorName: row.original_creator_name,
                forkedWorldId: row.forked_world_id,
                forkedByUserId: row.forked_by_user_id,
                forkedByUserName: row.forked_by_user_name,
                generationNumber: row.generation_number,
                ancestorChain: row.ancestor_chain,
                createdAt: new Date(row.created_at).getTime()
            }));
        } catch (error) {
            console.error('Error getting world forks:', error);
            return [];
        }
    }
};

export default remixService;
