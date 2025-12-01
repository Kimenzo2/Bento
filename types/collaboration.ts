// ==============================================================================
// GENESIS COLLABORATIVE PLATFORM - TYPE DEFINITIONS
// ==============================================================================
// Types for the real-time collaborative visual creation platform
// ==============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// USER & PROFILE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CollaboratorProfile {
    id: string;
    email?: string;
    display_name: string;
    full_name?: string; // Alias for display_name from Supabase profiles
    avatar_url: string;
    updated_at?: string;
}

export interface PresenceUser {
    user_id: string;
    display_name: string;
    avatar_url: string;
    online_at: string;
    status: CollaboratorStatus;
    cursor_position?: { x: number; y: number };
    current_action?: string;
}

export type CollaboratorStatus = 'idle' | 'typing' | 'generating' | 'done' | 'away';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED VISUAL TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type VisualVisibility = 'public' | 'private' | 'unlisted' | 'featured';
export type ModerationStatus = 'pending' | 'approved' | 'rejected';

export interface VisualGenerationSettings {
    styleA: string;
    styleB?: string;
    mixRatio?: number;
    lighting?: string;
    cameraAngle?: string;
    expression?: string;
    pose?: string;
    costume?: string;
    characterId?: string;
    characterName?: string;
}

export interface SharedVisual {
    id: string;
    user_id: string;
    
    // Core image data
    image_url: string;
    thumbnail_url?: string;
    prompt: string;
    negative_prompt?: string;
    
    // Settings for reproducibility
    settings: VisualGenerationSettings;
    
    // Remix lineage
    parent_id?: string;
    remix_count: number;
    generation_depth: number;
    
    // Visibility & moderation
    visibility: VisualVisibility;
    is_nsfw: boolean;
    moderation_status: ModerationStatus;
    
    // Engagement metrics
    reaction_count: number;
    comment_count: number;
    view_count: number;
    
    // Metadata
    tags: string[];
    title?: string;
    description?: string;
    
    // Session context
    session_id?: string;
    
    // Timestamps
    created_at: string;
    updated_at: string;
    
    // Joined data (populated by queries)
    user?: CollaboratorProfile;
    parent?: SharedVisual;
    reactions?: Reaction[];
    user_reactions?: ReactionType[];
}

export interface SharedVisualInsert {
    image_url: string;
    prompt: string;
    negative_prompt?: string;
    settings?: VisualGenerationSettings;
    parent_id?: string;
    visibility?: VisualVisibility;
    tags?: string[];
    title?: string;
    description?: string;
    session_id?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REACTION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ReactionType = 
    | 'fire'      // 🔥 Hot/Amazing
    | 'heart'     // ❤️ Love
    | 'star'      // ⭐ Favorite
    | 'mindblown' // 🤯 Mind-blown
    | 'clap'      // 👏 Applause
    | 'rocket'    // 🚀 Awesome
    | 'sparkles'  // ✨ Magic
    | 'crown'     // 👑 Masterpiece
    | 'lightbulb' // 💡 Creative
    | 'gem';      // 💎 Precious

export interface Reaction {
    id: string;
    visual_id: string;
    user_id: string;
    reaction_type: ReactionType;
    created_at: string;
    user?: CollaboratorProfile;
}

export interface ReactionCount {
    type: ReactionType;
    count: number;
    users?: CollaboratorProfile[];
}

export const REACTION_EMOJIS: Record<ReactionType, string> = {
    fire: '🔥',
    heart: '❤️',
    star: '⭐',
    mindblown: '🤯',
    clap: '👏',
    rocket: '🚀',
    sparkles: '✨',
    crown: '👑',
    lightbulb: '💡',
    gem: '💎',
};

export const REACTION_LABELS: Record<ReactionType, string> = {
    fire: 'Hot',
    heart: 'Love',
    star: 'Favorite',
    mindblown: 'Mind-blown',
    clap: 'Applause',
    rocket: 'Awesome',
    sparkles: 'Magic',
    crown: 'Masterpiece',
    lightbulb: 'Creative',
    gem: 'Precious',
};

// ─────────────────────────────────────────────────────────────────────────────
// ANNOTATION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type AnnotationType = 'drawing' | 'text' | 'voice' | 'pin';
export type AnnotationVisibility = 'public' | 'collaborators' | 'private';

export interface DrawingPath {
    points: { x: number; y: number }[];
    color: string;
    strokeWidth: number;
    tool: 'pen' | 'brush' | 'highlighter' | 'eraser';
}

export interface DrawingContent {
    paths: DrawingPath[];
    color: string;
    strokeWidth: number;
}

export interface TextContent {
    text: string;
    fontSize: number;
    color: string;
    fontWeight?: 'normal' | 'bold';
}

export interface VoiceContent {
    audioUrl: string;
    duration: number;
    transcript?: string;
    waveform?: number[];
}

export interface PinContent {
    label: string;
    color: string;
    icon?: string;
}

export type AnnotationContent = DrawingContent | TextContent | VoiceContent | PinContent;

export interface Annotation {
    id: string;
    visual_id: string;
    user_id: string;
    type: AnnotationType;
    position_x: number;
    position_y: number;
    width?: number;
    height?: number;
    content: AnnotationContent;
    is_resolved: boolean;
    visibility: AnnotationVisibility;
    created_at: string;
    updated_at: string;
    user?: CollaboratorProfile;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ChallengeStatus = 'upcoming' | 'active' | 'voting' | 'completed';
export type ChallengeDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface Challenge {
    id: string;
    title: string;
    description: string;
    theme: string;
    prompt_hint?: string;
    cover_image_url?: string;
    starts_at: string;
    ends_at: string;
    required_style?: string;
    required_elements?: string[];
    xp_reward: number;
    badge_id?: string;
    status: ChallengeStatus;
    winner_visual_id?: string;
    difficulty: ChallengeDifficulty;
    category: string;
    sponsor_name?: string;
    sponsor_logo_url?: string;
    submission_count: number;
    participant_count: number;
    created_at: string;
    created_by?: string;
    
    // Computed/joined
    time_remaining?: number;
    user_has_submitted?: boolean;
    winner?: SharedVisual;
    top_submissions?: ChallengeSubmission[];
}

export interface ChallengeSubmission {
    id: string;
    challenge_id: string;
    visual_id: string;
    user_id: string;
    vote_count: number;
    final_rank?: number;
    submitted_at: string;
    
    // Joined
    visual?: SharedVisual;
    user?: CollaboratorProfile;
}

export interface ChallengeVote {
    id: string;
    submission_id: string;
    user_id: string;
    created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY FEED TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ActivityType = 
    | 'visual_created'
    | 'visual_remixed'
    | 'visual_featured'
    | 'reaction_added'
    | 'annotation_added'
    | 'comment_added'
    | 'challenge_submitted'
    | 'challenge_won'
    | 'user_joined'
    | 'user_leveled_up'
    | 'collab_started'
    | 'collab_joined';

export type ActivityScope = 'global' | 'session' | 'private';

export interface ActivityMetadata {
    reactionType?: ReactionType;
    xpEarned?: number;
    prompt?: string;
    parentId?: string;
    challengeTitle?: string;
    newLevel?: number;
    badgeEarned?: string;
}

export interface Activity {
    id: string;
    user_id: string;
    type: ActivityType;
    visual_id?: string;
    challenge_id?: string;
    session_id?: string;
    target_user_id?: string;
    metadata: ActivityMetadata;
    scope: ActivityScope;
    created_at: string;
    
    // Joined
    user?: CollaboratorProfile;
    visual?: SharedVisual;
    challenge?: Challenge;
    target_user?: CollaboratorProfile;
}

// ─────────────────────────────────────────────────────────────────────────────
// COLLABORATION SESSION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CollaborationSession {
    id: string;
    created_by: string;
    name: string;
    is_active: boolean;
    created_at: string;
    
    // Joined
    participants?: SessionParticipant[];
    visuals?: SharedVisual[];
    active_count?: number;
}

export interface SessionParticipant {
    session_id: string;
    user_id: string;
    status: CollaboratorStatus;
    last_seen_at: string;
    
    // Joined
    profile?: CollaboratorProfile;
}

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME EVENT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface RealtimeVisualEvent {
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    visual: SharedVisual;
    old_visual?: SharedVisual;
}

export interface RealtimeReactionEvent {
    type: 'INSERT' | 'DELETE';
    reaction: Reaction;
    visual_id: string;
}

export interface RealtimeActivityEvent {
    activity: Activity;
}

export interface RealtimePresenceEvent {
    type: 'join' | 'leave' | 'sync';
    users: PresenceUser[];
}

export interface RealtimeTypingEvent {
    user_id: string;
    display_name: string;
    is_typing: boolean;
}

export interface RealtimeCursorEvent {
    user_id: string;
    display_name: string;
    avatar_url: string;
    x: number;
    y: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS & UI STATE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CanvasViewState {
    zoom: number;
    panX: number;
    panY: number;
    selectedVisualId?: string;
    isAnnotating: boolean;
    annotationTool?: AnnotationType;
}

export interface CanvasFilters {
    visibility: VisualVisibility[];
    userId?: string;
    tags?: string[];
    dateRange?: { start: string; end: string };
    sortBy: 'newest' | 'popular' | 'most_remixed';
    searchQuery?: string;
}

export interface GalleryLayoutMode {
    type: 'grid' | 'masonry' | 'carousel' | 'focus';
    columns?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDER TYPES (Collaborative Editing)
// ─────────────────────────────────────────────────────────────────────────────

export interface PromptSuggestion {
    id: string;
    user_id: string;
    text: string;
    votes: number;
    voted_by: string[];
    created_at: string;
    user?: CollaboratorProfile;
}

export interface CollaborativePrompt {
    id: string;
    session_id: string;
    current_text: string;
    suggestions: PromptSuggestion[];
    locked_by?: string;
    lock_expires_at?: string;
    created_at: string;
    updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL FAMILY TREE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface VisualNode {
    id: string;
    visual: SharedVisual;
    children: VisualNode[];
    depth: number;
    x?: number;
    y?: number;
}

export interface VisualLineage {
    root: VisualNode;
    totalNodes: number;
    maxDepth: number;
    allVisuals: Map<string, SharedVisual>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE RESPONSE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
    data: T[];
    count: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

export interface ServiceResult<T> {
    data?: T;
    error?: string;
    success: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export default {
    REACTION_EMOJIS,
    REACTION_LABELS,
};
