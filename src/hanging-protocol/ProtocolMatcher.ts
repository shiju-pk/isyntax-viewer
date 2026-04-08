/**
 * ProtocolMatcher — Evaluates hanging protocol rules against study metadata.
 *
 * For each protocol, evaluates all match rules against the study context,
 * sums weighted scores, and returns match results sorted by score.
 */

import type {
  HangingProtocol,
  ProtocolRule,
  ProtocolMatchResult,
  StudyMatchContext,
  RuleConstraint,
} from './types';

/**
 * Evaluate a single rule constraint against a value.
 */
function evaluateConstraint(constraint: RuleConstraint, value: string | undefined): boolean {
  if (!value) return false;

  const normalized = value.toLowerCase().trim();

  if (constraint.equals !== undefined) {
    return normalized === constraint.equals.toLowerCase().trim();
  }

  if (constraint.contains !== undefined) {
    return normalized.includes(constraint.contains.toLowerCase().trim());
  }

  if (constraint.regex !== undefined) {
    try {
      const re = new RegExp(constraint.regex, 'i');
      return re.test(value);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Resolve a rule attribute from the study context.
 */
function resolveAttribute(
  rule: ProtocolRule,
  context: StudyMatchContext,
): string | undefined {
  switch (rule.attribute) {
    case 'modality':
      return context.modality;
    case 'bodyPartExamined':
      return context.bodyPartExamined;
    case 'studyDescription':
      return context.studyDescription;
    case 'seriesDescription':
      // For series description, match if ANY series matches
      return context.seriesDescriptions?.find((d) =>
        evaluateConstraint(rule.constraint, d)
      );
    default:
      return undefined;
  }
}

/**
 * Evaluate a protocol against a study context.
 * Returns null if no rules match.
 */
export function evaluateProtocol(
  protocol: HangingProtocol,
  context: StudyMatchContext,
): ProtocolMatchResult | null {
  if (protocol.matchRules.length === 0) {
    return {
      protocol,
      score: protocol.priority,
      matchedRules: 0,
      totalRules: 0,
    };
  }

  let totalScore = 0;
  let matchedCount = 0;

  for (const rule of protocol.matchRules) {
    const value = resolveAttribute(rule, context);
    if (evaluateConstraint(rule.constraint, value)) {
      totalScore += rule.weight;
      matchedCount++;
    }
  }

  if (matchedCount === 0) return null;

  return {
    protocol,
    score: totalScore + protocol.priority,
    matchedRules: matchedCount,
    totalRules: protocol.matchRules.length,
  };
}

/**
 * Match a study against all available protocols.
 * Returns results sorted by score (highest first).
 */
export function matchProtocols(
  protocols: HangingProtocol[],
  context: StudyMatchContext,
): ProtocolMatchResult[] {
  const results: ProtocolMatchResult[] = [];

  for (const protocol of protocols) {
    const result = evaluateProtocol(protocol, context);
    if (result) {
      results.push(result);
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Get the best-matching protocol for a study, or null if none match.
 */
export function getBestProtocol(
  protocols: HangingProtocol[],
  context: StudyMatchContext,
): HangingProtocol | null {
  const results = matchProtocols(protocols, context);
  return results.length > 0 ? results[0].protocol : null;
}
