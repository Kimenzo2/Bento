// ============================================================================
// GENESIS CURRICULUM-BASED LEARNING ENGINE - Type Definitions
// ============================================================================

// Standards Frameworks
export type StandardsFramework = 'CCSS' | 'NGSS' | 'CASEL' | 'State-Specific' | 'SEL' | 'State';

// Additional type aliases for backwards compatibility
export type LearningStyle = 'Visual' | 'Auditory' | 'Kinesthetic' | 'ReadWrite' | 'Mixed' | 'visual' | 'auditory' | 'kinesthetic' | 'read-write' | 'mixed';
export type GradeBand = 'K-2' | '3-5' | '6-8' | '9-12';
export type BloomsTaxonomyLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create' | 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
export type QuestionType = 'MultipleChoice' | 'TrueFalse' | 'ShortAnswer' | 'Extended' | 'Performance';
export type DifferentiationTier = 'approaching' | 'onLevel' | 'advanced';
export type SELCompetency = 'SelfAwareness' | 'SelfManagement' | 'SocialAwareness' | 'RelationshipSkills' | 'ResponsibleDecisionMaking' | 'selfAwareness' | 'selfManagement' | 'socialAwareness' | 'relationshipSkills' | 'responsibleDecisionMaking';

// Answer Choice for assessments
export interface AnswerChoice {
    id: string;
    text: string;
    isCorrect?: boolean;
    feedback?: string;
}

// Common Core Standard (simple format for service)
export interface CommonCoreStandard {
    code: string;
    description: string;
    gradeLevel?: string;
    strand?: string;
}

export interface Standard {
    code: string;
    framework: StandardsFramework;
    description: string;
    gradeLevel: string;
    subject: string;
    strand?: string;
    cluster?: string;
}

// Common Core State Standards
export interface CCSSStandard extends Standard {
    framework: 'CCSS';
    domain: 'ELA' | 'Math';
    subdomain?: string;
}

// Next Generation Science Standards
export interface NGSSStandard extends Standard {
    framework: 'NGSS';
    dimension: 'SEP' | 'CCC' | 'DCI'; // Science & Engineering Practices, Crosscutting Concepts, Disciplinary Core Ideas
    topic: string;
    performanceExpectation?: string;
}

// Social-Emotional Learning (CASEL)
export interface SELStandard extends Standard {
    framework: 'CASEL';
    competency: 'SelfAwareness' | 'SelfManagement' | 'SocialAwareness' | 'RelationshipSkills' | 'ResponsibleDecisionMaking';
    indicator: string;
}

// Student Profile
export interface StudentProfile {
    ageRange?: string;
    gradeLevel?: string;
    targetGradeLevel?: number;
    readingLevel: 'Below Grade Level' | 'On Grade Level' | 'Above Grade Level' | 'below' | 'at' | 'above';
    lexileRange?: string;
    learningStyle?: 'Visual' | 'Auditory' | 'Kinesthetic' | 'ReadWrite' | 'Mixed';
    learningStyles?: LearningStyle[];
    interests?: string[];
    specialNeeds?: SpecialNeeds;
    culturalBackground?: string;
    languageBackground?: LanguageBackground;
    englishLearnerStatus?: {
        isEL: boolean;
        proficiencyLevel: number;
        homeLanguage: string;
    };
}

export interface SpecialNeeds {
    hasIEP: boolean;
    has504: boolean;
    accommodations: string[];
    modifications: string[];
}

export interface LanguageBackground {
    primaryLanguage: string;
    isELL: boolean;
    englishProficiency?: 'Beginning' | 'Intermediate' | 'Advanced' | 'Fluent';
}

// Pedagogical Approach
export interface PedagogicalApproach {
    method: 'DirectInstruction' | 'InquiryBased' | 'ProjectBased' | 'Socratic' | 'PhenomenonBased' | 'GameBased';
    scaffoldingLevel: 'High' | 'Medium' | 'Low';
    assessmentType: 'Formative' | 'Summative' | 'PerformanceBased' | 'Portfolio';
    differentiationStrategy: DifferentiationStrategy;
}

export interface DifferentiationStrategy {
    belowGradeLevel: string[];
    onGradeLevel: string[];
    aboveGradeLevel: string[];
    ellSupports: string[];
    specialNeedsAccommodations: string[];
}

// Curriculum Request
export interface CurriculumRequest {
    gradeLevel: string;
    subject: CurriculumSubject;
    standards: {
        framework: StandardsFramework;
        specificStandards: string[];
        learningObjectives: string[];
    };
    contentType: ContentType;
    studentProfile: StudentProfile;
    pedagogicalApproach: PedagogicalApproach;
    engagementHooks: EngagementHooks;
    duration: string;
    theme?: string;
}

// Curriculum Generation Request (for service)
export interface CurriculumGenerationRequest {
    subject: string;
    gradeLevel: number;
    standards: { code: string; description: string }[];
    topic: string;
    pageCount?: number;
    pedagogicalApproach?: string;
    language?: string;
    studentProfile?: {
        targetGradeLevel?: number;
        readingLevel?: string;
        learningStyles?: LearningStyle[];
        interests?: string[];
        specialNeeds?: {
            hasIEP?: boolean;
            has504?: boolean;
            accommodations?: string[];
            modifications?: string[];
        };
        englishLearnerStatus?: {
            isEL?: boolean;
            proficiencyLevel?: string | number;
            homeLanguage?: string;
        };
    };
    selFocus?: {
        primaryCompetency: SELCompetency;
        indicators: string[];
    };
    includeAssessments?: boolean;
    includeFamilyEngagement?: boolean;
}

// Instructional Page (for viewer - simplified)
export interface InstructionalPage {
    pageNumber: number;
    title?: string;
    pageType?: string;
    standardsCovered: string[];
    narrativeContent?: string;
    vocabularyFocus?: Array<{ term: string; definition: string; example?: string }>;
    instructionalContent?: {
        concept: string;
        vocabulary: { term: string; definition: string; tier?: number }[];
        explanation: string;
        examples?: string[];
        nonExamples?: string[];
        scaffolding?: string[];
    };
    learningActivity?: {
        type: string;
        title: string;
        instructions: string[];
        materials?: string[];
    };
    differentiatedContent?: {
        approaching?: { content: string; supports: string[] };
        onLevel?: { content: string; supports: string[] };
        advanced?: { content: string; supports: string[] };
    };
    selMoment?: {
        competency: SELCompetency;
        prompt: string;
        discussionQuestions?: string[];
    };
    selIntegration?: {
        competency: SELCompetency;
        scenario?: string;
        reflectionPrompt?: string;
        discussionQuestions?: string[];
    };
    interactiveElements?: Array<{
        type: string;
        prompt: string;
        options?: string[];
    }>;
    teacherNotes?: string | {
        anticipatedMisconceptions?: string[];
        discussionStarters?: string[];
        pacing?: string;
    };
    imagePrompt?: string;
    imageUrl?: string;
}

export type CurriculumSubject = 
    | 'Math' 
    | 'Science' 
    | 'ELA' 
    | 'SocialStudies' 
    | 'SEL' 
    | 'STEM' 
    | 'Arts'
    | 'MultiSubject';

export type ContentType = 
    | 'Story' 
    | 'Workbook' 
    | 'InteractiveLab' 
    | 'Assessment' 
    | 'Project'
    | 'PhenomenonUnit'
    | 'SELLesson';

export interface EngagementHooks {
    narrativeStyle: 'Adventure' | 'Mystery' | 'RealWorldProblem' | 'Fantasy' | 'Historical' | 'SciFi' | 'Sports';
    characterDiversity: CharacterDiversity;
    gameification: GameificationSettings;
    culturalRelevance: string;
}

export interface CharacterDiversity {
    ethnicities: string[];
    abilities: string[];
    familyStructures: string[];
    genderRepresentation: string[];
}

export interface GameificationSettings {
    enabled: boolean;
    badges: boolean;
    progressTracking: boolean;
    leaderboard: boolean;
    rewards: string[];
}

// Curriculum Ebook Output
export interface CurriculumEbook {
    id?: string;
    ebookId?: string;
    metadata: CurriculumMetadata;
    narrativeFramework: NarrativeFramework;
    instructionalSequence: InstructionalSection[] | InstructionalPage[];
    assessmentSuite?: AssessmentSuite;
    assessmentBank?: AssessmentQuestion[];
    dataTracking?: DataTracking;
    teacherResources?: TeacherResources;
    familyEngagement?: FamilyEngagement;
}

export interface CurriculumMetadata {
    title: string;
    subject: CurriculumSubject | string;
    gradeLevel: string;
    readingLevel: string;
    lexileScore?: number;
    duration: string;
    estimatedDuration?: string;
    createdAt?: string;
    version?: string;
    vocabularyTier?: number;
    alignedStandards: AlignedStandard[];
    learningObjectives: string[];
    essentialQuestions: string[];
    differentiationSupports?: DifferentiationStrategy;
    materialsNeeded: string[];
    technologyRequirements?: string[];
}

export interface AlignedStandard {
    framework: StandardsFramework;
    code: string;
    description: string;
    coveredIn: string[];
    masteryIndicators: string[];
}

export interface NarrativeFramework {
    hook: string;
    phenomenon?: string; // For NGSS
    setting: string;
    characters: CurriculumCharacter[];
    conflict: string;
    resolution: string;
    theme: string;
    culturalConnections: string[];
}

export interface CurriculumCharacter {
    name: string;
    role: 'Protagonist' | 'Guide' | 'Peer' | 'Mentor' | 'Antagonist';
    background: {
        ethnicity?: string;
        abilities?: string[];
        familyStructure?: string;
        interests: string[];
    };
    personality: string[];
    selTraits: string[]; // SEL competencies modeled
    visualDescription: string;
    growthArc: string;
}

export interface InstructionalSection {
    sectionNumber: number;
    title: string;
    standardsFocus: string[];
    estimatedTime: string;
    pages: CurriculumPage[];
}

export interface CurriculumPage {
    pageNumber: number;
    standardsCovered: string[];
    contentType: 'Story' | 'Explanation' | 'Activity' | 'Assessment' | 'Reflection' | 'Investigation';
    
    narrativeContent: {
        text: string;
        dialogue?: DialogueExchange[];
        visualDescription: string;
        readAloudNotes?: string;
    };
    
    instructionalContent: {
        concept: string;
        vocabulary: VocabularyItem[];
        explanation: string;
        examples: string[];
        nonExamples: string[];
        misconceptions: string[];
        connections: {
            priorKnowledge: string[];
            realWorld: string[];
            crossCurricular: string[];
        };
    };
    
    learningActivity?: LearningActivity;
    assessment?: PageAssessment;
    selIntegration?: SELIntegration;
    differentiatedContent: DifferentiatedContent;
    parentGuide: ParentGuide;
}

export interface DialogueExchange {
    speaker: string;
    text: string;
    emotion?: string;
    action?: string;
}

export interface VocabularyItem {
    term: string;
    definition: string;
    contextSentence: string;
    tier: 1 | 2 | 3; // Tier 1: everyday, Tier 2: academic, Tier 3: domain-specific
    cognates?: string[]; // For ELL support
    visualSupport?: string;
}

export interface LearningActivity {
    type: 'HandsOn' | 'Discussion' | 'ProblemSolving' | 'Creation' | 'Investigation' | 'Simulation' | 'Game';
    title: string;
    objective: string;
    instructions: string[];
    materials: string[];
    duration: string;
    grouping: 'Individual' | 'Pairs' | 'SmallGroup' | 'WholeClass';
    scaffolding: {
        modeling: string;
        guidedPractice: string;
        independentPractice: string;
    };
    differentiation: {
        support: string[];
        extension: string[];
        ellSupport: string[];
    };
    successCriteria: string[];
    teacherNotes: string;
}

export interface PageAssessment {
    type: 'Formative' | 'Summative';
    format: 'MultipleChoice' | 'OpenEnded' | 'Performance' | 'Observation' | 'SelfAssessment';
    questions: AssessmentQuestion[];
    rubric?: Rubric;
}

export interface AssessmentQuestion {
    id: string;
    prompt: string;
    type: 'MultipleChoice' | 'TrueFalse' | 'ShortAnswer' | 'Extended' | 'Performance';
    standardAlignment: string;
    dokLevel: 1 | 2 | 3 | 4; // Depth of Knowledge
    options?: string[];
    correctAnswer: string | string[];
    pointValue: number;
    feedback: {
        correct: string;
        incorrect: string[];
        hints: string[];
    };
    accommodations?: string[];
    
    // Extended properties for CurriculumAssessment component
    questionId?: string;
    questionType?: 'multipleChoice' | 'openEnded' | 'constructedResponse' | 'trueFalse' | 'matching';
    questionStem?: string;
    stimulusText?: string;
    bloomsLevel?: BloomsTaxonomyLevel | string;
    standardsAligned?: string[];
    answerChoices?: AnswerChoice[];
    rubric?: {
        maxPoints?: number;
        criteria?: string[];
    };
    exemplarResponse?: string;
}

export interface Rubric {
    criteria: RubricCriterion[];
    totalPoints: number;
}

export interface RubricCriterion {
    name: string;
    description: string;
    levels: {
        score: number;
        label: string;
        description: string;
    }[];
    weight: number;
}

export interface SELIntegration {
    competency: 'SelfAwareness' | 'SelfManagement' | 'SocialAwareness' | 'RelationshipSkills' | 'ResponsibleDecisionMaking';
    scenario: string;
    characterModeling: string;
    reflectionPrompt: string;
    applicationActivity: string;
    discussionQuestions: string[];
}

export interface DifferentiatedContent {
    approaching: {
        scaffolds: string[];
        simplifiedText?: string;
        visualSupports: string[];
        additionalPractice: string[];
    };
    onLevel: {
        coreContent: string;
        practiceActivities: string[];
    };
    advanced: {
        extensions: string[];
        challengeQuestions: string[];
        independentInquiry: string[];
    };
    ellSupport: {
        sentenceFrames: string[];
        visualVocabulary: string[];
        nativeLanguageSupport?: string[];
        simplifiedInstructions: string[];
    };
}

export interface ParentGuide {
    learningGoal: string;
    keyVocabulary: string[];
    supportStrategies: string[];
    questionsToAsk: string[];
    homeExtensions: string[];
    commonMisconceptions: string[];
    encouragementTips: string[];
}

// Assessment Suite
export interface AssessmentSuite {
    preAssessment: PreAssessment;
    formativeChecks: FormativeCheck[];
    summativeAssessment: SummativeAssessment;
    portfolio: PortfolioRequirements;
    adaptivePaths: AdaptivePath[];
}

export interface PreAssessment {
    purpose: string;
    questions: AssessmentQuestion[];
    diagnosticRubric: DiagnosticRubric;
    pathwayRecommendations: {
        scoreRange: string;
        pathway: 'Foundational' | 'OnLevel' | 'Enrichment';
        scaffolding: string;
    }[];
}

export interface DiagnosticRubric {
    skillsAssessed: string[];
    proficiencyLevels: {
        skill: string;
        emerging: string;
        developing: string;
        proficient: string;
        advanced: string;
    }[];
}

export interface FormativeCheck {
    location: string;
    standardAssessed: string;
    checkType: 'QuickCheck' | 'ExitTicket' | 'ThumbsUpDown' | 'ThinkPairShare' | 'Observation';
    questions: AssessmentQuestion[];
    adaptiveResponse: {
        ifStruggling: string;
        ifMastering: string;
    };
}

export interface SummativeAssessment {
    format: string;
    standards: string[];
    questions: AssessmentQuestion[];
    rubric: Rubric;
    performanceTask: PerformanceTask;
    passingScore: number;
}

export interface PerformanceTask {
    title: string;
    scenario: string;
    task: string;
    requirements: string[];
    rubric: Rubric;
    exemplar: string;
    studentDirections: string[];
}

export interface PortfolioRequirements {
    artifacts: string[];
    reflectionPrompts: string[];
    selfAssessmentRubric: Rubric;
    conferenceQuestions: string[];
}

export interface AdaptivePath {
    triggerCondition: string;
    pathway: string;
    content: string[];
    duration: string;
}

// Data Tracking
export interface DataTracking {
    progressIndicators: ProgressIndicator[];
    masteryTracking: MasteryTracking;
    reportingViews: ReportingViews;
}

export interface ProgressIndicator {
    standard: string;
    currentLevel: 'Emerging' | 'Developing' | 'Proficient' | 'Advanced';
    evidence: string[];
    nextSteps: string[];
}

export interface MasteryTracking {
    standards: {
        code: string;
        attempts: number;
        bestScore: number;
        masteryAchieved: boolean;
        evidenceArtifacts: string[];
    }[];
    overallProgress: number;
    strengthAreas: string[];
    growthAreas: string[];
}

export interface ReportingViews {
    studentView: {
        progressVisualization: string;
        celebrationMessages: string[];
        nextGoals: string[];
    };
    parentView: {
        standardsProgress: string;
        homeSupport: string[];
        conferenceNotes: string;
    };
    teacherView: {
        classOverview: string;
        individuaLData: string;
        interventionSuggestions: string[];
        groupingRecommendations: string[];
    };
}

// Teacher Resources
export interface TeacherResources {
    unitOverview: UnitOverview;
    lessonPlans: LessonPlan[];
    answerKey: AnswerKey;
    discussionGuide: DiscussionGuide;
    differentiationGuide: DifferentiationGuide;
    assessmentGuide: AssessmentGuide;
    extensions: Extension[];
    interventions: Intervention[];
}

export interface UnitOverview {
    title: string;
    duration: string;
    standards: string[];
    essentialQuestions: string[];
    endurance: string; // Why this matters long-term
    leverage: string; // Cross-curricular connections
    readiness: string; // Prerequisites
    materials: string[];
    technologyNeeds: string[];
    priorKnowledge: string[];
    commonMisconceptions: string[];
}

export interface LessonPlan {
    day: number;
    title: string;
    objectives: string[];
    standards: string[];
    materials: string[];
    procedure: LessonProcedure;
    differentiation: DifferentiationNotes;
    assessment: string;
    homework?: string;
    reflection: string;
}

export interface LessonProcedure {
    opening: {
        duration: string;
        activity: string;
        purpose: string;
    };
    instruction: {
        duration: string;
        iDo: string;
        weDo: string;
        youDo: string;
    };
    practice: {
        duration: string;
        activity: string;
        monitoring: string;
    };
    closing: {
        duration: string;
        activity: string;
        exitTicket?: string;
    };
}

export interface DifferentiationNotes {
    struggling: string[];
    advanced: string[];
    ell: string[];
    specialNeeds: string[];
}

export interface AnswerKey {
    pages: {
        pageNumber: number;
        answers: {
            questionId: string;
            correctAnswer: string;
            explanation: string;
            commonErrors: string[];
        }[];
    }[];
}

export interface DiscussionGuide {
    questions: {
        question: string;
        purpose: string;
        expectedResponses: string[];
        followUps: string[];
        misconceptionAddressed?: string;
    }[];
    protocols: string[];
    groupingStrategies: string[];
}

export interface DifferentiationGuide {
    universalDesign: string[];
    tieredAssignments: {
        tier: string;
        description: string;
        activities: string[];
    }[];
    flexibleGrouping: string[];
    choiceBoards: string[];
}

export interface AssessmentGuide {
    formativeStrategies: string[];
    rubricExplanations: string[];
    gradingGuidelines: string[];
    feedbackFrameworks: string[];
    dataUsage: string[];
}

export interface Extension {
    title: string;
    description: string;
    standards: string[];
    materials: string[];
    procedure: string[];
    assessment: string;
}

export interface Intervention {
    skill: string;
    indicators: string[];
    activities: string[];
    materials: string[];
    duration: string;
    progressMonitoring: string;
    exitCriteria: string;
}

// Family Engagement
export interface FamilyEngagement {
    welcomeLetter: string;
    unitOverview: string;
    homeConnection: HomeConnection[];
    progressCommunication: ProgressCommunication;
    familyActivities: FamilyActivity[];
    resources: FamilyResource[];
    multilingualSupport: MultilingualContent;
    // Additional properties for viewer compatibility
    parentLetter?: string;
    discussionQuestions?: string[];
    extendedLearning?: { title: string; description: string }[];
}

export interface HomeConnection {
    week: number;
    learningFocus: string;
    conversationStarters: string[];
    practiceActivity: string;
    materialsNeeded: string[];
    timeRequired: string;
}

export interface ProgressCommunication {
    frequency: string;
    format: string;
    contentIncluded: string[];
    parentActionItems: string[];
}

export interface FamilyActivity {
    title: string;
    description: string;
    learningConnection: string;
    materials: string[];
    instructions: string[];
    variations: string[];
}

export interface FamilyResource {
    title: string;
    type: 'Website' | 'Video' | 'Book' | 'App' | 'Game';
    url?: string;
    description: string;
    gradeAppropriate: boolean;
    free: boolean;
}

export interface MultilingualContent {
    languages: string[];
    translatedMaterials: string[];
    culturalAdaptations: string[];
}

// Standards Database Types
export interface StandardsDatabase {
    ccssELA: CCSSStandard[];
    ccssMath: CCSSStandard[];
    ngss: NGSSStandard[];
    sel: SELStandard[];
}

// Grade Level Configuration
export interface GradeLevelConfig {
    grade: string;
    ageRange: string;
    lexileRange: string;
    sentenceComplexity: 'Simple' | 'Compound' | 'Complex';
    vocabularyLevel: string;
    attentionSpan: string;
    pageLength: {
        min: number;
        max: number;
    };
    illustrationGuidelines: string;
}

export const GRADE_CONFIGS: Record<string, GradeLevelConfig> = {
    'K': {
        grade: 'Kindergarten',
        ageRange: '5-6',
        lexileRange: 'BR-400L',
        sentenceComplexity: 'Simple',
        vocabularyLevel: 'Basic sight words, simple nouns/verbs',
        attentionSpan: '5-10 minutes',
        pageLength: { min: 10, max: 30 },
        illustrationGuidelines: 'Large, colorful, minimal detail, one main focus'
    },
    '1': {
        grade: '1st Grade',
        ageRange: '6-7',
        lexileRange: '190L-530L',
        sentenceComplexity: 'Simple',
        vocabularyLevel: 'High-frequency words, simple descriptors',
        attentionSpan: '10-15 minutes',
        pageLength: { min: 20, max: 50 },
        illustrationGuidelines: 'Colorful, supports text, moderate detail'
    },
    '2': {
        grade: '2nd Grade',
        ageRange: '7-8',
        lexileRange: '420L-650L',
        sentenceComplexity: 'Simple',
        vocabularyLevel: 'Expanding vocabulary, basic academic terms',
        attentionSpan: '15-20 minutes',
        pageLength: { min: 30, max: 75 },
        illustrationGuidelines: 'Detailed scenes, character expressions'
    },
    '3': {
        grade: '3rd Grade',
        ageRange: '8-9',
        lexileRange: '520L-820L',
        sentenceComplexity: 'Compound',
        vocabularyLevel: 'Tier 2 academic vocabulary emerging',
        attentionSpan: '20-25 minutes',
        pageLength: { min: 50, max: 100 },
        illustrationGuidelines: 'Complex scenes, diagrams for concepts'
    },
    '4': {
        grade: '4th Grade',
        ageRange: '9-10',
        lexileRange: '740L-940L',
        sentenceComplexity: 'Compound',
        vocabularyLevel: 'Domain-specific vocabulary, figurative language',
        attentionSpan: '25-30 minutes',
        pageLength: { min: 75, max: 150 },
        illustrationGuidelines: 'Detailed, can include infographics'
    },
    '5': {
        grade: '5th Grade',
        ageRange: '10-11',
        lexileRange: '830L-1010L',
        sentenceComplexity: 'Complex',
        vocabularyLevel: 'Abstract concepts, sophisticated vocabulary',
        attentionSpan: '30-40 minutes',
        pageLength: { min: 100, max: 200 },
        illustrationGuidelines: 'Can be more abstract, charts/graphs'
    }
};
