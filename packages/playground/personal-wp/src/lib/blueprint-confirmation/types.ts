import type { BlueprintV1Declaration } from '@wp-playground/blueprints';
import type { BlueprintSource } from '../state/url/resolve-blueprint-from-url';

export type WarningSeverity = 'info' | 'warning' | 'danger';

export interface BlueprintWarning {
	severity: WarningSeverity;
	title: string;
	description: string;
	stepIndex?: number;
}

export interface RuleContext {
	blueprint: BlueprintV1Declaration;
	source: BlueprintSource;
}

export interface BlueprintRule {
	name: string;
	analyze: (context: RuleContext) => BlueprintWarning[];
}

export interface AnalysisResult {
	requiresConfirmation: boolean;
	warnings: BlueprintWarning[];
	isTrustedSource: boolean;
}
