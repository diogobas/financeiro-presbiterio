/**
 * Document Matcher Library
 *
 * Provides pattern matching for transaction classification rules.
 * Supports both CONTAINS (case-insensitive substring) and REGEX matching.
 * All matching is accent-folded (é → e, ç → c, etc.) and case-insensitive.
 *
 * Usage:
 *   const matcher = new DocumentMatcher('PADARIA', 'CONTAINS');
 *   matcher.matches('Pagamento Padaria José'); // true
 */

import { MatcherType } from '../domain/types';

/**
 * Result of a matcher operation
 */
export interface MatchResult {
  matches: boolean;
  reason?: string;
}

/**
 * Document Matcher - Matches patterns against transaction documento field
 */
export class DocumentMatcher {
  private pattern: string;
  private matchType: MatcherType;
  private normalizedPattern: string;

  constructor(pattern: string, matchType: MatcherType) {
    if (!pattern || pattern.trim().length === 0) {
      throw new Error('Pattern cannot be empty');
    }

    this.pattern = pattern;
    this.matchType = matchType;

    // For CONTAINS, normalize the pattern once
    if (matchType === 'CONTAINS') {
      this.normalizedPattern = this.normalize(pattern);
    } else {
      // For REGEX, keep the pattern as-is for compilation
      this.normalizedPattern = pattern;
    }

    // Validate regex pattern if needed
    if (matchType === 'REGEX') {
      try {
        // eslint-disable-next-line no-new
        new RegExp(this.normalizedPattern, 'i');
      } catch (e) {
        throw new Error(`Invalid regex pattern: ${this.pattern}`);
      }
    }
  }

  /**
   * Test if a documento matches the pattern
   */
  matches(documento: string): MatchResult {
    if (!documento || documento.trim().length === 0) {
      return { matches: false, reason: 'Empty documento' };
    }

    try {
      if (this.matchType === 'CONTAINS') {
        return this.matchesContains(documento);
      } else {
        return this.matchesRegex(documento);
      }
    } catch (error) {
      return {
        matches: false,
        reason: `Matching error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Normalize a string by removing accents and converting to uppercase
   * Examples:
   *   "Café" → "CAFE"
   *   "José" → "JOSE"
   *   "Açúcar" → "ACUCAR"
   */
  private normalize(text: string): string {
    return text
      .normalize('NFD') // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
      .toUpperCase();
  }

  /**
   * Case-insensitive, accent-folded substring matching
   */
  private matchesContains(documento: string): MatchResult {
    const normalized = this.normalize(documento);
    const matches = normalized.includes(this.normalizedPattern);
    return {
      matches,
      reason: matches ? `Contains "${this.pattern}"` : `Does not contain "${this.pattern}"`,
    };
  }

  /**
   * Regex matching against normalized (accent-folded, uppercase) documento
   */
  private matchesRegex(documento: string): MatchResult {
    const normalized = this.normalize(documento);
    try {
      const regex = new RegExp(this.normalizedPattern, 'i');
      const matches = regex.test(normalized);
      return {
        matches,
        reason: matches
          ? `Matches regex /${this.pattern}/i`
          : `Does not match regex /${this.pattern}/i`,
      };
    } catch (error) {
      return {
        matches: false,
        reason: `Regex error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get matcher details
   */
  getDetails(): { pattern: string; matchType: MatcherType; normalized: string } {
    return {
      pattern: this.pattern,
      matchType: this.matchType,
      normalized: this.normalizedPattern,
    };
  }
}

/**
 * Batch matcher - efficiently test a documento against multiple rules
 */
export class BatchDocumentMatcher {
  private matchers: Array<{
    ruleId: string;
    ruleName: string;
    matcher: DocumentMatcher;
    priority: number;
  }>;

  constructor() {
    this.matchers = [];
  }

  /**
   * Add a rule to the matcher collection
   */
  addRule(
    ruleId: string,
    ruleName: string,
    pattern: string,
    matchType: MatcherType,
    priority: number = 0
  ): void {
    try {
      const matcher = new DocumentMatcher(pattern, matchType);
      this.matchers.push({ ruleId, ruleName, matcher, priority });
      // Sort by priority (higher = earlier)
      this.matchers.sort((a, b) => b.priority - a.priority);
    } catch (error) {
      throw new Error(
        `Failed to add rule "${ruleName}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Find the first matching rule for a documento
   * Returns the rule that matches, or null if no match
   */
  findFirstMatch(documento: string): { ruleId: string; ruleName: string; reason: string } | null {
    for (const { ruleId, ruleName, matcher } of this.matchers) {
      const result = matcher.matches(documento);
      if (result.matches) {
        return {
          ruleId,
          ruleName,
          reason: result.reason || 'Matched',
        };
      }
    }
    return null;
  }

  /**
   * Find all matching rules for a documento
   */
  findAllMatches(documento: string): Array<{
    ruleId: string;
    ruleName: string;
    reason: string;
  }> {
    const matches = [];
    for (const { ruleId, ruleName, matcher } of this.matchers) {
      const result = matcher.matches(documento);
      if (result.matches) {
        matches.push({
          ruleId,
          ruleName,
          reason: result.reason || 'Matched',
        });
      }
    }
    return matches;
  }

  /**
   * Test if any rule matches the documento
   */
  hasMatch(documento: string): boolean {
    return this.matchers.some((m) => m.matcher.matches(documento).matches);
  }

  /**
   * Get all rules
   */
  getRules(): Array<{ ruleId: string; ruleName: string; priority: number }> {
    return this.matchers.map((m) => ({
      ruleId: m.ruleId,
      ruleName: m.ruleName,
      priority: m.priority,
    }));
  }

  /**
   * Clear all rules
   */
  clear(): void {
    this.matchers = [];
  }

  /**
   * Get rule count
   */
  getRuleCount(): number {
    return this.matchers.length;
  }
}

/**
 * Standalone matching functions for simple use cases
 */
export function normalizeDocumento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function matchesContains(documento: string, pattern: string): boolean {
  const normalized = normalizeDocumento(documento);
  const normalizedPattern = normalizeDocumento(pattern);
  return normalized.includes(normalizedPattern);
}

export function matchesRegex(documento: string, pattern: string): boolean {
  try {
    const normalized = normalizeDocumento(documento);
    const regex = new RegExp(pattern, 'i');
    return regex.test(normalized);
  } catch {
    return false;
  }
}
