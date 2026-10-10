/**
 * Input Sanitization Utilities
 *
 * Provides functions to sanitize user input before sending to AI providers
 * to prevent prompt injection attacks.
 */

/**
 * Patterns that indicate potential prompt injection attempts
 */
const INJECTION_PATTERNS = [
  // Common prompt injection patterns
  /ignore\s+(previous|all|above)\s+(instructions?|prompts?)/gi,
  /disregard\s+(previous|all|above)\s+(instructions?|prompts?)/gi,
  /forget\s+(previous|all|above)\s+(instructions?|prompts?)/gi,
  /new\s+instructions?:/gi,
  /system\s*prompt\s*:/gi,
  /\[SYSTEM\]/gi,
  /\[INST\]/gi,
  /<<\s*SYS\s*>>/gi,
  /```system/gi,
  // Delimiter manipulation
  /---+\s*(new|system|assistant)/gi,
  /===+\s*(new|system|assistant)/gi,
];

/**
 * Characters to escape/neutralize in user input
 */
const ESCAPE_CHARS: Record<string, string> = {
  "```": "` ` `", // Break code blocks
  "###": "# # #", // Break markdown headers used as delimiters
  "---": "- - -", // Break horizontal rules used as delimiters
  "===": "= = =", // Break alternate HR syntax
};

/**
 * Options for sanitization
 */
interface SanitizeOptions {
  /** Maximum length of the input (default: 10000) */
  maxLength?: number;
  /** Whether to detect and warn about potential injections (default: true) */
  detectInjection?: boolean;
  /** Whether to escape delimiter characters (default: true) */
  escapeDelimiters?: boolean;
  /** Whether to strip control characters (default: true) */
  stripControlChars?: boolean;
}

/**
 * Result of sanitization
 */
interface SanitizeResult {
  /** Sanitized text */
  text: string;
  /** Whether potential injection was detected */
  injectionDetected: boolean;
  /** Whether the text was truncated */
  truncated: boolean;
  /** Original length before processing */
  originalLength: number;
}

/**
 * Sanitize user input before sending to AI
 *
 * @param input - User-provided input text
 * @param options - Sanitization options
 * @returns Sanitized result with metadata
 */
function sanitizeAIInput(
  input: string,
  options: SanitizeOptions = {},
): SanitizeResult {
  const {
    maxLength = 10000,
    detectInjection = true,
    escapeDelimiters = true,
    stripControlChars = true,
  } = options;

  const originalLength = input.length;
  let text = input;
  let injectionDetected = false;
  let truncated = false;

  // Strip control characters (except newlines and tabs)
  if (stripControlChars) {
    // eslint-disable-next-line no-control-regex
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  }

  // Detect potential injection patterns
  if (detectInjection) {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        injectionDetected = true;
        break;
      }
    }
  }

  // Escape delimiter characters
  if (escapeDelimiters) {
    for (const [pattern, replacement] of Object.entries(ESCAPE_CHARS)) {
      text = text.split(pattern).join(replacement);
    }
  }

  // Truncate if too long
  if (text.length > maxLength) {
    text = text.slice(0, maxLength);
    truncated = true;
  }

  // Trim whitespace
  text = text.trim();

  return {
    text,
    injectionDetected,
    truncated,
    originalLength,
  };
}

/**
 * Sanitize a simple string input (for chat messages)
 *
 * @param input - User message
 * @param maxLength - Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeMessage(input: string, maxLength = 10000): string {
  const result = sanitizeAIInput(input, { maxLength });
  return result.text;
}

/**
 * Sanitize an object with string fields
 *
 * @param obj - Object with string values to sanitize
 * @param fields - Field names to sanitize (all string fields if not specified)
 * @returns Object with sanitized fields
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  fields?: (keyof T)[],
): T {
  const result = { ...obj };

  for (const key of Object.keys(result)) {
    if (typeof result[key] === "string") {
      if (!fields || fields.includes(key as keyof T)) {
        (result as Record<string, unknown>)[key] = sanitizeMessage(
          result[key] as string,
        );
      }
    }
  }

  return result;
}

/**
 * Sanitize an array of AI messages (chat history)
 *
 * @param messages - Array of messages with content field
 * @returns Sanitized messages
 */
export function sanitizeMessages<T extends { content: string }>(
  messages: T[],
): T[] {
  return messages.map((msg) => ({
    ...msg,
    content: sanitizeMessage(msg.content),
  }));
}
