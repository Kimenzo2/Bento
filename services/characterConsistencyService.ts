/**
 * Character Consistency Service
 * 
 * This service ensures characters look consistent across all generated images
 * by maintaining detailed visual references and enforcing style consistency.
 * 
 * @module characterConsistencyService
 */

import { Character } from '../types';
import { CharacterReference, STYLE_PROMPT_TEMPLATES } from './generator/prompts/premiumPrompts';

// ============================================================================
// CHARACTER REFERENCE MANAGEMENT
// ============================================================================

export interface CharacterVisualProfile {
  id: string;
  name: string;
  
  // Core Visual Identity
  physicalDescription: {
    age: string;
    height: string;
    build: string;
    skinTone: string;
    hairColor: string;
    hairStyle: string;
    hairLength: string;
    eyeColor: string;
    eyeShape: string;
    faceShape: string;
  };
  
  // Distinctive Features (for recognition)
  distinctiveFeatures: string[];
  
  // Clothing & Accessories
  clothing: {
    style: string;
    primaryColors: string[];
    signature: string; // e.g., "always wears red scarf"
  };
  accessories: string[];
  
  // Style Enforcement
  colorPalette: string[]; // Hex codes
  styleKeywords: string[]; // Keywords to include in every prompt
  
  // Generated Reference Images
  referenceImages?: {
    neutral?: string;
    happy?: string;
    sad?: string;
    excited?: string;
    thinking?: string;
  };
  
  // Metadata
  createdAt: number;
  updatedAt: number;
}

// In-memory store for character references (per session)
const characterProfileCache = new Map<string, CharacterVisualProfile>();

/**
 * Extracts a detailed visual profile from a Character object
 */
export function extractVisualProfile(character: Character): CharacterVisualProfile {
  // Try to parse existing visual descriptions
  const visualPrompt = character.visualPrompt || character.visualTraits || '';
  const appearance = character.appearance || '';
  
  // Extract age
  const ageMatch = visualPrompt.match(/(\d+)[\s-]*(year|yo|years old)/i) || 
                   appearance.match(/(\d+)[\s-]*(year|yo|years old)/i);
  const age = ageMatch ? ageMatch[1] + ' years old' : 'young';
  
  // Extract hair info
  const hairColorMatch = visualPrompt.match(/(blonde|brunette|black|brown|red|auburn|silver|gray|white|ginger|pink|blue|purple|green)\s*(hair)?/i);
  const hairStyleMatch = visualPrompt.match(/(curly|straight|wavy|braided|ponytail|pigtails|short|long|medium|spiky|afro|bun|bob)/i);
  
  // Extract eye info
  const eyeColorMatch = visualPrompt.match(/(blue|brown|green|hazel|gray|amber|violet|golden)\s*(eyes)?/i);
  
  // Extract skin tone
  const skinMatch = visualPrompt.match(/(fair|pale|light|medium|olive|tan|brown|dark|ebony)\s*(skin)?/i);
  
  // Extract build
  const buildMatch = visualPrompt.match(/(thin|slim|slender|athletic|muscular|stocky|chubby|tall|short|petite|lanky)/i);
  
  // Extract distinctive features
  const features: string[] = [];
  if (visualPrompt.includes('freckles')) features.push('freckles on face');
  if (visualPrompt.includes('glasses')) features.push('wearing glasses');
  if (visualPrompt.includes('scar')) features.push('distinctive scar');
  if (visualPrompt.includes('dimples')) features.push('dimples when smiling');
  if (visualPrompt.includes('birthmark')) features.push('visible birthmark');
  
  // Extract clothing
  const clothingMatch = visualPrompt.match(/(wearing|dressed in|clothes|outfit)[:\s]+([\w\s,]+)/i);
  
  // Generate color palette from description or defaults
  // Use type assertion since colorPalette is optional/extended property
  const colorPalette = (character as any).colorPalette || generateColorPaletteFromDescription(visualPrompt);
  
  const profile: CharacterVisualProfile = {
    id: character.id || crypto.randomUUID(),
    name: character.name,
    
    physicalDescription: {
      age: age,
      height: buildMatch?.[0]?.includes('tall') ? 'tall' : buildMatch?.[0]?.includes('short') ? 'short' : 'average height',
      build: buildMatch?.[0] || 'average',
      skinTone: skinMatch?.[1] || 'medium',
      hairColor: hairColorMatch?.[1] || 'brown',
      hairStyle: hairStyleMatch?.[1] || 'natural',
      hairLength: visualPrompt.includes('long hair') ? 'long' : visualPrompt.includes('short hair') ? 'short' : 'medium',
      eyeColor: eyeColorMatch?.[1] || 'brown',
      eyeShape: 'expressive',
      faceShape: visualPrompt.includes('round face') ? 'round' : visualPrompt.includes('oval') ? 'oval' : 'balanced'
    },
    
    distinctiveFeatures: features.length > 0 ? features : ['friendly expression', 'expressive eyes'],
    
    clothing: {
      style: clothingMatch?.[2] || 'casual and comfortable',
      primaryColors: colorPalette.slice(0, 2),
      signature: extractSignatureItem(visualPrompt) || 'characteristic outfit'
    },
    accessories: extractAccessories(visualPrompt),
    
    colorPalette: colorPalette,
    styleKeywords: generateStyleKeywords(character),
    
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  // Cache the profile
  characterProfileCache.set(profile.id, profile);
  
  return profile;
}

/**
 * Generates a color palette from a character description
 */
function generateColorPaletteFromDescription(description: string): string[] {
  const defaultPalettes: Record<string, string[]> = {
    warm: ['#FF6B6B', '#FFE66D', '#F8B500', '#FF8C42', '#FFF0E5'],
    cool: ['#4ECDC4', '#6CB2EB', '#9561E2', '#38B2AC', '#E0F7FA'],
    earthy: ['#8B4513', '#DEB887', '#228B22', '#D2691E', '#FAF0E6'],
    neutral: ['#5A5A5A', '#8B8B8B', '#BFBFBF', '#E8E8E8', '#FFFFFF']
  };
  
  // Try to detect palette type from description
  const desc = description.toLowerCase();
  if (desc.includes('warm') || desc.includes('red') || desc.includes('orange') || desc.includes('yellow')) {
    return defaultPalettes.warm;
  }
  if (desc.includes('cool') || desc.includes('blue') || desc.includes('green') || desc.includes('purple')) {
    return defaultPalettes.cool;
  }
  if (desc.includes('earth') || desc.includes('brown') || desc.includes('natural')) {
    return defaultPalettes.earthy;
  }
  
  return defaultPalettes.neutral;
}

/**
 * Extracts a signature clothing item or accessory
 */
function extractSignatureItem(description: string): string | null {
  const signatures = [
    'red scarf', 'blue cap', 'yellow backpack', 'green hoodie',
    'rainbow socks', 'lucky charm necklace', 'favorite sweater',
    'distinctive hat', 'colorful sneakers', 'special bracelet'
  ];
  
  const desc = description.toLowerCase();
  for (const sig of signatures) {
    if (desc.includes(sig.toLowerCase())) return sig;
  }
  
  return null;
}

/**
 * Extracts accessories from description
 */
function extractAccessories(description: string): string[] {
  const accessoryKeywords = [
    'glasses', 'hat', 'cap', 'backpack', 'bag', 'necklace', 'bracelet',
    'watch', 'earrings', 'bow', 'ribbon', 'scarf', 'bandana', 'headband'
  ];
  
  const desc = description.toLowerCase();
  return accessoryKeywords.filter(a => desc.includes(a));
}

/**
 * Generates style enforcement keywords for consistent rendering
 */
function generateStyleKeywords(character: Character): string[] {
  const keywords: string[] = [];
  
  // Add personality-based rendering hints
  const traits = character.traits || character.personalityTraits || [];
  
  if (traits.includes('cheerful') || traits.includes('happy')) {
    keywords.push('warm expression', 'slight smile', 'bright eyes');
  }
  if (traits.includes('brave') || traits.includes('confident')) {
    keywords.push('confident posture', 'determined gaze', 'strong stance');
  }
  if (traits.includes('curious') || traits.includes('intelligent')) {
    keywords.push('inquisitive expression', 'alert eyes', 'engaged posture');
  }
  if (traits.includes('shy') || traits.includes('quiet')) {
    keywords.push('gentle expression', 'soft gaze', 'relaxed posture');
  }
  
  // Add role-based hints
  if (character.role === 'protagonist') {
    keywords.push('heroic framing', 'prominent positioning', 'dynamic pose');
  }
  if (character.role === 'mentor') {
    keywords.push('wise appearance', 'calm demeanor', 'approachable stance');
  }
  
  return keywords.length > 0 ? keywords : ['expressive', 'consistent', 'recognizable'];
}

// ============================================================================
// PROMPT BUILDING FOR CONSISTENT CHARACTERS
// ============================================================================

/**
 * Builds a CharacterReference object for use with premium prompts
 */
export function buildCharacterReference(profile: CharacterVisualProfile): CharacterReference {
  const physDesc = profile.physicalDescription;
  
  const visualDescription = `
${profile.name}: A ${physDesc.age} character with ${physDesc.build} build and ${physDesc.height}. 
${physDesc.skinTone} skin, ${physDesc.hairColor} ${physDesc.hairLength} ${physDesc.hairStyle} hair. 
${physDesc.eyeColor} ${physDesc.eyeShape} eyes, ${physDesc.faceShape} face shape.
Wearing ${profile.clothing.style} in ${profile.clothing.primaryColors.join(' and ')} tones.
${profile.clothing.signature ? `Signature item: ${profile.clothing.signature}.` : ''}
${profile.accessories.length > 0 ? `Accessories: ${profile.accessories.join(', ')}.` : ''}
`.trim();

  return {
    name: profile.name,
    visualDescription: visualDescription,
    styleEnforcement: profile.styleKeywords,
    colorPalette: profile.colorPalette,
    distinctiveFeatures: profile.distinctiveFeatures
  };
}

/**
 * Builds an image prompt with character consistency for a specific scene
 */
export function buildScenePromptWithCharacter(
  sceneDescription: string,
  characterProfile: CharacterVisualProfile,
  options: {
    emotion?: 'neutral' | 'happy' | 'sad' | 'excited' | 'scared' | 'curious' | 'thoughtful';
    action?: string;
    artStyle?: string;
    timeOfDay?: string;
    setting?: string;
  } = {}
): string {
  const physDesc = characterProfile.physicalDescription;
  
  // Build character appearance block
  const characterBlock = `
CHARACTER - ${characterProfile.name}:
- Physical: ${physDesc.age}, ${physDesc.build} build, ${physDesc.height}
- Skin: ${physDesc.skinTone}
- Hair: ${physDesc.hairColor} ${physDesc.hairLength} ${physDesc.hairStyle} hair
- Eyes: ${physDesc.eyeColor} ${physDesc.eyeShape} eyes
- Face: ${physDesc.faceShape} face shape
- Distinctive features: ${characterProfile.distinctiveFeatures.join(', ')}
- Outfit: ${characterProfile.clothing.style}, ${characterProfile.clothing.signature || 'typical clothing'}
- Colors: Character colors are ${characterProfile.colorPalette.slice(0, 3).join(', ')}
${options.emotion ? `- Expression: ${options.emotion} expression` : ''}
${options.action ? `- Action: ${options.action}` : ''}
`;

  // Build full scene prompt
  const prompt = `
SCENE: ${sceneDescription}

${characterBlock}

${options.setting ? `SETTING: ${options.setting}` : ''}
${options.timeOfDay ? `TIME: ${options.timeOfDay}` : ''}

CRITICAL - CHARACTER CONSISTENCY:
This character MUST be recognizable as ${characterProfile.name}.
Maintain EXACT: hair color (${physDesc.hairColor}), eye color (${physDesc.eyeColor}), skin tone (${physDesc.skinTone}).
Include distinctive features: ${characterProfile.distinctiveFeatures.join(', ')}.
Use character's color palette: ${characterProfile.colorPalette.slice(0, 3).join(', ')}.

${characterProfile.styleKeywords.length > 0 ? `STYLE KEYWORDS: ${characterProfile.styleKeywords.join(', ')}` : ''}
`.trim();

  return prompt;
}

// ============================================================================
// MULTI-CHARACTER SCENES
// ============================================================================

/**
 * Builds a prompt for scenes with multiple characters
 */
export function buildMultiCharacterScenePrompt(
  sceneDescription: string,
  characters: Array<{
    profile: CharacterVisualProfile;
    emotion?: string;
    action?: string;
    position?: 'left' | 'center' | 'right' | 'foreground' | 'background';
  }>,
  options: {
    artStyle?: string;
    setting?: string;
    mood?: string;
  } = {}
): string {
  const characterBlocks = characters.map((char, index) => {
    const p = char.profile.physicalDescription;
    return `
CHARACTER ${index + 1} - ${char.profile.name}${char.position ? ` (${char.position})` : ''}:
- Appearance: ${p.age}, ${p.build}, ${p.hairColor} ${p.hairStyle} hair, ${p.eyeColor} eyes, ${p.skinTone} skin
- Distinctive: ${char.profile.distinctiveFeatures.slice(0, 2).join(', ')}
- Outfit: ${char.profile.clothing.signature || char.profile.clothing.style}
${char.emotion ? `- Expression: ${char.emotion}` : ''}
${char.action ? `- Doing: ${char.action}` : ''}
`;
  }).join('\n');

  return `
SCENE: ${sceneDescription}

CHARACTERS IN SCENE:
${characterBlocks}

${options.setting ? `SETTING: ${options.setting}` : ''}
${options.mood ? `MOOD: ${options.mood}` : ''}

CRITICAL - ALL CHARACTERS MUST BE:
1. Clearly distinguishable from each other
2. Consistent with their individual visual profiles
3. Properly positioned in the scene composition
4. Interacting naturally if scene requires it

Each character must be RECOGNIZABLE and CONSISTENT with previous images.
`.trim();
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Gets a cached character profile by ID
 */
export function getCharacterProfile(id: string): CharacterVisualProfile | undefined {
  return characterProfileCache.get(id);
}

/**
 * Updates a character profile in cache
 */
export function updateCharacterProfile(profile: CharacterVisualProfile): void {
  profile.updatedAt = Date.now();
  characterProfileCache.set(profile.id, profile);
}

/**
 * Clears all cached character profiles
 */
export function clearCharacterCache(): void {
  characterProfileCache.clear();
}

/**
 * Gets all cached character profiles
 */
export function getAllCachedProfiles(): CharacterVisualProfile[] {
  return Array.from(characterProfileCache.values());
}

export default {
  extractVisualProfile,
  buildCharacterReference,
  buildScenePromptWithCharacter,
  buildMultiCharacterScenePrompt,
  getCharacterProfile,
  updateCharacterProfile,
  clearCharacterCache,
  getAllCachedProfiles
};
