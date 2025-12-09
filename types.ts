
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
  currentStreak?: number; // Optional: Days streak
  lastActivityDate?: string; // Optional: Last activity timestamp
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
  isImageOutdated?: boolean; // True if text changed significantly since generation
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
  // Extended fields for Green Room
  personalityTraits?: string[];
  backstory?: string;
  appearance?: string;
  goals?: string[];
  fears?: string[];
  quirks?: string[];

  // ========== DEEP PERSONALITY SYSTEM ==========
  // Psychological Profile (Big Five / OCEAN Model)
  psychologicalProfile?: {
    openness: number;        // 0-100: Creativity, curiosity, openness to new experiences
    conscientiousness: number; // 0-100: Organization, dependability, self-discipline
    extraversion: number;    // 0-100: Sociability, assertiveness, positive emotions
    agreeableness: number;   // 0-100: Cooperation, trust, empathy
    neuroticism: number;     // 0-100: Emotional instability, anxiety, moodiness
  };

  // Core Identity
  coreIdentity?: {
    coreBelief: string;           // "The world is fundamentally..." (shapes worldview)
    greatestDesire: string;       // What they want more than anything
    greatestFear: string;         // What they avoid at all costs
    moralCode: string;            // Their personal ethics/values
    flaw: string;                 // Their tragic flaw or weakness
    strength: string;             // Their greatest asset
    lie: string;                  // A false belief they hold about themselves/world
    truth: string;                // The truth they need to learn
  };

  // Backstory & Formative Experiences
  formativeExperiences?: {
    childhoodMemory: string;      // Defining childhood moment
    biggestRegret: string;        // Something they wish they could undo
    definingMoment: string;       // The event that made them who they are
    secretShame: string;          // Something they hide from others
    proudestAchievement: string;  // What they're most proud of
  };

  // Relationships & Attachment
  relationshipStyle?: {
    attachmentStyle: 'secure' | 'anxious' | 'avoidant' | 'disorganized';
    trustLevel: 'trusting' | 'cautious' | 'suspicious' | 'paranoid';
    conflictStyle: 'confrontational' | 'diplomatic' | 'avoidant' | 'passive-aggressive';
    loveLanguage: 'words' | 'acts' | 'gifts' | 'time' | 'touch';
  };

  // Behavioral Patterns
  behavioralPatterns?: {
    stressResponse: string;       // How they react under pressure
    joyTriggers: string[];        // What makes them happy
    angerTriggers: string[];      // What sets them off
    copingMechanisms: string[];   // How they deal with problems
    habits: string[];             // Regular behaviors/routines
    speechPatterns: string;       // How they talk (formal, slang, poetic, etc.)
  };

  // Voice & Mannerisms
  voiceProfile?: {
    tone: string;                 // warm, cold, sarcastic, earnest, etc.
    vocabulary: 'simple' | 'moderate' | 'sophisticated' | 'archaic';
    catchphrases: string[];       // Things they often say
    nonverbalTics: string[];      // Gestures, expressions, body language
    laughStyle: string;           // How they laugh
  };

  // Internal Conflicts
  innerConflicts?: string[];      // The battles they fight within themselves

  // Character Arc Potential
  arcPotential?: {
    startingState: string;        // Who they are at the beginning
    potentialGrowth: string;      // How they could change
    endingState: string;          // Who they could become
  };

  // ========== TEACHING CAPABILITIES ==========
  teachingStyle?: {
    subjectsExpertise: string[];  // ['Math', 'Science', 'SEL', 'Reading', 'History']
    teachingApproach: 'nurturing' | 'challenging' | 'playful' | 'socratic' | 'storytelling';
    encouragementStyle: string;    // How they praise correct answers
    correctionStyle: string;       // How they handle mistakes gently
    exampleStyle: string;          // How they give examples (metaphors, real-world, stories)
  };
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

// --- Deep Quality & Living Storyboard Types ---

export interface StoryEntity {
  id: string;
  name: string;
  type: 'character' | 'location' | 'object';
  description: string;
  visualTraits: string;
  firstAppearancePage: number;
  occurrences: number[];
}

export interface StoryBeat {
  pageNumber: number;
  summary: string;
  emotionalTone: string; // e.g., "Tense", "Joyful"
  sentimentScore: number; // -1.0 to 1.0
  tensionLevel: number; // 0 to 10
  charactersPresent: string[]; // IDs
}

export interface StoryBible {
  entities: StoryEntity[];
  beats: StoryBeat[];
  globalThemes: string[];
  consistencyIssues: {
    pageNumber: number;
    description: string;
    severity: 'low' | 'medium' | 'high';
    entityId?: string;
  }[];
  audienceSafety?: AudienceSafetyReport;
  emotionalArc?: {
    arc: Array<{
      pageNumber: number;
      sentiment: number;
      tension: number;
      label: string;
    }>;
    climaxPage: number;
    pacing: 'slow' | 'medium' | 'fast' | 'uneven';
    suggestions: string[];
  };
}

export interface AudienceSafetyReport {
  isAppropriate: boolean;
  warnings: {
    type: 'vocabulary' | 'theme' | 'intensity' | 'content';
    description: string;
    severity: 'info' | 'warning' | 'critical';
    suggestion?: string;
  }[];
  readingLevel: string;
  recommendedAgeRange: string;
}

export interface BookProject {
  id: string;
  title: string;
  synopsis: string;
  style: ArtStyle;
  tone: BookTone;
  targetAudience: string;
  isBranching: boolean;

  // Deep Quality Fields
  storyBible?: StoryBible;
  lastBibleUpdate?: number; // Timestamp
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
  teacherCharacterId?: string; // ID of the character who will teach
}

export interface GenerationSettings {
  prompt: string;
  style: ArtStyle;
  tone: BookTone;
  pageCount: number;
  audience: string;
  isBranching: boolean;
  educational?: boolean;
  learningConfig?: LearningConfig;
  teacherCharacter?: Character; // Full character object for teaching
  brandProfile?: BrandProfile;
  brandStoryConfig?: BrandStoryConfig; // For professional brand content
  templateStructure?: any[]; // Optional structure from TemplateLibrary
}

export interface BrandProfile {
  name: string;
  guidelines: string;
  colors: string[];
  sampleText: string;
}

// ============================================
// BRAND STORY & ANNUAL REPORT TYPES
// ============================================

export type BrandContentType =
  | 'brand-story'
  | 'annual-report'
  | 'company-history'
  | 'product-launch'
  | 'investor-pitch';

export type BrandSectionType =
  | 'cover'
  | 'ceo-letter'
  | 'origin-story'
  | 'mission-values'
  | 'milestones'
  | 'achievements'
  | 'financials'
  | 'esg'
  | 'future-outlook'
  | 'team'
  | 'testimonials'
  | 'products-services'
  | 'market-position'
  | 'call-to-action';

export interface BrandSection {
  type: BrandSectionType;
  title?: string;
  enabled: boolean;
  order: number;
  data?: {
    // For CEO Letter
    ceoName?: string;
    ceoTitle?: string;
    letterHighlights?: string[];

    // For Financials
    revenue?: string;
    growth?: string;
    keyMetrics?: { label: string; value: string; change?: string }[];

    // For Milestones
    timeline?: { year: string; event: string }[];

    // For Team
    executives?: { name: string; role: string; bio?: string }[];

    // For ESG
    environmental?: string[];
    social?: string[];
    governance?: string[];

    // For Testimonials
    quotes?: { text: string; author: string; company?: string }[];

    // Generic
    content?: string;
  };
}

export interface BrandStoryConfig {
  contentType: BrandContentType;
  companyInfo: {
    name: string;
    tagline?: string;
    industry: string;
    founded?: string;
    headquarters?: string;
    employees?: string;
    website?: string;
    description: string;
  };
  sections: BrandSection[];
  tone: 'professional' | 'inspiring' | 'conversational' | 'formal' | 'bold';
  visualStyle: 'corporate-clean' | 'modern-gradient' | 'bold-startup' | 'classic-elegant';
  colorScheme?: string[]; // Brand colors
  fiscalYear?: string; // For annual reports
}

export type BrandTone = 'professional' | 'inspiring' | 'conversational' | 'formal' | 'bold';

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

// ============================================
// GREEN ROOM - Character Interview System
// ============================================

export interface ExtractedFact {
  id: string;
  key: string; // e.g., "eye_color", "fear", "motivation"
  value: string;
  source: 'interview' | 'manual' | 'inferred' | 'profile';
  confidence: number; // 0.0 to 1.0
  extractedAt: number; // Timestamp
}

export interface CharacterPersona {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'mentor' | 'comic-relief' | 'other';
  voiceStyle: string; // e.g., "Sarcastic and witty", "Warm and nurturing"
  background: string;
  visualDescription: string;
  personality: string[];
  quirks: string[];
  goals: string[];
  fears: string[];
  relationships: {
    characterId: string;
    characterName: string;
    type: string; // e.g., "rival", "best friend", "secret admirer"
  }[];
  extractedFacts: ExtractedFact[];
  avatarUrl?: string;
  createdAt: number;
  lastInterviewAt?: number;
}

export interface GreenRoomMessage {
  id: string;
  role: 'author' | 'character';
  content: string;
  characterId?: string;
  extractedFacts?: ExtractedFact[];
  timestamp: number;
}

export interface GreenRoomSession {
  id: string;
  projectId: string;
  characterId: string;
  characterName: string;
  messages: GreenRoomMessage[];
  status: 'active' | 'paused' | 'completed';
  totalFactsExtracted: number;
  startedAt: number;
  lastActiveAt: number;
}

// ============================================
// REMIX STUDIO - World Forking System
// ============================================

export interface RemixableWorld {
  id: string;
  name: string;
  description: string;
  coverImage?: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;

  // World Content
  magicSystem?: string;
  locations: {
    id: string;
    name: string;
    description: string;
    visualDescription: string;
  }[];
  lore: string;
  rules: string[]; // e.g., "Magic has a cost", "No one can fly"
  era: string; // e.g., "Medieval", "Futuristic", "Modern"

  // Sharing Settings
  isPublic: boolean;
  allowRemix: boolean;
  requireCredit: boolean;
  license: 'open' | 'attribution' | 'non-commercial' | 'restricted';

  // Stats
  totalRemixes: number;
  totalLikes: number;
  totalViews: number;
  tags: string[];

  createdAt: number;
  updatedAt: number;
}

export interface WorldFork {
  id: string;
  parentWorldId: string;
  parentWorldName: string;
  originalCreatorId: string;
  originalCreatorName: string;

  // The forked version
  forkedWorldId: string;
  forkedByUserId: string;
  forkedByUserName: string;

  // Lineage
  generationNumber: number; // 1 = first fork, 2 = fork of a fork, etc.
  ancestorChain: string[]; // Array of world IDs from root to parent

  createdAt: number;
}

export interface RemixCredits {
  projectId: string;
  credits: {
    worldId: string;
    worldName: string;
    creatorId: string;
    creatorName: string;
    generationNumber: number;
  }[];
}
