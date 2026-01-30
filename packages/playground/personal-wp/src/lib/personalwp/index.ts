import type { BlueprintV1Declaration } from '@wp-playground/client';
import {
	type ResolvedBlueprint,
	resolveBlueprintFromURL,
	applyQueryOverrides,
} from '../state/url/resolve-blueprint-from-url';
import {
	getBlueprintDeclaration,
	isBlueprintBundle,
} from '@wp-playground/blueprints';
import { logger } from '@php-wasm/logger';
import { createLanguageStep } from './i18n';

/**
 * Determines whether to use the default personal blueprint or process URL params.
 *
 * Personal sites support two modes:
 * 1. Clean URL (no params): Use the default personal blueprint for initial setup
 * 2. URL with params (e.g., ?plugin=friends): Apply the blueprint from URL params
 *
 * This allows users to customize their personal site by visiting URLs like:
 * - playground.wordpress.net/?plugin=woocommerce
 * - playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint.json
 *
 * Returns true (use default blueprint) when:
 * - We're in the top window (not embedded in an iframe)
 * - No URL query params or hash fragment present
 * - A default blueprint URL is configured
 */
export function shouldUsePersonalWPBlueprint(
	url: URL,
	defaultBlueprintUrl?: string
): boolean {
	const hasUrlParams = url.searchParams.size > 0;
	const hasHashFragment = url.hash.length > 1; // More than just '#'
	const hasDefaultBlueprint = !!defaultBlueprintUrl;
	const isTopWindow = window.self === window.top;

	return (
		isTopWindow && !hasUrlParams && !hasHashFragment && hasDefaultBlueprint
	);
}

/**
 * Loads the personal blueprint from a URL and applies i18n settings.
 *
 * If the browser language is not English, a setSiteLanguage step is
 * automatically added to configure WordPress in the user's language.
 */
export async function loadPersonalBlueprint(
	blueprintUrl: string
): Promise<ResolvedBlueprint> {
	const response = await fetch(blueprintUrl);
	const blueprint = await response.json();

	// Add language step based on browser settings (if not English)
	const languageStep = createLanguageStep();
	if (languageStep) {
		blueprint.steps = blueprint.steps || [];
		// Insert language step at the beginning so translations are applied first
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

/**
 * URL parameters that indicate a blueprint should be applied to an existing site.
 */
const ACTIONABLE_URL_PARAMS = [
	'plugin',
	'theme',
	'blueprint-url',
	'import-site',
	'import-wxr',
	'import-content',
];

/**
 * Check if the URL contains parameters that should trigger a blueprint.
 */
function hasActionableUrlParams(url: URL): boolean {
	return ACTIONABLE_URL_PARAMS.some((param) => url.searchParams.has(param));
}

/**
 * Resolves URL params as a blueprint to apply to an existing personal site.
 * Returns null if there are no actionable URL params.
 *
 * This enables applying blueprints to existing sites via URLs like:
 * - ?plugin=woocommerce
 * - ?blueprint-url=data:application/json;base64,...
 */
export async function resolveUrlParamsForExistingSite(
	url: URL
): Promise<BlueprintV1Declaration | null> {
	if (!hasActionableUrlParams(url)) {
		return null;
	}

	try {
		const resolved = await resolveBlueprintFromURL(url, undefined);
		// Extract the blueprint declaration from the bundle if needed
		let blueprint = isBlueprintBundle(resolved.blueprint)
			? await getBlueprintDeclaration(resolved.blueprint)
			: (resolved.blueprint as BlueprintV1Declaration);
		// Apply query overrides (e.g., ?url= for landing page, ?login=, etc.)
		blueprint = (await applyQueryOverrides(
			blueprint,
			url.searchParams
		)) as BlueprintV1Declaration;
		return blueprint;
	} catch (e) {
		logger.error('Error resolving URL blueprint for existing site:', e);
		return null;
	}
}
