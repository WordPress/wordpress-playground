import type {
	AnalysisResult,
	BlueprintRule,
	BlueprintWarning,
	RuleContext,
} from './types';
import { isTrustedSource } from './trusted-sources';
import {
	externalPluginSourceRule,
	externalThemeSourceRule,
	runPhpRule,
	filesystemOperationsRule,
	wpCliRule,
	requestRule,
} from './rules';

/**
 * Default set of rules to analyze blueprints.
 */
const defaultRules: BlueprintRule[] = [
	externalPluginSourceRule,
	externalThemeSourceRule,
	runPhpRule,
	filesystemOperationsRule,
	wpCliRule,
	requestRule,
];

/**
 * Sort warnings by severity (danger > warning > info).
 */
function sortWarningsBySeverity(warnings: BlueprintWarning[]): BlueprintWarning[] {
	const severityOrder = { danger: 0, warning: 1, info: 2 };
	return [...warnings].sort(
		(a, b) => severityOrder[a.severity] - severityOrder[b.severity]
	);
}

/**
 * Analyze a blueprint to determine if it requires user confirmation.
 *
 * The analysis:
 * 1. Checks if the source is trusted (bypasses confirmation if so)
 * 2. Runs all rules to collect warnings
 * 3. Determines if confirmation is needed based on trust status
 *
 * Confirmation is required for ALL non-trusted blueprints when WordPress
 * is installed, regardless of warning severity. This ensures users always
 * know what's being applied to their persistent installation.
 *
 * @param context - The blueprint and source to analyze
 * @param rules - Optional custom rules (defaults to all built-in rules)
 * @returns Analysis result with warnings and confirmation requirement
 */
export function analyzeBlueprint(
	context: RuleContext,
	rules: BlueprintRule[] = defaultRules
): AnalysisResult {
	const trustedSource = isTrustedSource(context.source);

	// Collect warnings from all rules
	const warnings: BlueprintWarning[] = [];
	for (const rule of rules) {
		const ruleWarnings = rule.analyze(context);
		warnings.push(...ruleWarnings);
	}

	// Sort warnings by severity (danger first, then warning, then info)
	const sortedWarnings = sortWarningsBySeverity(warnings);

	return {
		// Require confirmation for all non-trusted sources
		// The actual check for "is WordPress installed" happens at the integration point
		requiresConfirmation: !trustedSource,
		warnings: sortedWarnings,
		isTrustedSource: trustedSource,
	};
}
