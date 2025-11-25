
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
  PAPER_CUTOUT = 'Paper Cutout Art'
}

export enum BookTone {
  PLAYFUL = 'Playful',
  SERIOUS = 'Serious',
  INSPIRATIONAL = 'Inspirational',
  EDUCATIONAL = 'Educational',
  DRAMATIC = 'Dramatic'
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
  layoutType: 'full-bleed' | 'split-horizontal' | 'split-vertical' | 'text-only' | 'image-only';

  // New fields
  narrationNotes?: NarrationNotes;
  interactiveElement?: InteractiveElement;
  learningMoment?: LearningMoment;
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

  coverImage?: string; // Generated cover image URL
  aiImagesGenerated?: number; // Track AI usage for limits

  createdAt: Date;
}

export interface GenerationSettings {
  prompt: string;
  style: ArtStyle;
  tone: BookTone;
  pageCount: number;
  audience: string;
  isBranching: boolean;
  educational?: boolean; // New flag
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
