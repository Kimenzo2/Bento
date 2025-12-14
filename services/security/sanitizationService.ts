/**
 * Request Sanitization Service
 * 
 * Lightweight input validation and PII detection for AI requests.
 * Designed to be FAST - uses regex patterns, no ML models or API calls.
 * 
 * Features:
 * - PII detection (emails, phones, SSNs, credit cards)
 * - Payload size validation
 * - Prompt injection detection
 * - Content policy enforcement
 */

// ============================================================================
// PII DETECTION PATTERNS
// ============================================================================

const PII_PATTERNS = {
  // Email addresses
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  
  // Phone numbers (various formats)
  phone: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  
  // Social Security Numbers
  ssn: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
  
  // Credit card numbers (basic pattern)
  creditCard: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,
  
  // IP addresses
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  
  // Dates of birth (common formats)
  dob: /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g
};

// ============================================================================
// PROMPT INJECTION PATTERNS
// ============================================================================

const INJECTION_PATTERNS = [
  // System prompt overrides
  /ignore\s+(all\s+)?(previous|above)\s+(instructions?|prompts?)/i,
  /disregard\s+(all\s+)?(previous|above)\s+(instructions?|prompts?)/i,
  /forget\s+(all\s+)?(previous|above)\s+(instructions?|prompts?)/i,
  
  // Role manipulation
  /you\s+are\s+now\s+(a|an)\s+/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /act\s+as\s+(if\s+you\s+are|a|an)/i,
  
  // Jailbreak attempts
  /\bDAN\b.*\bmode\b/i,
  /\bjailbreak\b/i,
  /bypass\s+(safety|content|filter)/i,
  
  // Hidden instruction attempts
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /<<SYS>>/i
];

// ============================================================================
// CONTENT POLICY PATTERNS (for children's content)
// ============================================================================

const INAPPROPRIATE_CONTENT = [
  // Violence
  /\b(kill|murder|blood|gore|violent|weapon|gun|knife|stab)\b/i,
  
  // Adult content
  /\b(nude|naked|sexual|explicit|pornograph)/i,
  
  // Harmful behavior
  /\b(suicide|self[-\s]?harm|eating\s+disorder)/i,
  
  // Drugs/alcohol for minors
  /\b(drug|cocaine|heroin|meth|alcohol|drunk|weed|marijuana)\b/i
];

// ============================================================================
// TYPES
// ============================================================================

export interface SanitizationResult {
  isClean: boolean;
  sanitizedText: string;
  issues: SanitizationIssue[];
  blocked: boolean;
  blockReason?: string;
}

export interface SanitizationIssue {
  type: 'pii' | 'injection' | 'content_policy' | 'size';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  redacted?: boolean;
}

export interface SanitizationOptions {
  redactPII?: boolean;
  checkInjection?: boolean;
  checkContentPolicy?: boolean;
  maxLength?: number;
  isChildrenContent?: boolean;
}

// ============================================================================
// MAIN SANITIZATION FUNCTION
// ============================================================================

/**
 * Sanitize input text - FAST, synchronous, no API calls
 * 
 * @param text - The input text to sanitize
 * @param options - Sanitization options
 * @returns SanitizationResult with cleaned text and any issues found
 */
export function sanitizeInput(
  text: string,
  options: SanitizationOptions = {}
): SanitizationResult {
  const {
    redactPII = true,
    checkInjection = true,
    checkContentPolicy = true,
    maxLength = 50000,
    isChildrenContent = true
  } = options;
  
  const issues: SanitizationIssue[] = [];
  let sanitizedText = text;
  let blocked = false;
  let blockReason: string | undefined;
  
  // Check size first (fastest check)
  if (text.length > maxLength) {
    issues.push({
      type: 'size',
      severity: 'medium',
      description: `Input exceeds maximum length of ${maxLength} characters`
    });
    sanitizedText = text.substring(0, maxLength);
  }
  
  // Check for PII
  if (redactPII) {
    for (const [piiType, pattern] of Object.entries(PII_PATTERNS)) {
      const matches = text.match(pattern);
      if (matches) {
        issues.push({
          type: 'pii',
          severity: 'medium',
          description: `Found ${matches.length} potential ${piiType}(s)`,
          redacted: true
        });
        // Redact with placeholder
        sanitizedText = sanitizedText.replace(pattern, `[REDACTED_${piiType.toUpperCase()}]`);
      }
    }
  }
  
  // Check for prompt injection
  if (checkInjection) {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        issues.push({
          type: 'injection',
          severity: 'high',
          description: 'Potential prompt injection detected'
        });
        // Don't block, but log for monitoring
        break;
      }
    }
  }
  
  // Check content policy for children's content
  if (checkContentPolicy && isChildrenContent) {
    for (const pattern of INAPPROPRIATE_CONTENT) {
      if (pattern.test(text)) {
        issues.push({
          type: 'content_policy',
          severity: 'critical',
          description: 'Content may violate children\'s content policy'
        });
        blocked = true;
        blockReason = 'Content not appropriate for children\'s educational materials';
        break;
      }
    }
  }
  
  return {
    isClean: issues.length === 0,
    sanitizedText,
    issues,
    blocked,
    blockReason
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick check if text contains PII - returns boolean only
 */
export function containsPII(text: string): boolean {
  for (const pattern of Object.values(PII_PATTERNS)) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Quick check for prompt injection
 */
export function containsInjection(text: string): boolean {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Redact all PII from text
 */
export function redactPII(text: string): string {
  let result = text;
  for (const [piiType, pattern] of Object.entries(PII_PATTERNS)) {
    result = result.replace(pattern, `[REDACTED]`);
  }
  return result;
}

/**
 * Validate payload size for API requests
 */
export function validatePayloadSize(
  payload: any,
  maxSizeBytes: number = 1024 * 1024 // 1MB default
): { valid: boolean; size: number; message?: string } {
  const size = new Blob([JSON.stringify(payload)]).size;
  
  if (size > maxSizeBytes) {
    return {
      valid: false,
      size,
      message: `Payload size ${(size / 1024).toFixed(1)}KB exceeds maximum ${(maxSizeBytes / 1024).toFixed(1)}KB`
    };
  }
  
  return { valid: true, size };
}

// ============================================================================
// SANITIZATION FOR SPECIFIC USE CASES
// ============================================================================

/**
 * Sanitize a book generation request
 */
export function sanitizeBookRequest(request: {
  title?: string;
  synopsis?: string;
  characters?: Array<{ name?: string; backstory?: string }>;
}): SanitizationResult {
  const allText = [
    request.title || '',
    request.synopsis || '',
    ...(request.characters || []).map(c => `${c.name || ''} ${c.backstory || ''}`)
  ].join(' ');
  
  return sanitizeInput(allText, {
    redactPII: true,
    checkContentPolicy: true,
    isChildrenContent: true
  });
}

/**
 * Sanitize a character interview question
 */
export function sanitizeInterviewQuestion(question: string): SanitizationResult {
  return sanitizeInput(question, {
    redactPII: false, // Users might ask about character's personal details
    checkInjection: true,
    checkContentPolicy: true,
    maxLength: 2000
  });
}

/**
 * Sanitize an image prompt
 */
export function sanitizeImagePrompt(prompt: string): SanitizationResult {
  return sanitizeInput(prompt, {
    redactPII: true,
    checkInjection: false, // Image prompts don't have injection risk
    checkContentPolicy: true,
    maxLength: 1000,
    isChildrenContent: true
  });
}

export default {
  sanitizeInput,
  containsPII,
  containsInjection,
  redactPII,
  validatePayloadSize,
  sanitizeBookRequest,
  sanitizeInterviewQuestion,
  sanitizeImagePrompt
};
