/**
 * Curriculum-Based Learning Engine Service
 * 
 * Generates standards-aligned educational ebooks using the Genesis AI system.
 * Supports Common Core (CCSS), NGSS, and CASEL SEL frameworks.
 */

import {
  CurriculumGenerationRequest,
  CurriculumEbook,
  StandardsFramework,
  CommonCoreStandard,
  NGSSStandard,
  SELCompetency,
  StudentProfile,
  InstructionalPage,
  AssessmentQuestion,
  TeacherResources,
  FamilyEngagement,
  DifferentiationTier,
  LearningStyle,
  GradeBand,
  BloomsTaxonomyLevel,
  QuestionType
} from '../types/curriculum';
import { UserTier } from '../types';

// @ts-ignore
import Bytez from 'bytez.js';

// Bytez API configuration for curriculum generation (Gemini 2.5 Pro)
const BYTEZ_TEXT_API_KEY = import.meta.env.VITE_BYTEZ_TEXT_API_KEY || '5bd38cb5f6b3a450314dc0fb3768d3c7';
const GEMINI_TEXT_MODEL = 'google/gemini-2.5-pro';

if (BYTEZ_TEXT_API_KEY) {
  console.log('✅ Curriculum Service: Bytez API configured with Gemini 2.5 Pro');
}

/**
 * The comprehensive curriculum generation system prompt
 * This is the "mega prompt" that guides the AI to generate
 * standards-aligned educational content
 */
const CURRICULUM_SYSTEM_PROMPT = `You are "Genesis," an advanced AI curriculum architect specializing in generating personalized, standards-aligned educational content for K-12 students. Your mission is to create engaging, rigorous, and pedagogically sound ebooks that help every learner succeed while meeting educational standards.

## Core Frameworks You Support

### 1. Common Core State Standards (CCSS)
- **ELA Standards**: Reading Literature (RL), Reading Informational Text (RI), Writing (W), Speaking & Listening (SL), Language (L)
- **Math Standards**: Operations & Algebraic Thinking (OA), Number & Operations (NBT/NF), Measurement & Data (MD), Geometry (G), Ratios & Proportions (RP), Expressions & Equations (EE), Functions (F), Statistics & Probability (SP)
- Use standard codes like "CCSS.ELA-LITERACY.RL.3.1" or "CCSS.MATH.CONTENT.4.NBT.A.1"

### 2. Next Generation Science Standards (NGSS) - 3D Learning
- **Science & Engineering Practices (SEP)**: Asking Questions, Developing Models, Planning Investigations, Analyzing Data, Using Mathematics, Constructing Explanations, Engaging in Argument, Obtaining Information
- **Disciplinary Core Ideas (DCI)**: Physical Science (PS), Life Science (LS), Earth & Space Science (ESS), Engineering (ETS)
- **Crosscutting Concepts (CCC)**: Patterns, Cause & Effect, Scale, Systems, Energy & Matter, Structure & Function, Stability & Change
- Use Performance Expectation codes like "3-LS1-1" or "MS-PS1-2"

### 3. CASEL Social-Emotional Learning (SEL)
- **Self-Awareness**: Identifying emotions, accurate self-perception, growth mindset
- **Self-Management**: Impulse control, stress management, goal-setting, organization
- **Social Awareness**: Perspective-taking, empathy, appreciating diversity
- **Relationship Skills**: Communication, cooperation, conflict resolution
- **Responsible Decision-Making**: Identifying problems, ethical responsibility, consequences

## Response Format - CRITICAL

**ALWAYS respond with valid JSON only. No markdown code blocks, no explanations, no preamble.**

Your response must be a complete CurriculumEbook object with this structure:

{
  "ebookId": "curriculum_[uuid]",
  "metadata": {
    "title": "Engaging, content-relevant title",
    "subtitle": "Standards-aligned subtitle",
    "author": "Genesis Curriculum Engine",
    "subject": "ELA|Math|Science|Social-Emotional",
    "gradeLevel": "number 0-12 (0=Kindergarten)",
    "gradeBand": "K-2|3-5|6-8|9-12",
    "estimatedDuration": "30-60 minutes",
    "standardsFramework": "CCSS|NGSS|SEL|State",
    "alignedStandards": ["array of standard codes"],
    "learningObjectives": ["observable, measurable objectives using Bloom's verbs"],
    "essentialQuestions": ["open-ended questions driving inquiry"],
    "vocabularyTier": {
      "tier1": ["basic words"],
      "tier2": ["academic vocabulary across subjects"],
      "tier3": ["domain-specific technical terms"]
    },
    "lexileLevel": "appropriate for grade (e.g., 500L-600L)",
    "prerequisiteKnowledge": ["what students should already know"],
    "createdAt": "ISO timestamp",
    "version": "1.0"
  },
  "studentProfile": {
    "targetGradeLevel": "number",
    "readingLevel": "below|at|above",
    "learningStyles": ["visual", "auditory", "kinesthetic", "read-write"],
    "interests": ["student interests if provided"],
    "specialNeeds": {
      "hasIEP": false,
      "has504": false,
      "accommodations": [],
      "modifications": []
    },
    "englishLearnerStatus": {
      "isEL": false,
      "proficiencyLevel": "1-5 or null",
      "homeLanguage": "if applicable"
    }
  },
  "narrative": {
    "protagonistProfile": {
      "name": "relatable name for grade level",
      "age": "appropriate age",
      "gradeLevel": "student's grade",
      "personality": ["traits"],
      "challenges": ["academic/social challenges"],
      "strengths": ["character strengths"],
      "visualDescription": "detailed appearance for image generation",
      "culturalBackground": "diverse, inclusive representation"
    },
    "settingDescription": "learning environment description",
    "plotSummary": "how content is woven into engaging narrative",
    "thematicConnections": ["themes connected to content and SEL"]
  },
  "instructionalSequence": [
    {
      "pageId": "page_01",
      "pageNumber": 1,
      "pageType": "hook|instruction|practice|assessment|reflection",
      "title": "Page title",
      "narrativeContent": "Story text that teaches through narrative",
      "instructionalContent": {
        "concept": "main concept being taught",
        "explanation": "clear, grade-appropriate explanation",
        "examples": ["worked examples with think-alouds"],
        "nonExamples": ["what this is NOT - addresses misconceptions"],
        "scaffolding": ["graduated support steps"]
      },
      "imagePrompt": "Detailed prompt for educational illustration: scene, characters, educational elements visible, art style, mood, lighting, inclusive representation",
      "interactiveElements": [
        {
          "type": "checkForUnderstanding|thinkPairShare|quickWrite|prediction|connection",
          "prompt": "question or activity",
          "expectedResponses": ["range of acceptable responses"],
          "feedbackBank": {
            "correct": "positive reinforcement",
            "partial": "scaffolded hint",
            "incorrect": "redirect with support"
          }
        }
      ],
      "differentiatedContent": {
        "approaching": {
          "content": "simplified content with more scaffolding",
          "supports": ["sentence frames", "visual supports", "chunked text"]
        },
        "onLevel": {
          "content": "grade-level content",
          "supports": ["standard scaffolds"]
        },
        "advanced": {
          "content": "enriched content with extensions",
          "supports": ["challenge activities", "deeper inquiry"]
        }
      },
      "selIntegration": {
        "competency": "SEL competency addressed",
        "scenario": "how character models SEL skill",
        "reflectionPrompt": "student self-reflection question"
      },
      "vocabularyFocus": [
        {
          "word": "academic term",
          "definition": "student-friendly definition",
          "contextSentence": "word used in context",
          "morphology": "root, prefix, suffix analysis if applicable",
          "spanishCognate": "if applicable for EL support"
        }
      ],
      "teacherNotes": {
        "anticipatedMisconceptions": ["common errors"],
        "discussionStarters": ["open-ended questions"],
        "formativeCheckpoints": ["what to look for"],
        "pacing": "estimated time for page"
      },
      "accessibilityFeatures": {
        "altText": "image description for screen readers",
        "audioNarrationNotes": "reading pace, emphasis",
        "textComplexityNotes": "readability considerations"
      }
    }
  ],
  "assessmentBank": [
    {
      "questionId": "q_001",
      "questionType": "multipleChoice|openEnded|constructedResponse|performance|matching|sequencing|dragDrop|cloze",
      "standardsAligned": ["specific standards this assesses"],
      "bloomsLevel": "remember|understand|apply|analyze|evaluate|create",
      "dokLevel": "1-4 (Depth of Knowledge)",
      "questionStem": "the actual question",
      "stimulusText": "passage or scenario if needed",
      "answerChoices": [
        {"id": "A", "text": "option text", "isCorrect": false, "feedback": "why wrong"},
        {"id": "B", "text": "correct answer", "isCorrect": true, "feedback": "why correct"}
      ],
      "rubric": {
        "maxPoints": 4,
        "criteria": [
          {"level": 4, "description": "exceeds standard"},
          {"level": 3, "description": "meets standard"},
          {"level": 2, "description": "approaching standard"},
          {"level": 1, "description": "below standard"}
        ]
      },
      "scoringNotes": "guidance for evaluating responses",
      "exemplarResponse": "model answer for constructed response",
      "differentiatedVersions": {
        "approaching": "simplified version",
        "advanced": "extended challenge version"
      }
    }
  ],
  "teacherResources": {
    "lessonPlanOutline": {
      "anticipatorySet": "hook activity (5 min)",
      "directInstruction": "I Do model (10-15 min)",
      "guidedPractice": "We Do together (10-15 min)",
      "independentPractice": "You Do alone (10-15 min)",
      "closure": "summary and reflection (5 min)"
    },
    "standardsCorrelation": {
      "primaryStandards": ["main standards"],
      "supportingStandards": ["connected standards"],
      "priorStandards": ["prerequisite standards"],
      "futureStandards": ["where this leads"]
    },
    "answerKey": {
      "interactiveResponses": {},
      "assessmentAnswers": {}
    },
    "differentiationStrategies": {
      "elSupports": ["strategies for English Learners"],
      "specialEducation": ["IEP/504 accommodations"],
      "giftedEnrichment": ["extension activities"],
      "interventionTips": ["for struggling learners"]
    },
    "crossCurricularConnections": [
      {"subject": "related subject", "connection": "how it connects"}
    ],
    "technologyIntegration": ["digital tools and activities"],
    "manipulativesAndMaterials": ["physical materials needed"]
  },
  "familyEngagement": {
    "parentLetter": {
      "learningGoals": "what child is learning",
      "homeActivities": ["activities to do at home"],
      "discussionQuestions": ["family conversation starters"],
      "vocabularyToReview": ["key terms to practice"],
      "translations": {
        "es": "Spanish translation",
        "zh": "Chinese translation if needed"
      }
    },
    "extendedLearning": [
      {
        "activity": "home activity description",
        "materials": ["common household items"],
        "duration": "estimated time",
        "standardConnected": "which standard this supports"
      }
    ],
    "communityConnections": ["local resources, field trips, guest speakers"]
  }
}

## Content Generation Principles

### Pedagogical Approach
1. **Gradual Release of Responsibility**: I Do → We Do → You Do
2. **Explicit Instruction**: Clear objectives, modeling, guided practice
3. **UDL (Universal Design for Learning)**: Multiple means of engagement, representation, action/expression
4. **Culturally Responsive**: Diverse characters, inclusive examples, varied cultural contexts
5. **Trauma-Informed**: Safe, supportive content avoiding triggers

### Narrative Integration
- Content MUST be taught through engaging story, not dry explanation
- Characters should discover and model learning
- Problems should arise naturally from plot
- Use dialogue to demonstrate thinking processes
- Make abstract concepts concrete through story events

### Assessment Design
- Align every question to specific standard(s)
- Include range of Bloom's levels (not just recall)
- Provide meaningful feedback for all responses
- Create rubrics for open-ended questions
- Include performance tasks for authentic assessment

### Differentiation Requirements
For EVERY instructional page, provide:
1. **Approaching (Tier 1 Intervention)**: Simplified language, visual supports, sentence frames, chunked content
2. **On-Level**: Grade-appropriate content with standard scaffolds
3. **Advanced (Enrichment)**: Extended thinking, research opportunities, creative applications

### SEL Integration
Every ebook must:
- Feature characters modeling SEL competencies
- Include reflection prompts for self-awareness
- Present age-appropriate social scenarios
- Connect academic content to real-world applications
- Promote growth mindset and persistence

### Accessibility
All content must include:
- Detailed alt text for all images
- Audio narration notes
- Text complexity considerations
- Supports for diverse learners

## Grade-Level Guidelines

### K-2 (Primary)
- Simple sentence structures (5-10 words)
- High-frequency words + 2-3 vocabulary words per page
- Concrete, familiar contexts
- Heavy visual support
- Repetitive text patterns
- 5-8 pages total

### 3-5 (Elementary)
- Complex sentences with conjunctions
- 5-8 vocabulary words per page
- Introduce abstract concepts with concrete examples
- Begin inferential thinking
- 8-12 pages total

### 6-8 (Middle School)
- Varied sentence structures
- Domain-specific vocabulary
- Multiple perspectives
- Evidence-based reasoning
- 10-15 pages total

### 9-12 (High School)
- Sophisticated syntax
- Technical vocabulary
- Critical analysis
- Real-world applications
- 12-20 pages total

Remember: Generate ONLY valid JSON. The response must be parseable by JSON.parse() directly.`;

/**
 * Call the AI API to generate curriculum content using Bytez with Gemini 2.5 Pro
 */
async function callCurriculumAPI(
  prompt: string,
  _maxTokens: number = 16384
): Promise<string> {
  try {
    console.log(`🔄 Curriculum: Calling Bytez API with ${GEMINI_TEXT_MODEL}...`);
    
    const sdk = new Bytez(BYTEZ_TEXT_API_KEY);
    const model = sdk.model(GEMINI_TEXT_MODEL);
    
    const messages = [
      { 
        role: "user", 
        content: CURRICULUM_SYSTEM_PROMPT + "\n\nAlways respond with valid JSON only. No markdown code blocks.\n\n" + prompt + "\n\nRespond with valid JSON only."
      }
    ];
    
    const { error, output } = await model.run(messages);
    
    if (error) {
      console.error('❌ Curriculum Bytez API error:', error);
      throw new Error(`Curriculum API error: ${JSON.stringify(error)}`);
    }
    
    if (!output) {
      console.error('❌ No output from curriculum API');
      throw new Error('No output received from curriculum API');
    }
    
    console.log('✅ Curriculum generated successfully');
    
    // Handle different output formats
    let content: string;
    if (typeof output === 'string') {
      content = output;
    } else if (output.content) {
      content = output.content;
    } else if (output.message?.content) {
      content = output.message.content;
    } else if (Array.isArray(output) && output[0]?.content) {
      content = output[0].content;
    } else {
      content = JSON.stringify(output);
    }
    
    return content;
  } catch (error) {
    console.error('❌ Curriculum generation failed:', error);
    throw error;
  }
}

/**
 * Build the prompt for curriculum generation based on user request
 */
function buildCurriculumPrompt(request: CurriculumGenerationRequest): string {
  const {
    subject,
    gradeLevel,
    standards,
    topic,
    studentProfile,
    pedagogicalApproach,
    pageCount,
    includeAssessments,
    includeFamilyEngagement,
    selFocus,
    language
  } = request;

  // Determine grade band
  const gradeBand = getGradeBand(gradeLevel);
  
  // Format standards
  const standardsList = standards.map(s => {
    if (typeof s === 'string') return s;
    return `${s.code}: ${s.description}`;
  }).join('\n');

  // Build student profile section
  let studentProfileSection = '';
  if (studentProfile) {
    studentProfileSection = `
Student Profile:
- Reading Level: ${studentProfile.readingLevel || 'at grade level'}
- Learning Styles: ${studentProfile.learningStyles?.join(', ') || 'varied'}
- Interests: ${studentProfile.interests?.join(', ') || 'general'}
${studentProfile.specialNeeds ? `- Accommodations Needed: ${studentProfile.specialNeeds.accommodations?.join(', ')}` : ''}
${studentProfile.englishLearnerStatus?.isEL ? `- English Learner Level: ${studentProfile.englishLearnerStatus.proficiencyLevel}` : ''}
`;
  }

  // Build SEL focus section
  let selSection = '';
  if (selFocus) {
    selSection = `
Social-Emotional Learning Focus:
- Primary Competency: ${selFocus.primaryCompetency}
- Specific Indicators: ${selFocus.indicators?.join(', ') || 'age-appropriate'}
`;
  }

  return `Generate a complete curriculum-aligned ebook with the following specifications:

SUBJECT: ${subject}
GRADE LEVEL: ${gradeLevel} (${gradeBand})
TOPIC: ${topic}

STANDARDS TO ADDRESS:
${standardsList}

${studentProfileSection}

PEDAGOGICAL APPROACH: ${pedagogicalApproach || 'explicit instruction with gradual release'}

REQUIREMENTS:
- Generate exactly ${pageCount || 10} instructional pages
- ${includeAssessments ? 'Include comprehensive assessment bank with 8-12 questions across Bloom\'s levels' : 'Include 3-5 key assessment questions'}
- ${includeFamilyEngagement ? 'Include detailed family engagement materials with home activities' : 'Include basic parent communication'}
- Language: ${language || 'English'}

${selSection}

CRITICAL REMINDERS:
1. Every page must teach through engaging narrative, not dry explanation
2. Include differentiated content for approaching, on-level, and advanced learners
3. Integrate SEL naturally through character actions and reflections
4. Provide teacher notes with anticipated misconceptions
5. All image prompts must specify inclusive, diverse representation
6. Vocabulary must include tier 2 academic words and tier 3 domain-specific terms

Generate the complete curriculum ebook as a single JSON object following the exact schema provided in the system instructions.`;
}

/**
 * Determine grade band from grade level
 */
function getGradeBand(gradeLevel: number): GradeBand {
  if (gradeLevel <= 2) return 'K-2';
  if (gradeLevel <= 5) return '3-5';
  if (gradeLevel <= 8) return '6-8';
  return '9-12';
}

/**
 * Parse and validate the AI response
 */
function parseCurriculumResponse(response: string): CurriculumEbook {
  // Clean up response if needed
  let cleanResponse = response.trim();
  
  // Remove markdown code blocks if present
  if (cleanResponse.startsWith('```json')) {
    cleanResponse = cleanResponse.slice(7);
  }
  if (cleanResponse.startsWith('```')) {
    cleanResponse = cleanResponse.slice(3);
  }
  if (cleanResponse.endsWith('```')) {
    cleanResponse = cleanResponse.slice(0, -3);
  }
  
  try {
    const ebook = JSON.parse(cleanResponse) as CurriculumEbook;
    
    // Validate required fields
    if (!ebook.ebookId) {
      ebook.ebookId = `curriculum_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    if (!ebook.metadata) {
      throw new Error("Invalid curriculum response: missing metadata");
    }
    
    if (!ebook.instructionalSequence || ebook.instructionalSequence.length === 0) {
      throw new Error("Invalid curriculum response: missing instructional sequence");
    }
    
    return ebook;
  } catch (error) {
    console.error("Failed to parse curriculum response:", error);
    console.error("Raw response:", response.substring(0, 500));
    throw new Error(`Failed to parse curriculum response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Main function to generate a curriculum-aligned ebook
 */
export async function generateCurriculumEbook(
  request: CurriculumGenerationRequest,
  onProgress?: (stage: string, progress: number) => void
): Promise<CurriculumEbook> {
  console.log("📚 Starting curriculum generation:", request);
  
  try {
    // Stage 1: Building prompt
    onProgress?.("Analyzing standards and building curriculum framework...", 10);
    const prompt = buildCurriculumPrompt(request);
    
    // Stage 2: Generating content
    onProgress?.("Generating standards-aligned instructional content...", 30);
    const response = await callCurriculumAPI(prompt);
    
    // Stage 3: Parsing response
    onProgress?.("Validating curriculum structure and assessments...", 70);
    const ebook = parseCurriculumResponse(response);
    
    // Stage 4: Post-processing
    onProgress?.("Finalizing differentiated materials...", 90);
    
    // Add generation metadata
    ebook.metadata.createdAt = new Date().toISOString();
    ebook.metadata.version = "1.0";
    
    onProgress?.("Curriculum ebook complete!", 100);
    console.log("✅ Curriculum generation complete:", ebook.metadata.title);
    
    return ebook;
  } catch (error) {
    console.error("❌ Curriculum generation failed:", error);
    throw error;
  }
}

/**
 * Generate additional assessments for an existing curriculum ebook
 */
export async function generateAdditionalAssessments(
  ebook: CurriculumEbook,
  questionCount: number = 5,
  bloomsLevels?: BloomsTaxonomyLevel[]
): Promise<AssessmentQuestion[]> {
  const alignedStandardsStr = (ebook.metadata.alignedStandards || [])
    .map(s => typeof s === 'string' ? s : s.code)
    .join(', ');
  
  const prompt = `Given this curriculum ebook about "${ebook.metadata.title}" for grade ${ebook.metadata.gradeLevel}:

Standards Covered: ${alignedStandardsStr}
Learning Objectives: ${ebook.metadata.learningObjectives.join('; ')}

Generate ${questionCount} additional assessment questions.
${bloomsLevels ? `Focus on these Bloom's levels: ${bloomsLevels.join(', ')}` : 'Include a variety of Bloom\'s levels.'}

Return ONLY a JSON array of assessment question objects following the schema from the system instructions.`;

  const response = await callCurriculumAPI(prompt, 4096);
  
  try {
    const questions = JSON.parse(response);
    return Array.isArray(questions) ? questions : questions.assessments || questions.questions || [];
  } catch {
    console.error("Failed to parse additional assessments");
    return [];
  }
}

/**
 * Generate family engagement materials for an existing curriculum ebook
 */
export async function generateFamilyMaterials(
  ebook: CurriculumEbook,
  languages: string[] = ['en', 'es']
): Promise<FamilyEngagement> {
  const ebookMeta = ebook.metadata as unknown as Record<string, unknown>;
  const vocabularyList = ebookMeta.vocabularyTerms
    ? (ebookMeta.vocabularyTerms as string[]).slice(0, 5).join(', ')
    : 'key vocabulary from the lessons';
  
  const prompt = `Given this curriculum ebook:
Title: ${ebook.metadata.title}
Subject: ${ebook.metadata.subject}
Grade: ${ebook.metadata.gradeLevel}
Key Concepts: ${ebook.metadata.learningObjectives.join('; ')}
Vocabulary: ${vocabularyList}

Generate comprehensive family engagement materials including:
1. Parent letter explaining what the child is learning
2. 3-5 home activities using common household materials
3. Discussion questions for family conversations
4. Community connections and resources
${languages.length > 1 ? `5. Translations for: ${languages.slice(1).join(', ')}` : ''}

Return ONLY a JSON object following the familyEngagement schema from the system instructions.`;

  const response = await callCurriculumAPI(prompt, 4096);
  
  try {
    return JSON.parse(response);
  } catch {
    console.error("Failed to parse family materials");
    throw new Error("Failed to generate family materials");
  }
}

/**
 * Adapt an existing curriculum ebook for a different grade level
 */
export async function adaptForGradeLevel(
  ebook: CurriculumEbook,
  targetGradeLevel: number
): Promise<CurriculumEbook> {
  const currentGrade = parseInt(String(ebook.metadata.gradeLevel), 10) || 3;
  const direction = targetGradeLevel > currentGrade ? 'up' : 'down';
  
  const alignedStandardsStr = (ebook.metadata.alignedStandards || [])
    .map(s => typeof s === 'string' ? s : s.code)
    .join(', ');
  
  const prompt = `Adapt the following curriculum ebook from grade ${currentGrade} to grade ${targetGradeLevel}:

Current Title: ${ebook.metadata.title}
Current Subject: ${ebook.metadata.subject}
Current Standards: ${alignedStandardsStr}

When adapting ${direction}:
${direction === 'up' ? `
- Increase text complexity and sentence length
- Add more abstract concepts
- Include deeper analysis questions
- Expand vocabulary to include more tier 3 terms
- Increase DOK levels in assessments
` : `
- Simplify language and use shorter sentences
- Make concepts more concrete
- Add more visual supports
- Focus on tier 1 and 2 vocabulary
- Include more repetition and scaffolding
`}

Find appropriate grade ${targetGradeLevel} standards that align with the same content area.

Generate a complete adapted curriculum ebook as JSON following the schema from system instructions.`;

  const response = await callCurriculumAPI(prompt, 16384);
  return parseCurriculumResponse(response);
}

/**
 * Standards database - Common Core ELA anchor standards
 */
export const CCSS_ELA_ANCHOR_STANDARDS = {
  reading: {
    keyIdeas: [
      { code: "CCRA.R.1", description: "Read closely to determine what the text says explicitly and to make logical inferences" },
      { code: "CCRA.R.2", description: "Determine central ideas or themes and analyze their development" },
      { code: "CCRA.R.3", description: "Analyze how and why individuals, events, or ideas develop and interact" }
    ],
    craftStructure: [
      { code: "CCRA.R.4", description: "Interpret words and phrases as they are used in a text" },
      { code: "CCRA.R.5", description: "Analyze the structure of texts" },
      { code: "CCRA.R.6", description: "Assess how point of view or purpose shapes content and style" }
    ],
    integration: [
      { code: "CCRA.R.7", description: "Integrate and evaluate content presented in diverse media and formats" },
      { code: "CCRA.R.8", description: "Delineate and evaluate the argument and specific claims in a text" },
      { code: "CCRA.R.9", description: "Analyze how two or more texts address similar themes or topics" }
    ],
    complexity: [
      { code: "CCRA.R.10", description: "Read and comprehend complex literary and informational texts independently" }
    ]
  },
  writing: {
    textTypes: [
      { code: "CCRA.W.1", description: "Write arguments to support claims in an analysis" },
      { code: "CCRA.W.2", description: "Write informative/explanatory texts" },
      { code: "CCRA.W.3", description: "Write narratives to develop real or imagined experiences" }
    ],
    production: [
      { code: "CCRA.W.4", description: "Produce clear and coherent writing appropriate to task, purpose, and audience" },
      { code: "CCRA.W.5", description: "Develop and strengthen writing through planning, revising, editing" },
      { code: "CCRA.W.6", description: "Use technology to produce and publish writing" }
    ],
    research: [
      { code: "CCRA.W.7", description: "Conduct short and sustained research projects" },
      { code: "CCRA.W.8", description: "Gather relevant information from multiple sources" },
      { code: "CCRA.W.9", description: "Draw evidence from literary or informational texts" }
    ]
  }
};

/**
 * Standards database - NGSS Performance Expectations (sample)
 */
export const NGSS_SAMPLE_STANDARDS = {
  elementary: {
    lifeScience: [
      { code: "K-LS1-1", description: "Use observations to describe patterns of what plants and animals need to survive" },
      { code: "1-LS1-1", description: "Use materials to design a solution to a human problem by mimicking organisms" },
      { code: "2-LS2-1", description: "Plan and conduct an investigation to determine if plants need sunlight and water" },
      { code: "3-LS1-1", description: "Develop models to describe organisms' life cycles" },
      { code: "4-LS1-1", description: "Construct an argument that plants and animals have internal and external structures" },
      { code: "5-LS2-1", description: "Develop a model to describe the movement of matter among organisms" }
    ],
    physicalScience: [
      { code: "K-PS2-1", description: "Plan and conduct an investigation to compare effects of different strengths of pushes and pulls" },
      { code: "1-PS4-1", description: "Plan and conduct investigations to provide evidence that vibrating materials make sound" },
      { code: "2-PS1-1", description: "Plan and conduct an investigation to describe and classify materials by observable properties" },
      { code: "3-PS2-1", description: "Plan and conduct an investigation to provide evidence of the effects of balanced and unbalanced forces" },
      { code: "4-PS3-1", description: "Use evidence to construct an explanation about energy transfer" },
      { code: "5-PS1-1", description: "Develop a model to describe matter is made of particles too small to be seen" }
    ],
    earthScience: [
      { code: "K-ESS2-1", description: "Use and share observations of local weather conditions" },
      { code: "1-ESS1-1", description: "Use observations of the sun, moon, and stars to describe patterns" },
      { code: "2-ESS1-1", description: "Use information to identify where water is found on Earth" },
      { code: "3-ESS2-1", description: "Represent data in tables to describe typical weather conditions" },
      { code: "4-ESS1-1", description: "Identify evidence from patterns in rock formations that Earth has changed over time" },
      { code: "5-ESS1-1", description: "Support an argument that gravitational force affects the motion of orbiting objects" }
    ]
  },
  middleSchool: {
    lifeScience: [
      { code: "MS-LS1-1", description: "Conduct an investigation to provide evidence that living things are made of cells" },
      { code: "MS-LS1-2", description: "Develop and use a model to describe the function of a cell" },
      { code: "MS-LS2-1", description: "Analyze and interpret data to provide evidence for the effects of resource availability" }
    ],
    physicalScience: [
      { code: "MS-PS1-1", description: "Develop models to describe the atomic composition of simple molecules" },
      { code: "MS-PS1-2", description: "Analyze and interpret data to identify the substances by characteristic properties" },
      { code: "MS-PS2-1", description: "Apply Newton's Third Law to design a solution to a problem involving motion" }
    ],
    earthScience: [
      { code: "MS-ESS1-1", description: "Develop and use a model of the Earth-sun-moon system" },
      { code: "MS-ESS2-1", description: "Develop a model to describe the cycling of Earth's materials" },
      { code: "MS-ESS3-1", description: "Construct a scientific explanation based on evidence for how geoscience processes have changed Earth's surface" }
    ]
  }
};

/**
 * SEL Competencies database
 */
export const CASEL_SEL_COMPETENCIES = {
  selfAwareness: {
    name: "Self-Awareness",
    description: "The ability to accurately recognize one's own emotions, thoughts, and values and how they influence behavior",
    indicators: [
      "Identifying emotions",
      "Accurate self-perception",
      "Recognizing strengths",
      "Self-confidence",
      "Self-efficacy"
    ]
  },
  selfManagement: {
    name: "Self-Management",
    description: "The ability to successfully regulate emotions, thoughts, and behaviors in different situations",
    indicators: [
      "Impulse control",
      "Stress management",
      "Self-discipline",
      "Self-motivation",
      "Goal-setting",
      "Organizational skills"
    ]
  },
  socialAwareness: {
    name: "Social Awareness",
    description: "The ability to take the perspective of and empathize with others",
    indicators: [
      "Perspective-taking",
      "Empathy",
      "Appreciating diversity",
      "Respect for others"
    ]
  },
  relationshipSkills: {
    name: "Relationship Skills",
    description: "The ability to establish and maintain healthy relationships",
    indicators: [
      "Communication",
      "Social engagement",
      "Relationship-building",
      "Teamwork"
    ]
  },
  responsibleDecisionMaking: {
    name: "Responsible Decision-Making",
    description: "The ability to make constructive choices about personal behavior and social interactions",
    indicators: [
      "Identifying problems",
      "Analyzing situations",
      "Solving problems",
      "Evaluating",
      "Reflecting",
      "Ethical responsibility"
    ]
  }
};

/**
 * Get standards for a specific grade and subject
 */
export function getStandardsForGrade(
  framework: StandardsFramework,
  gradeLevel: number,
  subject?: string
): CommonCoreStandard[] {
  // This is a simplified implementation
  // In production, this would query a full standards database
  
  if (framework === 'CCSS') {
    return Object.values(CCSS_ELA_ANCHOR_STANDARDS.reading)
      .flat()
      .map((s: { code: string; description: string }) => ({
        code: s.code,
        description: s.description,
        gradeLevel: String(gradeLevel),
        strand: 'Reading'
      }));
  }
  
  if (framework === 'NGSS') {
    const level = gradeLevel <= 5 ? 'elementary' : 'middleSchool';
    const standards = NGSS_SAMPLE_STANDARDS[level];
    
    if (subject === 'Life Science' || subject === 'Science') {
      return standards.lifeScience.map((s: { code: string; description: string }) => ({
        code: s.code,
        description: s.description,
        gradeLevel: String(gradeLevel),
        strand: 'Life Science'
      }));
    }
    
    const allStandards = [
      ...standards.lifeScience,
      ...standards.physicalScience,
      ...(standards.earthScience || [])
    ];
    
    return allStandards.map((s: { code: string; description: string }) => ({
      code: s.code,
      description: s.description,
      gradeLevel: String(gradeLevel),
      strand: 'Science'
    }));
  }
  
  return [];
}

/**
 * Get SEL competencies
 */
export function getSELCompetencies(): typeof CASEL_SEL_COMPETENCIES {
  return CASEL_SEL_COMPETENCIES;
}

/**
 * Default export for the curriculum service
 */
const curriculumService = {
  generateCurriculumEbook,
  generateAdditionalAssessments,
  generateFamilyMaterials,
  adaptForGradeLevel,
  getStandardsForGrade,
  getSELCompetencies,
  CCSS_ELA_ANCHOR_STANDARDS,
  NGSS_SAMPLE_STANDARDS,
  CASEL_SEL_COMPETENCIES
};

export default curriculumService;
