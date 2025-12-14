/**
 * Premium Prompts Module
 * 
 * Enterprise-grade prompt templates for professional visual learning content generation.
 * Each style has carefully engineered prompts that maximize Imagen 4.0 quality output.
 * 
 * @module premiumPrompts
 */

// ============================================================================
// STYLE-SPECIFIC PROMPT TEMPLATES
// ============================================================================

export interface StylePromptConfig {
  prefix: string;
  technicalSpecs: string;
  lighting: string;
  quality: string;
  colorApproach: string;
  avoidances: string;
}

/**
 * Professional prompt templates for each art style
 * These are scientifically engineered to produce consistent, high-quality results
 */
export const STYLE_PROMPT_TEMPLATES: Record<string, StylePromptConfig> = {
  // ===================== ILLUSTRATION STYLES =====================
  
  'Watercolor': {
    prefix: 'Traditional watercolor painting technique with authentic paint behavior',
    technicalSpecs: `
      - Soft color bleeds and wet-on-wet effects
      - Visible cold-pressed paper texture (300gsm Arches quality)
      - Transparent layered washes with white of paper showing through
      - Organic edge quality with subtle granulation
      - Pigment pooling in recessed areas
      - Dry brush textures for details`,
    lighting: 'Soft diffused natural lighting with gentle atmospheric perspective, subtle shadows with color temperature shifts',
    quality: 'Masterful watercolor illustration, award-winning gallery quality, Daniel Smith pigment richness',
    colorApproach: 'Harmonious analogous palette with strategic complementary accents, 60-30-10 color distribution',
    avoidances: 'No harsh digital edges, no flat fills, no oversaturated neon colors, no hard outlines'
  },

  'Pixar 3D': {
    prefix: 'Pixar-quality 3D CGI render with cinematic production values',
    technicalSpecs: `
      - Subsurface scattering on skin and organic materials
      - Volumetric lighting with god rays where appropriate
      - Physically accurate materials with subtle imperfections
      - Microfiber detail on fabrics
      - Ambient occlusion in crevices
      - Motion blur for dynamic scenes
      - Depth of field with bokeh`,
    lighting: 'Three-point studio lighting (key, fill, rim), warm key light, cool fill, strong rim separation, soft ambient occlusion',
    quality: 'Feature-film quality, 4K render, Academy Award-winning animation studio output, RenderMan quality',
    colorApproach: 'Pixar color science - saturated but naturalistic, strong silhouette readability, emotional color storytelling',
    avoidances: 'No uncanny valley, no plastic-looking skin, no harsh CG artifacts, no flat lighting'
  },

  'Anime': {
    prefix: 'High-quality anime illustration in modern studio style',
    technicalSpecs: `
      - Clean line art with variable line weight (thick outlines, thin details)
      - Cell-shaded coloring with 2-3 value steps
      - Characteristic anime eye styling with reflections
      - Dynamic hair with individual strand groups
      - Speed lines for motion
      - Sparkle and glow effects for emphasis
      - Gradient backgrounds with soft bokeh`,
    lighting: 'Dramatic anime lighting with strong key shadows, rim lighting for drama, soft gradient ambient',
    quality: 'Studio Ghibli meets Makoto Shinkai, theatrical release quality, Kyoto Animation polish',
    colorApproach: 'Vibrant anime palette with sunset gradients, complementary color pops, nostalgic warm undertones',
    avoidances: 'No Western cartoon proportions, no rough sketchy lines, no muddy colors'
  },

  'Cartoon': {
    prefix: 'Professional animation-ready cartoon illustration',
    technicalSpecs: `
      - Bold confident outlines with consistent weight
      - Flat color fills with simple gradients
      - Exaggerated expressions and proportions
      - Clear silhouette design
      - Limited palette per character (3-5 colors)
      - Geometric shape language (circles = friendly, triangles = dynamic)`,
    lighting: 'Simple two-tone shading (light/shadow), cel-shaded approach, minimal gradients',
    quality: 'Broadcast animation quality, Cartoon Network/Disney Junior polish, character guide ready',
    colorApproach: 'Bold primary and secondary colors, high saturation for key elements, clear color coding',
    avoidances: 'No muddy blending, no realistic proportions, no overly complex shading'
  },

  'Realistic': {
    prefix: 'Photorealistic digital illustration with painterly refinement',
    technicalSpecs: `
      - Accurate anatomy and proportions
      - Detailed skin texture with pores and subtle imperfections
      - Realistic fabric folds and material properties
      - Environmental integration with proper scale
      - Atmospheric perspective for depth
      - Accurate shadow terminator and bounce light`,
    lighting: 'Natural lighting matching time of day, HDR dynamic range, accurate color temperature',
    quality: 'Craig Mullins meets Karla Ortiz, ArtStation trending, concept art master quality',
    colorApproach: 'Naturalistic color grading, limited palette with environmental influence, realistic color harmony',
    avoidances: 'No anime proportions, no flat colors, no inconsistent lighting direction'
  },

  'Digital Art': {
    prefix: 'Contemporary digital illustration with refined painterly technique',
    technicalSpecs: `
      - Blended brushwork with visible strokes for texture
      - Rich color layering and glazes
      - Strong focal point with selective detail
      - Atmospheric depth through color and value
      - Dynamic composition with clear flow
      - Subtle texture overlays`,
    lighting: 'Cinematic lighting with strong mood, dramatic key-to-fill ratio, volumetric atmosphere',
    quality: 'ArtStation HQ featured quality, professional game art production values, AAA concept art',
    colorApproach: 'Sophisticated color harmony, mood-driven palette, strategic color temperature contrast',
    avoidances: 'No overblending, no lifeless flat areas, no inconsistent rendering'
  },

  'Sketch': {
    prefix: 'Professional architectural/illustration sketch with artistic confidence',
    technicalSpecs: `
      - Confident gestural line work
      - Cross-hatching for value and texture
      - Selective color accents (watercolor washes or marker)
      - Dynamic perspective with hand-drawn charm
      - Varied line weight for depth
      - Strategic white space`,
    lighting: 'Suggested through line density and hatching direction, atmospheric sketched shadows',
    quality: 'Professional concept artist sketchbook, architectural rendering quality, publication ready',
    colorApproach: 'Limited accent palette (1-3 colors), graphite grays with warm or cool bias',
    avoidances: 'No messy or chaotic linework, no fully rendered areas that break sketch aesthetic'
  },

  'Storybook': {
    prefix: 'Classic children\'s book illustration with timeless charm',
    technicalSpecs: `
      - Soft textured brushwork reminiscent of traditional media
      - Warm inviting color palette
      - Gentle character expressions
      - Detailed environmental storytelling
      - Pattern and texture integration
      - Decorative borders optional`,
    lighting: 'Soft golden hour lighting, gentle shadows, warm ambient glow',
    quality: 'Caldecott Medal worthy, classic children\'s literature illustration, Maurice Sendak meets Oliver Jeffers',
    colorApproach: 'Warm nostalgic palette, muted pastels with rich accents, age-appropriate vibrancy',
    avoidances: 'No harsh contrasts, no scary or intense imagery, no overly complex compositions'
  },

  // ===================== EDUCATIONAL STYLES =====================

  'Diagram': {
    prefix: 'Professional technical diagram with clear educational communication',
    technicalSpecs: `
      - Clean vector-quality lines
      - Clear labeling with leader lines
      - Consistent visual language throughout
      - Cutaway views for internal structure
      - Numbered sequences for processes
      - Scale indicators where relevant
      - Color-coded systems`,
    lighting: 'Flat studio lighting for clarity, no dramatic shadows, even illumination',
    quality: 'Scientific American illustration quality, textbook-ready, Dorling Kindersley visual reference',
    colorApproach: 'Functional color coding (blue=input, red=output, green=process), high contrast for readability',
    avoidances: 'No decorative elements that distract, no unclear connections, no ambiguous labels'
  },

  'Infographic': {
    prefix: 'Modern data visualization infographic with engaging visual hierarchy',
    technicalSpecs: `
      - Clear information hierarchy
      - Data-accurate chart representations
      - Icon system with consistent style
      - Whitespace for breathing room
      - Flow indicators (arrows, lines)
      - Modular grid layout`,
    lighting: 'Flat design aesthetic, no 3D shadows unless purposeful, clean and modern',
    quality: 'National Geographic quality, Information is Beautiful award-worthy, publication-ready',
    colorApproach: 'Limited palette (4-5 colors max), data-driven color decisions, accessible contrast ratios',
    avoidances: 'No chartjunk, no misleading scales, no decorations that obscure data'
  },

  'Blueprint': {
    prefix: 'Technical blueprint with precise engineering detail',
    technicalSpecs: `
      - Orthographic projection views
      - Dimension lines with measurements
      - Section views and details
      - Standard technical drawing conventions
      - Parts lists/legends
      - Scale notation`,
    lighting: 'Pure line work, no lighting effects, technical drawing standard',
    quality: 'Engineering documentation quality, ISO standard compliance, patent illustration ready',
    colorApproach: 'Classic blueprint blue on white, or black on white with colored annotations',
    avoidances: 'No freehand elements, no inconsistent line weights without meaning'
  },

  'Comic': {
    prefix: 'Professional comic book sequential art',
    technicalSpecs: `
      - Dynamic panel compositions
      - Bold inking with confident lines
      - Clear action flow between panels
      - Expressive character acting
      - Sound effects integrated into design
      - Speech bubbles with clear hierarchy`,
    lighting: 'High contrast dramatic lighting, strong blacks, dynamic shadows',
    quality: 'Marvel/DC publication quality, professional inker finish, colorist-ready',
    colorApproach: 'Bold comic coloring, strategic use of flats and gradients, mood-driven palette',
    avoidances: 'No confusing panel flow, no weak linework, no muddy color choices'
  },

  // ===================== BRAND/CORPORATE STYLES =====================

  'Corporate Minimalist': {
    prefix: 'Clean corporate design with premium minimalist aesthetic',
    technicalSpecs: `
      - Abundant negative space
      - Geometric shapes and clean lines
      - Sans-serif typography integration
      - Subtle gradients for depth
      - Consistent spacing system
      - Premium material textures (glass, metal)`,
    lighting: 'Soft studio lighting, subtle shadows for depth, high-key overall',
    quality: 'Apple/Google design quality, Fortune 500 brand standards, award-winning corporate design',
    colorApproach: 'Sophisticated limited palette, neutral base with single accent color, premium feel',
    avoidances: 'No clutter, no gradients for gradients sake, no dated design elements'
  },

  'Cyberpunk': {
    prefix: 'Cyberpunk aesthetic with neon-noir atmosphere',
    technicalSpecs: `
      - Neon lighting and glow effects
      - Rain and wet surfaces with reflections
      - Holographic UI elements
      - Dense urban environments
      - High-tech low-life contrast
      - Glitch and scan line effects`,
    lighting: 'Dramatic neon lighting with complementary color temperature contrast (pink/cyan), volumetric fog',
    quality: 'Blade Runner 2049 meets Ghost in the Shell, AAA game cinematic quality',
    colorApproach: 'Neon accents (cyan, magenta, yellow) against dark desaturated backgrounds',
    avoidances: 'No washed out colors, no flat lighting, no generic sci-fi'
  },

  'Vintage': {
    prefix: 'Nostalgic vintage illustration with period-authentic styling',
    technicalSpecs: `
      - Limited color palette (4-color process look)
      - Halftone dot patterns for shading
      - Period-appropriate typography
      - Aged paper texture overlay
      - Classic illustration techniques
      - Art Deco or Mid-century modern influence`,
    lighting: 'Soft vintage lighting, golden warm tones, gentle vignetting',
    quality: 'Norman Rockwell meets Alphonse Mucha, vintage poster art quality, collectible print worthy',
    colorApproach: 'Muted period-accurate palette, sepia undertones, limited bright accents',
    avoidances: 'No modern design elements, no digital-looking effects, no anachronistic details'
  },

  'Paper Cutout': {
    prefix: 'Layered paper cut illustration with tactile dimensional quality',
    technicalSpecs: `
      - Distinct paper layers with drop shadows
      - Cut edge visibility
      - Paper texture on each layer
      - Depth through layer stacking (3-7 layers)
      - Occasional fold or curl details
      - Mixed paper types (craft, colored, patterned)`,
    lighting: 'Soft overhead lighting casting subtle shadows between layers, ambient room light',
    quality: 'Stop-motion animation production quality, gallery-worthy paper art, Laika Studios aesthetic',
    colorApproach: 'Craft paper naturals with bright construction paper accents, textured color appearance',
    avoidances: 'No flat digital look, no impossible paper physics, no sharp digital gradients'
  },

  'Flat Design': {
    prefix: 'Modern flat design illustration with geometric precision',
    technicalSpecs: `
      - No gradients or shadows (pure flat)
      - Geometric shape construction
      - Bold solid colors
      - Consistent stroke widths
      - Simple iconic forms
      - Modular component system`,
    lighting: 'No lighting effects - pure flat design, equal value across surfaces',
    quality: 'Google Material Design quality, tech industry standard, scalable vector aesthetic',
    colorApproach: 'Bold Material palette, complementary color pops, accessible color contrast',
    avoidances: 'No subtle gradients, no realistic textures, no complex shading'
  }
};

// ============================================================================
// RESOLUTION & QUALITY CONFIGURATIONS
// ============================================================================

export interface QualityConfig {
  model: string;
  resolution: { width: number; height: number };
  qualityModifiers: string[];
  samplingSteps?: number;
  guidanceScale?: number;
}

export const TIER_QUALITY_CONFIG: Record<string, QualityConfig> = {
  'SPARK': {
    model: 'google/imagen-4.0-generate-001',
    resolution: { width: 1024, height: 1024 },
    qualityModifiers: ['high quality', 'detailed'],
  },
  'CREATOR': {
    model: 'google/imagen-4.0-generate-001',
    resolution: { width: 1536, height: 1536 },
    qualityModifiers: ['high quality', 'professional', 'detailed', 'sharp focus'],
  },
  'STUDIO': {
    model: 'google/imagen-4.0-ultra-generate-001',
    resolution: { width: 2048, height: 2048 },
    qualityModifiers: ['ultra high quality', 'professional', 'masterwork', 'extremely detailed', '8K resolution'],
  },
  'EMPIRE': {
    model: 'google/imagen-4.0-ultra-generate-001',
    resolution: { width: 2048, height: 2048 },
    qualityModifiers: ['ultra high quality', 'professional masterwork', 'award-winning', 'museum quality', '8K HDR', 'perfect composition'],
  }
};

// ============================================================================
// ASPECT RATIO CONFIGURATIONS
// ============================================================================

export const ASPECT_RATIOS = {
  'square': { width: 1, height: 1, description: 'Square format - social media, profile images' },
  'landscape': { width: 16, height: 9, description: 'Widescreen - presentations, headers' },
  'portrait': { width: 9, height: 16, description: 'Vertical - mobile, stories, book pages' },
  'book': { width: 3, height: 4, description: 'Book page - traditional ebook format' },
  'wide': { width: 21, height: 9, description: 'Ultrawide - cinematic, banners' },
  'classic': { width: 4, height: 3, description: 'Classic photo - traditional photography' }
};

// ============================================================================
// AGE-APPROPRIATE CONTENT MODIFIERS
// ============================================================================

export const AGE_CONTENT_MODIFIERS: Record<string, { style: string; complexity: string; mood: string }> = {
  '3-5': {
    style: 'Simple shapes, bright colors, friendly expressions, rounded forms, no sharp edges',
    complexity: 'Minimal detail, clear focal point, uncluttered composition, large simple shapes',
    mood: 'Warm, safe, joyful, playful, non-threatening, gentle'
  },
  '6-8': {
    style: 'Colorful and engaging, slightly more detail, expressive characters, dynamic but not intense',
    complexity: 'Moderate detail, clear storytelling, organized composition with visual interest',
    mood: 'Adventurous, fun, exciting but safe, encouraging, wonder-filled'
  },
  '9-12': {
    style: 'More sophisticated illustration, detailed characters and environments, stylistic variety',
    complexity: 'Rich detail, complex compositions allowed, layered visual storytelling',
    mood: 'Engaging, challenging, mysterious, inspiring, emotionally resonant'
  },
  '13+': {
    style: 'Mature illustration quality, nuanced expressions, sophisticated visual language',
    complexity: 'Full artistic complexity, subtle details, professional composition',
    mood: 'Full emotional range, thought-provoking, visually striking, thematically deep'
  }
};

// ============================================================================
// CHARACTER CONSISTENCY PROMPT BUILDER
// ============================================================================

export interface CharacterReference {
  name: string;
  visualDescription: string;
  styleEnforcement: string[];
  colorPalette: string[];
  distinctiveFeatures: string[];
}

/**
 * Builds a character consistency prompt that can be appended to any image generation
 * to ensure the character looks consistent across all generated images
 */
export function buildCharacterConsistencyPrompt(character: CharacterReference): string {
  return `
CHARACTER CONSISTENCY REQUIREMENTS for "${character.name}":
- Visual Identity: ${character.visualDescription}
- Distinctive Features (MUST INCLUDE): ${character.distinctiveFeatures.join(', ')}
- Color Palette (CHARACTER COLORS): ${character.colorPalette.join(', ')}
- Style Enforcement: ${character.styleEnforcement.join(', ')}

CRITICAL: This character MUST be recognizable as the same person across all images.
Maintain exact proportions, colors, and distinctive features.
`;
}

// ============================================================================
// PREMIUM IMAGE PROMPT BUILDER
// ============================================================================

/**
 * Builds an enterprise-grade image generation prompt
 */
export function buildPremiumImagePrompt(params: {
  basePrompt: string;
  style: string;
  tier: string;
  ageGroup?: string;
  aspectRatio?: keyof typeof ASPECT_RATIOS;
  characterRef?: CharacterReference;
  sceneContext?: {
    timeOfDay?: 'dawn' | 'morning' | 'afternoon' | 'sunset' | 'night';
    weather?: 'clear' | 'cloudy' | 'rainy' | 'snowy' | 'stormy';
    mood?: 'peaceful' | 'exciting' | 'mysterious' | 'joyful' | 'dramatic';
  };
}): string {
  const styleConfig = STYLE_PROMPT_TEMPLATES[params.style] || STYLE_PROMPT_TEMPLATES['Digital Art'];
  const qualityConfig = TIER_QUALITY_CONFIG[params.tier] || TIER_QUALITY_CONFIG['SPARK'];
  const ageConfig = params.ageGroup ? AGE_CONTENT_MODIFIERS[params.ageGroup] : null;

  const parts: string[] = [];

  // 1. Style Definition
  parts.push(`STYLE: ${styleConfig.prefix}`);

  // 2. Main Subject/Scene
  parts.push(`\nSCENE: ${params.basePrompt}`);

  // 3. Character Consistency (if applicable)
  if (params.characterRef) {
    parts.push(buildCharacterConsistencyPrompt(params.characterRef));
  }

  // 4. Scene Context
  if (params.sceneContext) {
    const contextParts: string[] = [];
    if (params.sceneContext.timeOfDay) contextParts.push(`Time: ${params.sceneContext.timeOfDay}`);
    if (params.sceneContext.weather) contextParts.push(`Weather: ${params.sceneContext.weather}`);
    if (params.sceneContext.mood) contextParts.push(`Mood: ${params.sceneContext.mood}`);
    if (contextParts.length > 0) {
      parts.push(`\nCONTEXT: ${contextParts.join(', ')}`);
    }
  }

  // 5. Technical Specifications
  parts.push(`\nTECHNICAL SPECIFICATIONS:${styleConfig.technicalSpecs}`);

  // 6. Lighting
  parts.push(`\nLIGHTING: ${styleConfig.lighting}`);

  // 7. Color Approach
  parts.push(`\nCOLOR: ${styleConfig.colorApproach}`);

  // 8. Age-Appropriate Adjustments
  if (ageConfig) {
    parts.push(`\nAGE-APPROPRIATE STYLE: ${ageConfig.style}`);
    parts.push(`COMPLEXITY: ${ageConfig.complexity}`);
    parts.push(`MOOD: ${ageConfig.mood}`);
  }

  // 9. Quality Modifiers
  parts.push(`\nQUALITY: ${qualityConfig.qualityModifiers.join(', ')}`);

  // 10. Reference Quality Bar
  parts.push(`\nQUALITY BAR: ${styleConfig.quality}`);

  // 11. Avoidances (Negative Prompting)
  parts.push(`\nAVOID: ${styleConfig.avoidances}`);

  return parts.join('\n');
}

// ============================================================================
// BOOK PAGE IMAGE PROMPT TEMPLATE
// ============================================================================

export const PREMIUM_BOOK_IMAGE_TEMPLATE = `
Generate a premium children's book illustration with the following specifications:

SCENE DESCRIPTION:
{SCENE_DESCRIPTION}

CHARACTER DETAILS:
{CHARACTER_DETAILS}

STYLE SPECIFICATIONS:
{STYLE_SPECS}

COMPOSITION REQUIREMENTS:
- Leave space for text placement: {TEXT_PLACEMENT_AREA}
- Focal point positioned using rule of thirds
- Clear foreground, midground, background separation
- Breathing room around edges (safe margin)

LIGHTING:
{LIGHTING_SPECS}

MOOD & ATMOSPHERE:
{MOOD}

COLOR PALETTE:
{COLOR_PALETTE}

TECHNICAL QUALITY:
- Ultra-high resolution
- Print-ready quality (300 DPI equivalent)
- Professional illustration standard
- Consistent with previous pages in the book

CRITICAL REQUIREMENTS:
{CRITICAL_REQUIREMENTS}

AVOID:
- Text or words in the image (text is added separately)
- Cropped characters at edges
- Busy backgrounds that compete with characters
- Inconsistent character appearance from previous pages
- Inappropriate content for target age group
`;

// ============================================================================
// INFOGRAPHIC PREMIUM TEMPLATE
// ============================================================================

export const PREMIUM_INFOGRAPHIC_TEMPLATE = `
Generate a premium educational infographic with these specifications:

CONTENT STRUCTURE:
{CONTENT_STRUCTURE}

VISUAL HIERARCHY:
1. Title: Largest, most prominent, immediate attention
2. Main Sections: Clear visual separation, logical flow
3. Supporting Details: Smaller but readable
4. Annotations: Helpful but not distracting

LAYOUT SPECIFICATIONS:
- Dimensions: {WIDTH}px × {HEIGHT}px
- Orientation: {ORIENTATION}
- Grid System: 12-column responsive grid
- Margins: 5% safe area on all edges
- Section Spacing: Clear visual breaks between concepts

TYPOGRAPHY (EMBEDDED IN IMAGE):
- Title: {TITLE} in bold, commanding font (48-64pt equivalent)
- Headings: Clear hierarchy, scannable
- Body Text: Highly readable, appropriate size for target age
- Labels: Concise, positioned near related visuals

ILLUSTRATION STYLE:
{STYLE_SPECIFICATIONS}

DATA VISUALIZATION:
- Charts/graphs must be accurate and clear
- Icons consistent in style throughout
- Color coding meaningful and explained
- Flow indicators (arrows, lines) guide the eye

AGE-APPROPRIATE DESIGN:
{AGE_SPECIFICATIONS}

CHARACTER INTEGRATION (if applicable):
- Guide character appears {CHARACTER_FREQUENCY} times
- Speech bubbles with educational content
- Character expressions support the learning moment

ACCESSIBILITY:
- Color-blind friendly palette
- High contrast ratios (4.5:1 minimum)
- Clear visual hierarchy
- Works in grayscale for printing

QUALITY STANDARDS:
- National Geographic Kids quality level
- Smithsonian educational materials standard
- Publication-ready, print-ready quality
- Zero visual errors or artifacts

AVOID:
- Chartjunk (unnecessary decorations)
- Misleading data representations
- Crowded layouts
- Inconsistent visual language
- Text too small to read
`;

export default {
  STYLE_PROMPT_TEMPLATES,
  TIER_QUALITY_CONFIG,
  ASPECT_RATIOS,
  AGE_CONTENT_MODIFIERS,
  buildPremiumImagePrompt,
  buildCharacterConsistencyPrompt,
  PREMIUM_BOOK_IMAGE_TEMPLATE,
  PREMIUM_INFOGRAPHIC_TEMPLATE
};
