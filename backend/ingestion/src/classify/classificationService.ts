/**
 * Classification Service
 *
 * Integrates rule-based classification into the import pipeline.
 *
 * Responsibilities:
 * - Load active rules from repository
 * - Create batch matcher with rules
 * - Classify transactions
 * - Track rule matching rationale
 * - Mark unclassified transactions with classification_source = 'NONE'
 */

import { Rule, Transaction, ClassificationSource, MatcherType } from '../domain/types';
import { IRuleRepository } from '../domain/repositories';
import { BatchDocumentMatcher } from './matcher';

/**
 * Classification result for a transaction
 */
export interface ClassificationResult {
  ruleId?: string;
  ruleName?: string;
  ruleVersion?: number;
  rationale?: string;
  classificationSource: ClassificationSource;
  matched: boolean;
}

/**
 * Classification Service
 */
export class ClassificationService {
  private repository: IRuleRepository;
  private matcher: BatchDocumentMatcher | null = null;
  private rulesLoaded = false;

  constructor(repository: IRuleRepository) {
    this.repository = repository;
  }

  /**
   * Initialize the classification service by loading active rules
   *
   * Must be called before classifying transactions.
   * Rules are loaded once and reused for all classifications.
   *
   * @returns Promise that resolves when rules are loaded
   */
  async initialize(): Promise<void> {
    if (this.rulesLoaded) {
      return; // Already initialized
    }

    // Create fresh matcher
    this.matcher = new BatchDocumentMatcher();

    // Load all active rules sorted by priority
    const rules = await this.repository.findActive();

    // Add each rule to the matcher
    for (const rule of rules) {
      try {
        this.matcher.addRule(
          rule.id,
          rule.name,
          rule.pattern,
          rule.matchType as MatcherType,
          rule.priority
        );
      } catch (error) {
        console.warn(
          `Failed to load rule "${rule.name}" (${rule.id}): ${error instanceof Error ? error.message : String(error)}`
        );
        // Continue loading other rules
      }
    }

    this.rulesLoaded = true;
  }

  /**
   * Classify a transaction based on its documento field
   *
   * Returns classification result with matched rule details (if matched).
   * If no match, classificationSource is set to 'NONE'.
   *
   * @param transaction - Transaction to classify
   * @returns ClassificationResult with matched rule and rationale
   */
  async classify(transaction: Transaction): Promise<ClassificationResult> {
    // Ensure matcher is initialized
    if (!this.matcher) {
      await this.initialize();
    }

    // Safety check after initialize
    if (!this.matcher) {
      return {
        classificationSource: 'NONE',
        matched: false,
        rationale: 'Classification service not properly initialized',
      };
    }

    // Try to find a matching rule
    const match = this.matcher.findFirstMatch(transaction.documento);

    if (!match) {
      // No rule matched
      return {
        classificationSource: 'NONE',
        matched: false,
        rationale: 'No classification rule matched',
      };
    }

    // Look up the rule to get version
    const rule = await this.repository.findById(match.ruleId);

    return {
      ruleId: match.ruleId,
      ruleName: match.ruleName,
      ruleVersion: rule?.version,
      rationale: match.reason,
      classificationSource: 'RULE',
      matched: true,
    };
  }

  /**
   * Classify multiple transactions in batch
   *
   * Efficient batch classification using the same matcher instance.
   *
   * @param transactions - Array of transactions to classify
   * @returns Array of classification results (same order as input)
   */
  async classifyBatch(transactions: Transaction[]): Promise<ClassificationResult[]> {
    // Ensure matcher is initialized once
    if (!this.matcher) {
      await this.initialize();
    }

    return Promise.all(transactions.map((t) => this.classify(t)));
  }

  /**
   * Reload rules from repository
   *
   * Use this if rules are added/updated while the service is running.
   * This will refresh the matcher with the latest rules.
   *
   * @returns Promise that resolves when rules are reloaded
   */
  async reload(): Promise<void> {
    this.rulesLoaded = false;
    this.matcher = null;
    await this.initialize();
  }

  /**
   * Get rule statistics (debugging)
   *
   * @returns Object with rule count and priorities
   */
  getRuleStats(): {
    totalRules: number;
    rules: Array<{ ruleId: string; ruleName: string; priority: number }>;
  } {
    if (!this.matcher) {
      return { totalRules: 0, rules: [] };
    }

    return {
      totalRules: this.matcher.getRuleCount(),
      rules: this.matcher.getRules(),
    };
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.rulesLoaded && this.matcher !== null;
  }
}
