import {
	getBlueprintDeclaration,
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
 * Resolves `originalBlueprint` to a plain, editable declaration object, or
 * null when it can't be safely turned into one.
 *
 * `originalBlueprint` is bundle-shaped (has a `.read()` method,
 * `isBlueprintBundle()`) in two very different situations:
 *  - A real ZIP-style Blueprint bundle, carrying local files (e.g. a WXR
 *    import or a zipped plugin) that its declaration references via
 *    `resource: "bundled"`. Flattening this to a plain declaration would
 *    silently break those references on the next boot — those files only
 *    exist inside the bundle.
 *  - A read-only wrapper Playground puts around *any* remote-JSON
 *    Blueprint (e.g. `?blueprint-url=...`, or the default "New Playground"
 *    welcome Blueprint) purely so `resource: "bundled"` references would
 *    resolve relative to the URL it was fetched from. When the
 *    declaration doesn't actually use any `bundled` reference, this
 *    wrapper carries no information worth preserving, and can be safely
 *    flattened.
 *
 * This distinguishes the two by inspecting the declaration itself rather
 * than the wrapper: if it references a `resource: "bundled"` value
 * anywhere, treat it as non-appendable.
 */
async function resolveAppendableDeclaration(
	originalBlueprint: unknown
): Promise<Record<string, unknown> | null> {
	if (!originalBlueprint) {
		return {};
	}
	if (!isBlueprintBundle(originalBlueprint)) {
		return typeof originalBlueprint === 'object'
			? (originalBlueprint as Record<string, unknown>)
			: {};
	}
	let declaration: Record<string, unknown>;
	try {
		declaration = (await getBlueprintDeclaration(
			originalBlueprint as any
		)) as Record<string, unknown>;
	} catch {
		return null;
	}
	if (JSON.stringify(declaration).includes('"resource":"bundled"')) {
		return null;
	}
	return declaration;
}

/**
 * Appends a step to a site's `originalBlueprint`, returning the updated
 * value and the new step's index. Returns null when `originalBlueprint`
 * can't be safely turned into an editable declaration (see
 * `resolveAppendableDeclaration`).
 */
export async function appendGitDirectoryStepToOriginalBlueprint(
	originalBlueprint: unknown,
	step: StepDefinition
): Promise<{ updated: unknown; stepIndex: number } | null> {
	const base = await resolveAppendableDeclaration(originalBlueprint);
	if (!base) {
		return null;
	}
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
 * Returns null when `originalBlueprint` can't be safely turned into an
 * editable declaration (see `resolveAppendableDeclaration`), or when the
 * step at `stepIndex` no longer looks like an install step (the Blueprint
 * may have been hand-edited since).
 */
export async function patchGitDirectoryStepFolderName(
	originalBlueprint: unknown,
	stepIndex: number,
	newFolderName: string
): Promise<unknown | null> {
	const base = await resolveAppendableDeclaration(originalBlueprint);
	if (!base) {
		return null;
	}
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
