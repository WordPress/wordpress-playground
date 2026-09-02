import {
	isBlueprintBundle,
	type StepDefinition,
} from '@wp-playground/blueprints';
import type { GitDirectorySource } from './slice-sites';

export interface ExtractedGitDirectorySource {
	assetPath: string;
	source: GitDirectorySource;
}

/**
 * Reads the git:directory provenance (repo URL, ref, path) and the
 * resolved install path off a completed installPlugin/installTheme step,
 * or returns null when the step isn't a git:directory install.
 */
export function extractGitDirectorySource(
	step: StepDefinition,
	result: unknown
): ExtractedGitDirectorySource | null {
	if (step.step !== 'installPlugin' && step.step !== 'installTheme') {
		return null;
	}
	const resource = (step as any).pluginData ?? (step as any).themeData;
	if (
		!resource ||
		typeof resource !== 'object' ||
		resource.resource !== 'git:directory'
	) {
		return null;
	}
	const assetPath = (result as { assetPath?: string } | undefined)?.assetPath;
	if (!assetPath) {
		return null;
	}
	return {
		assetPath,
		source: {
			url: resource.url,
			ref: resource.ref,
			refType: resource.refType,
			path: resource.path,
		},
	};
}

/**
 * Appends a step to a site's `originalBlueprint`, returning the updated
 * value and the new step's index.
 *
 * Returns null when `originalBlueprint` is a filesystem-backed
 * `BlueprintBundle` rather than a plain declaration — bundles back
 * saved/bundled sites and are intentionally left untouched here, the same
 * way `SiteBlueprintBundleEditor` avoids mutating a persisted bundle in
 * place.
 */
export function appendGitDirectoryStepToOriginalBlueprint(
	originalBlueprint: unknown,
	step: StepDefinition
): { updated: unknown; stepIndex: number } | null {
	if (originalBlueprint && isBlueprintBundle(originalBlueprint)) {
		return null;
	}
	const base =
		originalBlueprint && typeof originalBlueprint === 'object'
			? (originalBlueprint as Record<string, unknown>)
			: {};
	const existingSteps = Array.isArray(base['steps'])
		? (base['steps'] as unknown[])
		: [];
	const updatedSteps = [...existingSteps, step];
	return {
		updated: { ...base, steps: updatedSteps },
		stepIndex: updatedSteps.length - 1,
	};
}

/**
 * Patches the `targetFolderName` of an `installPlugin`/`installTheme` step
 * at `stepIndex` within a site's `originalBlueprint`, e.g. after the user
 * renames the folder it installed into.
 *
 * Returns null when `originalBlueprint` is a filesystem bundle, or when
 * the step at `stepIndex` no longer looks like an install step (the
 * Blueprint may have been hand-edited since).
 */
export function patchGitDirectoryStepFolderName(
	originalBlueprint: unknown,
	stepIndex: number,
	newFolderName: string
): unknown | null {
	if (!originalBlueprint || isBlueprintBundle(originalBlueprint)) {
		return null;
	}
	const base = originalBlueprint as Record<string, unknown>;
	const steps = Array.isArray(base['steps'])
		? (base['steps'] as unknown[])
		: null;
	const existingStep = steps?.[stepIndex] as
		| { step?: string; options?: Record<string, unknown> }
		| undefined;
	if (
		!steps ||
		!existingStep ||
		typeof existingStep !== 'object' ||
		(existingStep.step !== 'installPlugin' &&
			existingStep.step !== 'installTheme')
	) {
		return null;
	}
	const updatedSteps = [...steps];
	updatedSteps[stepIndex] = {
		...existingStep,
		options: {
			...existingStep.options,
			targetFolderName: newFolderName,
		},
	};
	return { ...base, steps: updatedSteps };
}

/**
 * Fills in a `https://` scheme when the user typed a bare host+path (e.g.
 * `github.com/owner/repo`), so the Mount-via-git URL field doesn't require
 * typing the scheme out.
 */
export function normalizeGitUrl(input: string): string {
	const trimmed = input.trim();
	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed;
	}
	return `https://${trimmed}`;
}

/**
 * Detects a GitHub "tree" URL (e.g. copied from the branch selector, like
 * `https://github.com/owner/repo/tree/some/branch`) and splits it into the
 * plain repository URL and the ref.
 *
 * The entire remainder after `/tree/` is treated as the ref rather than
 * trying to split it into "branch" + "path" — branch names may themselves
 * contain slashes (e.g. `dist/main`), and there's no reliable way to tell
 * a multi-segment branch name apart from a trailing path without querying
 * the repository.
 */
export function parseGitHubTreeUrl(
	input: string
): { url: string; ref: string } | null {
	const match = input
		.trim()
		.match(
			/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/tree\/(.+)$/i
		);
	if (!match) {
		return null;
	}
	const [, owner, repo, ref] = match;
	return {
		url: `https://github.com/${owner}/${repo.replace(/\.git$/i, '')}`,
		ref,
	};
}

/**
 * Derives a filesystem-safe folder name from a git repository URL, e.g.
 * `https://github.com/WordPress/wordpress-playground` -> `wordpress-playground`.
 */
export function deriveFolderNameFromGitUrl(url: string): string {
	const trimmed = url
		.trim()
		.replace(/\/+$/, '')
		.replace(/\.git$/i, '');
	const lastSegment = trimmed.split('/').pop() || '';
	const sanitized = lastSegment.replace(/[^a-zA-Z0-9-_.]/g, '-');
	return sanitized || 'git-mount';
}
