
export enum AppMode {
  DASHBOARD = 'DASHBOARD',
  CREATION = 'CREATION',
  EDITOR = 'EDITOR',
  VISUAL_STUDIO = 'VISUAL_STUDIO',
  LAYOUT_LAB = 'LAYOUT_LAB',
  EXPORT = 'EXPORT',
  SETTINGS = 'SETTINGS',
  PRICING = 'PRICING',
  GAMIFICATION = 'GAMIFICATION',
  SUCCESS = 'SUCCESS',
  VIEWER = 'VIEWER',
  AUTH = 'AUTH'
}

export enum ArtStyle {
  WATERCOLOR = 'Watercolor',
  PIXAR_3D = '3D Render (Pixar Style)',
  MANGA = 'Japanese Manga',
  CORPORATE = 'Corporate Minimalist',
  CYBERPUNK = 'Cyberpunk Neon',
  VINTAGE = 'Vintage Illustration',
  PAPER_CUTOUT = 'Paper Cutout Art',
  FLAT_DESIGN = 'Flat Design',
  INFOGRAPHIC = 'Modern Infographic',
  BLUEPRINT = 'Technical Blueprint'
}

export enum BookTone {
  PLAYFUL = 'Playful',
  SERIOUS = 'Serious',
  INSPIRATIONAL = 'Inspirational',
  EDUCATIONAL = 'Educational',
  DRAMATIC = 'Dramatic',
  CALM = 'Calm',
  ADVENTUROUS = 'Adventurous'
}

export enum UserTier {
  SPARK = 'Spark',      // Free
  CREATOR = 'Creator',  // $19.99
  STUDIO = 'Studio',    // $59.99
  EMPIRE = 'Empire'     // $199.99
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  unlocked: boolean;
}

export interface SavedBook {
  id: string;
  title: string;
  synopsis: string;
  coverImage?: string;
  project: BookProject;
  savedAt: Date;
  lastModified: Date;
  user_id?: string; // Optional for now, but needed for Supabase
}

export interface Challenge {
  id: string;
  title: string;
  xpReward: number;
  completed: boolean;
}

export interface GamificationState {
  level: number;
  levelTitle: string; // e.g. "Rising Author"
  currentXP: number;
  nextLevelXP: number;
  badges: Badge[];
  dailyChallenges: Challenge[];
  booksCreatedCount: number;
}

// --- New Schema Interfaces ---

export interface NarrationNotes {
  tone: string;
  pacing: string;
  emotion: string;
  soundEffects?: string[];
}

export interface InteractiveElement {
  type: 'decision' | 'activity';
  question: string;
  options: {
    text: string;
    leadsToPage: number;
  }[];
}

export interface LearningMoment {
  concept: string;
  content: string;
  answer?: string;
}

export interface VocabularyWord {
  word: string;
  definition: string;
}

export interface Page {
  id: string;
  pageNumber: number;
  text: string;
  imagePrompt: string;
  imageUrl?: string; // Base64 or URL
  layoutType: 'full-bleed' | 'split-horizontal' | 'split-vertical' | 'text-only' | 'image-only' | 'learning-break' | 'learning-only';

  // New fields
  narrationNotes?: NarrationNotes;
  interactiveElement?: InteractiveElement;

  // Enhanced Learning Content
  learningContent?: {
    topic: string;
    mentorDialogue: string; // What the character mentor says
    quiz?: {
      question: string;
      options: string[];
      correctAnswer: string; // The actual text of the correct answer
      explanation: string;
    };
  };

  learningMoment?: LearningMoment; // Keeping for backward compatibility or simple moments
  vocabularyWords?: VocabularyWord[];

  // Legacy support
  choices?: { text: string; targetPageNumber: number }[];
}

export interface Chapter {
  id: string;
  title: string;
  pages: Page[];
}

export interface Character {
  id: string;
  name: string;
  role?: string; // 'protagonist', etc.
  description: string;
  visualTraits: string; // Mapped from visualPrompt for backward compatibility
  visualPrompt?: string; // New field
  traits?: string[];
  imageUrl?: string;
}

export interface BookMetadata {
  title: string;
  subtitle?: string;
  synopsis: string;
  ageRange: string;
  genre: string;
  pageCount: number;
  readingTimeMinutes?: number;
  artStyle: string;
  features: string[];
  language: string;
  contentWarnings?: string[];
}

export interface DecisionTree {
  paths: {
    pathId: string;
    decisions: { page: number; choice: string }[];
    outcome: string;
  }[];
}

export interface BackMatter {
  discussionQuestions: string[];
  activities: string[];
  vocabularyList: VocabularyWord[];
}

export interface SeriesInfo {
  potentialSequels: string[];
  characterDevelopment: string;
}

export interface BookProject {
  id: string;
  title: string;
  synopsis: string;
  style: ArtStyle;
  tone: BookTone;
  targetAudience: string;
  isBranching: boolean;
  brandProfile?: BrandProfile;

  // Structure
  chapters: Chapter[]; // Kept for app structure, but might be just one chapter if flat
  characters: Character[];

  // New Schema Data
  metadata?: BookMetadata;
  decisionTree?: DecisionTree;
  backMatter?: BackMatter;
  seriesInfo?: SeriesInfo;
  learningConfig?: LearningConfig;

  coverImage?: string; // Generated cover image URL
  aiImagesGenerated?: number; // Track AI usage for limits

  createdAt: Date;
}

export interface LearningConfig {
  subject: string;
  objectives: string;
  integrationMode: 'integrated' | 'after-chapter' | 'dedicated-section';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface GenerationSettings {
  prompt: string;
  style: ArtStyle;
  tone: BookTone;
  pageCount: number;
  audience: string;
  isBranching: boolean;
  educational?: boolean;
  learningConfig?: LearningConfig; // New field
  brandProfile?: BrandProfile;
}

export interface BrandProfile {
  name: string;
  guidelines: string;
  colors: string[];
  sampleText: string;
}

export interface VisualSettings {
  activeTab: 'character' | 'scene' | 'style';
  selectedCharacterId: string | null;
  expression: string;
  pose: string;
  costume: string;
  lighting: string;
  cameraAngle: string;
  styleA: ArtStyle;
  styleB: ArtStyle;
  mixRatio: number; // 0-100
  prompt: string;
  generatedImage: string | null;
}

export interface ChatRoom {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  type: 'text' | 'system' | 'action';
  action_data?: any;
  created_at: string;
  user?: {
    display_name: string;
    avatar_url: string;
  };
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
}

export interface PresenceState {
  userId: string;
  username?: string;
  online_at: string;
}

// ============================================
// CHAT ENHANCEMENTS
// ============================================

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user?: {
    id: string;
    email: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface RoomInvitation {
  id: string;
  room_id: string;
  invited_by: string;
  invited_user_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at?: string;
  room?: {
    name: string;
    description?: string;
  };
  inviter?: {
    id: string;
    email: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface UserNotification {
  id: string;
  user_id: string;
  type: 'new_message' | 'mention' | 'reaction' | 'invitation';
  title: string;
  body?: string;
  data?: any;
  read: boolean;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  status?: 'online' | 'offline' | 'away';
  bio?: string;
  created_at: string;
  updated_at?: string;
}
