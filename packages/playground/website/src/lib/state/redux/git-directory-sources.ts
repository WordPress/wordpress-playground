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
 * Blueprint plus every recorded git-mounted plugin and theme. Existing
 * declarations are matched one-to-one by install kind and git source, then
 * updated to use the folder's current name. Unmatched mounts are appended.
 * Blueprint v1 and v2 keep their respective declaration shapes.
 *
 * `hasChanges` tells the caller whether a mount was appended or an existing
 * target directory name changed.
 */
export async function buildUpdatedBlueprintDeclaration(
	originalBlueprint: unknown,
	gitDirectorySources: Record<string, GitDirectoryReference> | undefined
): Promise<{ declaration: Record<string, unknown>; hasChanges: boolean }> {
	const base = await resolveDeclaration(originalBlueprint);
	const mounts = Object.entries(gitDirectorySources ?? {}).map(
		([path, source]) => ({
			path,
			source,
			kind: getInstallKind(path),
			targetFolderName: basename(path),
		})
	);
	return base['version'] === 2
		? updateBlueprintV2(base, mounts)
		: updateBlueprintV1(base, mounts);
}

type InstallKind = 'plugin' | 'theme';
type GitMount = {
	path: string;
	source: GitDirectoryReference;
	kind: InstallKind;
	targetFolderName: string;
};
type DeclaredGitInstall = {
	kind: InstallKind;
	source: GitDirectoryReference;
	targetFolderName: string;
	setTargetFolderName: (name: string) => void;
};

/** Adds and renames git installs while preserving the Blueprint v1 step list. */
function updateBlueprintV1(
	base: Record<string, unknown>,
	mounts: GitMount[]
): { declaration: Record<string, unknown>; hasChanges: boolean } {
	const originalSteps = Array.isArray(base['steps'])
		? (base['steps'] as unknown[])
		: [];
	const steps = [...originalSteps];
	const declaredInstalls = originalSteps.flatMap(
		(step, index): DeclaredGitInstall[] => {
			if (!isRecord(step)) {
				return [];
			}
			const kind =
				step['step'] === 'installPlugin'
					? 'plugin'
					: step['step'] === 'installTheme'
						? 'theme'
						: null;
			const source =
				kind === 'plugin' ? step['pluginData'] : step['themeData'];
			if (!kind || !isGitDirectoryReference(source)) {
				return [];
			}
			const options = isRecord(step['options']) ? step['options'] : {};
			return [
				{
					kind,
					source,
					targetFolderName:
						typeof options['targetFolderName'] === 'string'
							? options['targetFolderName']
							: inferTargetFolderName(source),
					setTargetFolderName: (targetFolderName) => {
						steps[index] = {
							...step,
							options: { ...options, targetFolderName },
						};
					},
				},
			];
		}
	);
	const hasChanges = reconcileGitMounts(mounts, declaredInstalls, (mount) =>
		steps.push(buildGitDirectoryStep(mount.path, mount.source))
	);
	return hasChanges
		? { declaration: { ...base, steps }, hasChanges: true }
		: { declaration: base, hasChanges: false };
}

/**
 * Adds and renames git installs in Blueprint v2 plugin and theme fields.
 */
function updateBlueprintV2(
	base: Record<string, unknown>,
	mounts: GitMount[]
): { declaration: Record<string, unknown>; hasChanges: boolean } {
	const plugins = Array.isArray(base['plugins']) ? [...base['plugins']] : [];
	const themes = Array.isArray(base['themes']) ? [...base['themes']] : [];
	let activeTheme = base['activeTheme'];
	const locations = [
		...plugins.map((definition, index) => ({
			kind: 'plugin' as const,
			definition,
			update: (value: unknown) => {
				plugins[index] = value;
			},
		})),
		...themes.map((definition, index) => ({
			kind: 'theme' as const,
			definition,
			update: (value: unknown) => {
				themes[index] = value;
			},
		})),
		...(activeTheme === undefined
			? []
			: [
					{
						kind: 'theme' as const,
						definition: activeTheme,
						update: (value: unknown) => {
							activeTheme = value;
						},
					},
				]),
	];
	const declaredInstalls = locations.flatMap(
		({ kind, definition, update }): DeclaredGitInstall[] => {
			const source = getBlueprintV2GitSource(definition);
			if (!source) {
				return [];
			}
			return [
				{
					kind,
					source,
					targetFolderName:
						isRecord(definition) &&
						typeof definition['targetDirectoryName'] === 'string'
							? definition['targetDirectoryName']
							: inferTargetFolderName(source),
					setTargetFolderName: (targetDirectoryName) =>
						update(
							isRecord(definition) && 'source' in definition
								? { ...definition, targetDirectoryName }
								: { source: definition, targetDirectoryName }
						),
				},
			];
		}
	);
	const hasChanges = reconcileGitMounts(mounts, declaredInstalls, (mount) => {
		const definition = {
			source: {
				gitRepository: mount.source.url,
				ref: mount.source.ref,
				...(mount.source.path
					? { pathInRepository: mount.source.path }
					: {}),
			},
			...(mount.kind === 'plugin' ? { active: false } : {}),
			targetDirectoryName: mount.targetFolderName,
		};
		(mount.kind === 'theme' ? themes : plugins).push(definition);
	});
	if (!hasChanges) {
		return { declaration: base, hasChanges: false };
	}
	return {
		declaration: {
			...base,
			...(plugins.length > 0 ? { plugins } : {}),
			...(themes.length > 0 ? { themes } : {}),
			...(activeTheme !== undefined ? { activeTheme } : {}),
		},
		hasChanges: true,
	};
}

/** Matches each recorded mount once, renaming or appending as needed. */
function reconcileGitMounts(
	mounts: GitMount[],
	declaredInstalls: DeclaredGitInstall[],
	append: (mount: GitMount) => void
): boolean {
	const matchedDeclarationIndexes = new Set<number>();
	let hasChanges = false;
	for (const mount of mounts) {
		const index = declaredInstalls.findIndex(
			(declared, declaredIndex) =>
				!matchedDeclarationIndexes.has(declaredIndex) &&
				declared.kind === mount.kind &&
				sameGitSource(declared.source, mount.source)
		);
		if (index === -1) {
			append(mount);
			hasChanges = true;
			continue;
		}
		matchedDeclarationIndexes.add(index);
		if (
			declaredInstalls[index].targetFolderName !== mount.targetFolderName
		) {
			declaredInstalls[index].setTargetFolderName(mount.targetFolderName);
			hasChanges = true;
		}
	}
	return hasChanges;
}

/** Returns a v1-shaped git source from a Blueprint v2 install definition. */
function getBlueprintV2GitSource(
	definition: unknown
): GitDirectoryReference | null {
	if (!isRecord(definition)) {
		return null;
	}
	const source = isRecord(definition['source'])
		? definition['source']
		: definition;
	if (typeof source['gitRepository'] !== 'string') {
		return null;
	}
	return {
		resource: 'git:directory',
		url: source['gitRepository'],
		ref: typeof source['ref'] === 'string' ? source['ref'] : 'HEAD',
		path:
			typeof source['pathInRepository'] === 'string'
				? source['pathInRepository']
				: '',
	};
}

/** Compares the complete git source identity used by Blueprint v1. */
function sameGitSource(
	left: GitDirectoryReference,
	right: GitDirectoryReference
) {
	return (
		left.url === right.url &&
		left.ref === right.ref &&
		(left.path || undefined) === (right.path || undefined) &&
		left.refType === right.refType &&
		left['.git'] === right['.git']
	);
}

/** Infers the default install directory name from a git source. */
function inferTargetFolderName(source: GitDirectoryReference) {
	return source.path
		? basename(source.path)
		: deriveFolderNameFromGitUrl(source.url);
}

/** Returns the install kind represented by a WordPress content path. */
function getInstallKind(path: string): InstallKind {
	return basename(dirname(path)) === 'themes' ? 'theme' : 'plugin';
}

/** Narrows unknown JSON-like values to records. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Narrows a JSON-like value to a Blueprint v1 git directory source. */
function isGitDirectoryReference(
	value: unknown
): value is GitDirectoryReference {
	return (
		isRecord(value) &&
		value['resource'] === 'git:directory' &&
		typeof value['url'] === 'string' &&
		typeof value['ref'] === 'string'
	);
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
