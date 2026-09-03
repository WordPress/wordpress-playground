import {
	getBlueprintDeclaration,
	isBlueprintBundle,
	type StepDefinition,
	type GitDirectoryReference,
} from '@wp-playground/blueprints';
import { basename, dirname } from '@php-wasm/util';

export interface ExtractedGitDirectorySource {
	assetPath: string;
	source: GitDirectoryReference;
}

/**
 * Reads the git:directory provenance (repo URL, ref, path) and the
 * resolved install path off a completed installPlugin/installTheme step,
 * or returns null when the step isn't a git:directory install, or when
 * `ifAlreadyInstalled: 'skip'` left an unrelated pre-existing folder in
 * place rather than actually installing from this resource.
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
	const { assetPath, skippedExisting } =
		(result as
			| { assetPath?: string; skippedExisting?: boolean }
			| undefined) ?? {};
	if (!assetPath || skippedExisting) {
		return null;
	}
	return {
		assetPath,
		source: resource as GitDirectoryReference,
	};
}

/**
 * Builds a full Blueprint declaration reflecting the site's original
 * Blueprint plus every plugin/theme mounted live via "Mount via git…" —
 * i.e. every recorded source whose git repo/ref/path isn't already
 * declared by an existing step — freshly generated from current state
 * every time, so it's always accurate regardless of renames and never
 * requires mutating the site's stored Blueprint in place. Meant for the
 * user to open and compare against the original, not to replace it.
 *
 * `hasAdditions` tells the caller whether any step was actually appended,
 * so it can skip writing/showing a preview that's identical to the
 * original Blueprint.
 */
export async function buildUpdatedBlueprintDeclaration(
	originalBlueprint: unknown,
	gitDirectorySources: Record<string, GitDirectoryReference> | undefined
): Promise<{ declaration: Record<string, unknown>; hasAdditions: boolean }> {
	const base = await resolveDeclaration(originalBlueprint);
	const existingSteps = Array.isArray(base['steps'])
		? (base['steps'] as unknown[])
		: [];
	const liveSteps = Object.entries(gitDirectorySources ?? {})
		.filter(([, source]) => !isDeclaredByStep(existingSteps, source))
		.map(([path, source]) => buildGitDirectoryStep(path, source));
	if (liveSteps.length === 0) {
		return { declaration: base, hasAdditions: false };
	}
	return {
		declaration: { ...base, steps: [...existingSteps, ...liveSteps] },
		hasAdditions: true,
	};
}

/**
 * Whether one of `steps` already installs from the same git repo/ref/path
 * as `source`, regardless of where it ended up on disk — the source of
 * truth for "is this already part of the Blueprint" instead of a stored
 * flag, so it can't drift from the Blueprint it's meant to describe.
 */
function isDeclaredByStep(
	steps: unknown[],
	source: GitDirectoryReference
): boolean {
	return steps.some((step) => {
		if (
			!step ||
			typeof step !== 'object' ||
			((step as { step?: unknown }).step !== 'installPlugin' &&
				(step as { step?: unknown }).step !== 'installTheme')
		) {
			return false;
		}
		const resource =
			(step as { pluginData?: unknown; themeData?: unknown })
				.pluginData ??
			(step as { pluginData?: unknown; themeData?: unknown }).themeData;
		if (
			!resource ||
			typeof resource !== 'object' ||
			(resource as { resource?: unknown }).resource !== 'git:directory'
		) {
			return false;
		}
		const reference = resource as {
			url?: string;
			ref?: string;
			path?: string;
		};
		return (
			reference.url === source.url &&
			reference.ref === source.ref &&
			(reference.path ?? undefined) === (source.path ?? undefined)
		);
	});
}

/**
 * Builds the `installPlugin`/`installTheme` step for one git-mounted
 * folder, from its current path (which reflects any rename) and recorded
 * source. The install kind (plugin vs theme) is inferred from the path's
 * parent directory name rather than a hardcoded document root, so it
 * doesn't assume `/wordpress` is the site's document root.
 */
export function buildGitDirectoryStep(
	path: string,
	source: GitDirectoryReference
): StepDefinition {
	const targetFolderName = basename(path);
	return basename(dirname(path)) === 'themes'
		? ({
				step: 'installTheme',
				themeData: source,
				options: { activate: false, targetFolderName },
			} as StepDefinition)
		: ({
				step: 'installPlugin',
				pluginData: source,
				options: { activate: false, targetFolderName },
			} as StepDefinition);
}

/**
 * Resolves `originalBlueprint` to a plain declaration object, best-effort.
 *
 * `originalBlueprint` is bundle-shaped (has a `.read()` method,
 * `isBlueprintBundle()`) both for a real ZIP-style Blueprint bundle (which
 * carries local files its declaration references via
 * `resource: "bundled"`) and for the read-only wrapper Playground puts
 * around *any* remote-JSON Blueprint (e.g. `?blueprint-url=...`, or the
 * default "New Playground" welcome Blueprint) purely so `resource:
 * "bundled"` references would resolve relative to the URL it was fetched
 * from. Either way, only its `blueprint.json` declaration — not any
 * bundled files — is of interest here: this is only ever used to build a
 * *preview* the user can inspect and compare, never written back to the
 * site, so there's nothing to lose by dropping bundled-file references
 * that can't be represented outside the original bundle.
 */
async function resolveDeclaration(
	originalBlueprint: unknown
): Promise<Record<string, unknown>> {
	if (!originalBlueprint) {
		return {};
	}
	if (!isBlueprintBundle(originalBlueprint)) {
		return typeof originalBlueprint === 'object'
			? (originalBlueprint as Record<string, unknown>)
			: {};
	}
	try {
		return (await getBlueprintDeclaration(
			originalBlueprint as any
		)) as Record<string, unknown>;
	} catch {
		return {};
	}
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
