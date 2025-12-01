// ==============================================================================
// GENESIS VERSION CONTROL SERVICE
// ==============================================================================
// Visual version history, branching, forking, and family tree visualization
// ==============================================================================

import { supabase } from './supabaseClient';
import {
    VisualVersion,
    VisualBranch,
    VersionComparison,
    TextDiff,
    FamilyTree,
    TreeNode,
    VersionMetadata
} from '../types/advanced';

// ─────────────────────────────────────────────────────────────────────────────
// VERSION CONTROL SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class VersionControlService {
    private readonly MAX_VERSIONS_PER_VISUAL = 50;
    private treeCache: Map<string, { data: FamilyTree; expiry: number }> = new Map();
    private readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

    // ─────────────────────────────────────────────────────────────────────────
    // VERSION MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create a new version of a visual
     */
    async createVersion(
        visualId: string,
        prompt: string,
        imageUrl: string,
        settings: Record<string, any>,
        changeDescription?: string,
        parentVersionId?: string
    ): Promise<{ success: boolean; data?: VisualVersion; error?: string }> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Get the latest version number
        const { data: latestVersion } = await supabase
            .from('visual_versions')
            .select('version_number')
            .eq('visual_id', visualId)
            .order('version_number', { ascending: false })
            .limit(1)
            .single();

        const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

        // Check version limit
        if (nextVersionNumber > this.MAX_VERSIONS_PER_VISUAL) {
            // Delete oldest versions to make room
            await this.pruneOldVersions(visualId);
        }

        // Create version
        const { data, error } = await supabase
            .from('visual_versions')
            .insert({
                visual_id: visualId,
                parent_version_id: parentVersionId,
                version_number: nextVersionNumber,
                prompt,
                image_url: imageUrl,
                settings,
                change_description: changeDescription,
                created_by: user.data.user.id
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating version:', error);
            return { success: false, error: error.message };
        }

        // Clear tree cache for this visual
        this.clearTreeCache(visualId);

        return { success: true, data };
    }

    /**
     * Get all versions of a visual
     */
    async getVersions(visualId: string): Promise<VisualVersion[]> {
        const { data, error } = await supabase
            .from('visual_versions')
            .select(`
                *,
                creator:profiles!created_by(id, full_name, avatar_url)
            `)
            .eq('visual_id', visualId)
            .order('version_number', { ascending: true });

        if (error) {
            console.error('Error fetching versions:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Get a specific version
     */
    async getVersion(versionId: string): Promise<VisualVersion | null> {
        const { data, error } = await supabase
            .from('visual_versions')
            .select(`
                *,
                creator:profiles!created_by(id, full_name, avatar_url)
            `)
            .eq('id', versionId)
            .single();

        if (error) {
            console.error('Error fetching version:', error);
            return null;
        }

        return data;
    }

    /**
     * Restore a previous version as current
     */
    async restoreVersion(
        visualId: string,
        versionId: string
    ): Promise<{ success: boolean; data?: VisualVersion; error?: string }> {
        const version = await this.getVersion(versionId);
        if (!version) {
            return { success: false, error: 'Version not found' };
        }

        // Create a new version as a restore
        return this.createVersion(
            visualId,
            version.prompt,
            version.image_url,
            version.settings,
            `Restored from version ${version.version_number}`,
            versionId
        );
    }

    /**
     * Delete a version
     */
    async deleteVersion(versionId: string): Promise<{ success: boolean; error?: string }> {
        // Don't allow deleting if it has children
        const { count } = await supabase
            .from('visual_versions')
            .select('*', { count: 'exact', head: true })
            .eq('parent_version_id', versionId);

        if (count && count > 0) {
            return { success: false, error: 'Cannot delete version with children' };
        }

        const { error } = await supabase
            .from('visual_versions')
            .delete()
            .eq('id', versionId);

        if (error) {
            console.error('Error deleting version:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    /**
     * Prune old versions to maintain limit
     */
    private async pruneOldVersions(visualId: string): Promise<void> {
        const { data } = await supabase
            .from('visual_versions')
            .select('id, is_starred')
            .eq('visual_id', visualId)
            .eq('is_starred', false)
            .order('created_at', { ascending: true })
            .limit(10);

        if (data) {
            for (const version of data) {
                await supabase
                    .from('visual_versions')
                    .delete()
                    .eq('id', version.id);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BRANCHING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create a branch from a version
     */
    async createBranch(
        visualId: string,
        fromVersionId: string,
        name: string,
        description?: string
    ): Promise<{ success: boolean; data?: VisualBranch; error?: string }> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data, error } = await supabase
            .from('visual_branches')
            .insert({
                visual_id: visualId,
                name,
                description,
                created_from_version_id: fromVersionId,
                created_by: user.data.user.id
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating branch:', error);
            return { success: false, error: error.message };
        }

        // Clear tree cache
        this.clearTreeCache(visualId);

        return { success: true, data };
    }

    /**
     * Get branches for a visual
     */
    async getBranches(visualId: string): Promise<VisualBranch[]> {
        const { data, error } = await supabase
            .from('visual_branches')
            .select(`
                *,
                creator:profiles!created_by(id, full_name, avatar_url),
                from_version:visual_versions!created_from_version_id(
                    id, version_number, image_url
                )
            `)
            .eq('visual_id', visualId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching branches:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Merge a branch back to main
     */
    async mergeBranch(
        branchId: string,
        mergeVersionId: string
    ): Promise<{ success: boolean; error?: string }> {
        const { error } = await supabase
            .from('visual_branches')
            .update({
                is_merged: true,
                merged_at: new Date().toISOString(),
                merged_version_id: mergeVersionId
            })
            .eq('id', branchId);

        if (error) {
            console.error('Error merging branch:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    /**
     * Delete a branch
     */
    async deleteBranch(branchId: string): Promise<{ success: boolean; error?: string }> {
        const { error } = await supabase
            .from('visual_branches')
            .delete()
            .eq('id', branchId);

        if (error) {
            console.error('Error deleting branch:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FORKING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fork a visual (remix) with full version history
     */
    async forkVisual(
        originalVisualId: string,
        newPrompt: string,
        newImageUrl: string,
        newSettings: Record<string, any>
    ): Promise<{ success: boolean; data?: { visualId: string; versionId: string }; error?: string }> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Get the original visual info
        const { data: original } = await supabase
            .from('shared_visuals')
            .select('id, prompt, settings, creator_id')
            .eq('id', originalVisualId)
            .single();

        if (!original) {
            return { success: false, error: 'Original visual not found' };
        }

        // Create new shared visual
        const { data: newVisual, error: visualError } = await supabase
            .from('shared_visuals')
            .insert({
                creator_id: user.data.user.id,
                prompt: newPrompt,
                image_url: newImageUrl,
                settings: newSettings,
                forked_from_id: originalVisualId,
                is_fork: true
            })
            .select()
            .single();

        if (visualError) {
            console.error('Error creating fork:', visualError);
            return { success: false, error: visualError.message };
        }

        // Create initial version for the fork
        const { data: version } = await supabase
            .from('visual_versions')
            .insert({
                visual_id: newVisual.id,
                version_number: 1,
                prompt: newPrompt,
                image_url: newImageUrl,
                settings: newSettings,
                change_description: `Forked from visual by ${original.creator_id}`,
                created_by: user.data.user.id
            })
            .select()
            .single();

        // Update remix count on original
        await supabase.rpc('increment_remix_count', { visual_id: originalVisualId });

        return { 
            success: true, 
            data: { 
                visualId: newVisual.id, 
                versionId: version?.id || '' 
            } 
        };
    }

    /**
     * Get fork tree (all forks of an original)
     */
    async getForkTree(visualId: string): Promise<Array<{ visual: any; forks: any[] }>> {
        // Find the root (original) visual
        let rootId = visualId;
        let current = await supabase
            .from('shared_visuals')
            .select('id, forked_from_id')
            .eq('id', visualId)
            .single();

        while (current.data?.forked_from_id) {
            rootId = current.data.forked_from_id;
            current = await supabase
                .from('shared_visuals')
                .select('id, forked_from_id')
                .eq('id', rootId)
                .single();
        }

        // Get all forks recursively
        return this.buildForkTree(rootId);
    }

    private async buildForkTree(
        visualId: string
    ): Promise<Array<{ visual: any; forks: any[] }>> {
        const { data: visual } = await supabase
            .from('shared_visuals')
            .select(`
                id, prompt, image_url, created_at,
                creator:profiles!creator_id(id, full_name, avatar_url)
            `)
            .eq('id', visualId)
            .single();

        const { data: forks } = await supabase
            .from('shared_visuals')
            .select('id')
            .eq('forked_from_id', visualId);

        const children = [];
        if (forks) {
            for (const fork of forks) {
                const childTree = await this.buildForkTree(fork.id);
                children.push(...childTree);
            }
        }

        return [{ visual, forks: children }];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VERSION COMPARISON
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Compare two versions
     */
    async compareVersions(
        versionAId: string,
        versionBId: string
    ): Promise<VersionComparison | null> {
        const [versionA, versionB] = await Promise.all([
            this.getVersion(versionAId),
            this.getVersion(versionBId)
        ]);

        if (!versionA || !versionB) {
            return null;
        }

        // Calculate prompt diff
        const promptDiff = this.calculateTextDiff(versionA.prompt, versionB.prompt);

        // Calculate settings diff
        const settingsDiff = this.calculateSettingsDiff(versionA.settings, versionB.settings);

        // Calculate similarity score (simple word overlap)
        const similarity = this.calculateSimilarity(versionA.prompt, versionB.prompt);

        const comparison: VersionComparison = {
            version_a: versionA,
            version_b: versionB,
            prompt_diff: promptDiff,
            settings_diff: settingsDiff,
            similarity_score: similarity,
            comparison_date: new Date().toISOString()
        };

        // Optionally save comparison
        await supabase
            .from('version_comparisons')
            .insert({
                version_a_id: versionAId,
                version_b_id: versionBId,
                diff_data: comparison,
                similarity_score: similarity
            });

        return comparison;
    }

    /**
     * Calculate text diff between two prompts
     */
    private calculateTextDiff(oldText: string, newText: string): TextDiff[] {
        const oldWords = oldText.split(/\s+/);
        const newWords = newText.split(/\s+/);
        const diffs: TextDiff[] = [];

        // Simple word-level diff (for production, use a proper diff library)
        let i = 0, j = 0;
        
        while (i < oldWords.length || j < newWords.length) {
            if (i >= oldWords.length) {
                diffs.push({ type: 'added', text: newWords[j] });
                j++;
            } else if (j >= newWords.length) {
                diffs.push({ type: 'removed', text: oldWords[i] });
                i++;
            } else if (oldWords[i] === newWords[j]) {
                diffs.push({ type: 'unchanged', text: oldWords[i] });
                i++;
                j++;
            } else {
                // Check if word was removed or added
                const oldInNew = newWords.indexOf(oldWords[i], j);
                const newInOld = oldWords.indexOf(newWords[j], i);

                if (oldInNew === -1) {
                    diffs.push({ type: 'removed', text: oldWords[i] });
                    i++;
                } else if (newInOld === -1) {
                    diffs.push({ type: 'added', text: newWords[j] });
                    j++;
                } else if (oldInNew < newInOld) {
                    diffs.push({ type: 'added', text: newWords[j] });
                    j++;
                } else {
                    diffs.push({ type: 'removed', text: oldWords[i] });
                    i++;
                }
            }
        }

        return diffs;
    }

    /**
     * Calculate settings diff
     */
    private calculateSettingsDiff(
        oldSettings: Record<string, any>,
        newSettings: Record<string, any>
    ): Array<{ key: string; old: any; new: any }> {
        const changes: Array<{ key: string; old: any; new: any }> = [];
        const allKeys = new Set([...Object.keys(oldSettings), ...Object.keys(newSettings)]);

        for (const key of allKeys) {
            if (JSON.stringify(oldSettings[key]) !== JSON.stringify(newSettings[key])) {
                changes.push({
                    key,
                    old: oldSettings[key],
                    new: newSettings[key]
                });
            }
        }

        return changes;
    }

    /**
     * Calculate similarity score between two prompts
     */
    private calculateSimilarity(textA: string, textB: string): number {
        const wordsA = new Set(textA.toLowerCase().split(/\s+/));
        const wordsB = new Set(textB.toLowerCase().split(/\s+/));

        const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
        const union = new Set([...wordsA, ...wordsB]).size;

        return union > 0 ? Math.round((intersection / union) * 100) : 0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FAMILY TREE VISUALIZATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Build family tree for visualization (React Flow compatible)
     */
    async getFamilyTree(visualId: string): Promise<FamilyTree> {
        // Check cache
        const cached = this.treeCache.get(visualId);
        if (cached && cached.expiry > Date.now()) {
            return cached.data;
        }

        const versions = await this.getVersions(visualId);
        const branches = await this.getBranches(visualId);

        // Build nodes
        const nodes: TreeNode[] = versions.map((v, index) => ({
            id: v.id,
            type: branches.some(b => b.created_from_version_id === v.id) ? 'branchPoint' : 'version',
            data: {
                version: v,
                label: `v${v.version_number}`,
                thumbnail: v.image_url,
                prompt: v.prompt.slice(0, 50) + (v.prompt.length > 50 ? '...' : ''),
                changeDescription: v.change_description
            },
            position: { 
                x: index * 200, 
                y: 0 
            }
        }));

        // Add branch nodes
        for (const branch of branches) {
            const branchVersions = versions.filter(v => 
                v.branch_id === branch.id
            );

            for (let i = 0; i < branchVersions.length; i++) {
                const existing = nodes.find(n => n.id === branchVersions[i].id);
                if (existing) {
                    existing.position.y = 150; // Move branch versions down
                }
            }
        }

        // Build edges
        const edges = versions
            .filter(v => v.parent_version_id)
            .map(v => ({
                id: `${v.parent_version_id}-${v.id}`,
                source: v.parent_version_id!,
                target: v.id,
                type: v.branch_id ? 'branch' : 'default',
                animated: false
            }));

        const tree: FamilyTree = {
            nodes,
            edges,
            visual_id: visualId,
            total_versions: versions.length,
            total_branches: branches.length
        };

        // Cache the result
        this.treeCache.set(visualId, {
            data: tree,
            expiry: Date.now() + this.CACHE_DURATION
        });

        return tree;
    }

    /**
     * Get simplified lineage (for display without full React Flow)
     */
    async getLineage(visualId: string): Promise<Array<{
        version: VisualVersion;
        level: number;
        children: string[];
    }>> {
        const versions = await this.getVersions(visualId);
        
        // Build parent-child relationships
        const childrenMap: Record<string, string[]> = {};
        for (const v of versions) {
            if (v.parent_version_id) {
                if (!childrenMap[v.parent_version_id]) {
                    childrenMap[v.parent_version_id] = [];
                }
                childrenMap[v.parent_version_id].push(v.id);
            }
        }

        // Calculate levels (distance from root)
        const levels: Record<string, number> = {};
        const root = versions.find(v => !v.parent_version_id);
        
        if (root) {
            levels[root.id] = 0;
            const queue = [root.id];
            
            while (queue.length > 0) {
                const current = queue.shift()!;
                const children = childrenMap[current] || [];
                for (const child of children) {
                    levels[child] = levels[current] + 1;
                    queue.push(child);
                }
            }
        }

        return versions.map(v => ({
            version: v,
            level: levels[v.id] || 0,
            children: childrenMap[v.id] || []
        }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STARRING/BOOKMARKING VERSIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Star/unstar a version (prevent auto-deletion)
     */
    async toggleStarVersion(
        versionId: string,
        isStarred: boolean
    ): Promise<{ success: boolean; error?: string }> {
        const { error } = await supabase
            .from('visual_versions')
            .update({ is_starred: isStarred })
            .eq('id', versionId);

        if (error) {
            console.error('Error toggling star:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    }

    /**
     * Get starred versions for a user
     */
    async getStarredVersions(): Promise<VisualVersion[]> {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return [];

        const { data, error } = await supabase
            .from('visual_versions')
            .select(`
                *,
                creator:profiles!created_by(id, full_name, avatar_url)
            `)
            .eq('created_by', user.data.user.id)
            .eq('is_starred', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching starred versions:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Clear tree cache
     */
    private clearTreeCache(visualId?: string): void {
        if (visualId) {
            this.treeCache.delete(visualId);
        } else {
            this.treeCache.clear();
        }
    }
}

export const versionControlService = new VersionControlService();
export default versionControlService;
