import type { BlueprintV1Declaration } from '@wp-playground/client';
import { createLanguageStep } from './i18n';
import {
	healthCheckRecoveryBlueprint,
	isHealthCheckRecoveryUrl,
} from '../health-check-recovery';

/** Loads the default Personal WP Blueprint and applies the browser language. */
export async function loadPersonalBlueprint(blueprintUrl: string): Promise<{
	blueprint: BlueprintV1Declaration;
	source: { type: 'personal-blueprint'; url: string };
}> {
	const response = await fetch(blueprintUrl);
	const blueprint = (await response.json()) as BlueprintV1Declaration;

	const languageStep = createLanguageStep();
	if (languageStep) {
		blueprint.steps = blueprint.steps || [];
		blueprint.steps.unshift(languageStep);
	}

	return {
		blueprint,
		source: {
			type: 'personal-blueprint',
			url: blueprintUrl,
		},
	};
}

/** The recovery link is the only launch URL that applies steps to an existing site. */
export function resolveRecoveryBlueprintFromUrl(
	url: URL
): BlueprintV1Declaration | null {
	return isHealthCheckRecoveryUrl(url) ? healthCheckRecoveryBlueprint : null;
}
