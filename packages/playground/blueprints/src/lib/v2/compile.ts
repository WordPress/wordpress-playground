import type { FileTree, UniversalPHP } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import type { RuntimeConfiguration } from '../types';
import { resolveRuntimeConfiguration } from '../resolve-runtime-configuration';
import { seemsLikeGitRepoUrl } from '../is-git-repo-url';
import {
	compileBlueprintV1,
	type CompileBlueprintV1Options,
} from '../v1/compile';
import type { BlueprintV1Declaration } from '../v1/types';
import type {
	InstallPluginOptions,
	InstallPluginStep,
	InstallThemeOptions,
	InstallThemeStep,
	StepDefinition,
} from '../steps';
import type { DirectoryReference, FileReference } from '../v1/resources';
import type { BlueprintV2Declaration } from './blueprint-v2-declaration';

export class UnsupportedBlueprintV2FeatureError extends Error {
	public readonly featurePath: string;

	constructor(
		featurePath: string,
		message = 'This Blueprint v2 feature is not supported by the TypeScript runner yet.'
	) {
		super(`${featurePath}: ${message}`);
		this.name = 'UnsupportedBlueprintV2FeatureError';
		this.featurePath = featurePath;
	}
}

type BlueprintV2ApplicationOptions =
	BlueprintV2Declaration['applicationOptions'];
type BlueprintV2Constants = NonNullable<BlueprintV2Declaration['constants']>;
type BlueprintV2SiteOptions = NonNullable<
	BlueprintV2Declaration['siteOptions']
>;
type BlueprintV2MuPlugin = NonNullable<
	BlueprintV2Declaration['muPlugins']
>[number];
type BlueprintV2Theme = NonNullable<BlueprintV2Declaration['themes']>[number];
type BlueprintV2ActiveTheme = NonNullable<
	BlueprintV2Declaration['activeTheme']
>;
type BlueprintV2Plugin = NonNullable<BlueprintV2Declaration['plugins']>[number];
type BlueprintV2Fonts = NonNullable<BlueprintV2Declaration['fonts']>;
type BlueprintV2Media = NonNullable<BlueprintV2Declaration['media']>[number];
type BlueprintV2Role = NonNullable<BlueprintV2Declaration['roles']>[number];
type BlueprintV2User = NonNullable<BlueprintV2Declaration['users']>[number];
type BlueprintV2PostTypes = NonNullable<BlueprintV2Declaration['postTypes']>;
type BlueprintV2Content = NonNullable<
	BlueprintV2Declaration['content']
>[number];
type BlueprintV2Step = NonNullable<
	BlueprintV2Declaration['additionalStepsAfterExecution']
>[number];
type BlueprintV2DataReference =
	| string
	| {
			filename: string;
			content: string;
	  }
	| {
			directoryName: string;
			files: Record<string, string | BlueprintV2InlineDirectory>;
	  }
	| {
			gitRepository: string;
			ref?: string;
			pathInRepository?: string;
			path?: string;
	  };
type BlueprintV2InlineDirectory = {
	files: Record<string, string | BlueprintV2InlineDirectory>;
};
type BlueprintV2InstallAssetDefinition = {
	source: BlueprintV2DataReference;
	active?: boolean;
	activationOptions?: Record<string, unknown>;
	ifAlreadyInstalled?: 'overwrite' | 'skip' | 'error';
	importStarterContent?: boolean;
	targetDirectoryName?: string;
	onError?: 'skip-plugin' | 'skip-theme' | 'throw';
	humanReadableName?: string;
};

export type BlueprintV2ExecutionPlan = BlueprintV2ExecutionPlanItem[];
export type BlueprintV2StepPlan = StepDefinition[];
export type BlueprintV2StepPlanLoweringResult = {
	steps: BlueprintV2StepPlan;
	unsupportedPlan: BlueprintV2ExecutionPlan;
};

export type BlueprintV2ExecutionPlanItem =
	| {
			type: 'defineWpConfigConsts';
			consts: BlueprintV2Constants;
	  }
	| {
			type: 'setSiteOptions';
			options: BlueprintV2SiteOptions;
	  }
	| {
			type: 'installMuPlugin';
			muPlugin: BlueprintV2MuPlugin;
			sourcePath: string;
	  }
	| {
			type: 'installTheme';
			theme: BlueprintV2Theme;
			active: false;
			sourcePath: string;
	  }
	| {
			type: 'installTheme';
			theme: BlueprintV2ActiveTheme;
			active: true;
			sourcePath: string;
	  }
	| {
			type: 'installPlugin';
			plugin: BlueprintV2Plugin;
			sourcePath: string;
	  }
	| {
			type: 'installFonts';
			fonts: BlueprintV2Fonts;
	  }
	| {
			type: 'importMedia';
			media: BlueprintV2Media;
			sourcePath: string;
	  }
	| {
			type: 'setSiteLanguage';
			language: string;
	  }
	| {
			type: 'defineRoles';
			roles: BlueprintV2Role[];
	  }
	| {
			type: 'defineUsers';
			users: BlueprintV2User[];
	  }
	| {
			type: 'definePostTypes';
			postTypes: BlueprintV2PostTypes;
	  }
	| {
			type: 'importContent';
			content: BlueprintV2Content;
			sourcePath: string;
	  }
	| {
			type: 'runStep';
			step: BlueprintV2Step;
			sourcePath: string;
	  };

export type CompiledBlueprintV2 = {
	runtime: RuntimeConfiguration;
	applicationOptions?: BlueprintV2ApplicationOptions;
	plan: BlueprintV2ExecutionPlan;
	steps: BlueprintV2StepPlan;
	unsupportedPlan: BlueprintV2ExecutionPlan;
	run: (playground: UniversalPHP) => Promise<void>;
};

export type CompileBlueprintV2Options = Pick<
	CompileBlueprintV1Options,
	'progress' | 'streamBundledFile'
>;

/**
 * Compiles a Blueprint v2 declaration into the pieces the TypeScript runner can
 * understand today.
 *
 * It resolves runtime options, creates an ordered v2 execution plan, and lowers
 * supported plan items into v1 step records. Fully lowered plans run through the
 * existing v1 runner; unsupported items stay visible and block execution before
 * any partial work is applied.
 */
export async function compileBlueprintV2(
	declaration: BlueprintV2Declaration,
	options: CompileBlueprintV2Options = {}
): Promise<CompiledBlueprintV2> {
	const runtime = await resolveRuntimeConfiguration(declaration);
	const plan = createBlueprintV2ExecutionPlan(declaration);
	const { steps, unsupportedPlan } = lowerBlueprintV2ExecutionPlan(plan);
	const v1Blueprint = createV1BlueprintForLoweredV2Steps(
		declaration,
		runtime,
		steps
	);
	return {
		runtime,
		applicationOptions: declaration.applicationOptions,
		plan,
		steps,
		unsupportedPlan,
		run: async (playground) => {
			if (unsupportedPlan.length > 0) {
				throw new UnsupportedBlueprintV2FeatureError(
					'executionPlan',
					getUnsupportedPlanMessage(unsupportedPlan)
				);
			}
			const v1Runner = await compileBlueprintV1(v1Blueprint, options);
			await v1Runner.run(playground);
		},
	};
}

/**
 * Builds the smallest v1 declaration needed to run already-lowered v2 steps.
 *
 * Top-level v2 constants, site options, plugins, and themes are not copied into
 * the v1 top-level fields because the v2 plan lowering already converted them
 * into ordered steps. Copying them here would make the v1 compiler run them
 * twice.
 */
function createV1BlueprintForLoweredV2Steps(
	declaration: BlueprintV2Declaration,
	runtime: RuntimeConfiguration,
	steps: BlueprintV2StepPlan
): BlueprintV1Declaration {
	const applicationOptions =
		declaration.applicationOptions?.['wordpress-playground'];

	return {
		preferredVersions: {
			php: runtime.phpVersion,
			wp: runtime.wpVersion,
		},
		features: {
			intl: runtime.intl,
			networking: runtime.networking,
		},
		extraLibraries: runtime.extraLibraries,
		landingPage: applicationOptions?.landingPage,
		login: applicationOptions?.login,
		steps,
	};
}

function getUnsupportedPlanMessage(unsupportedPlan: BlueprintV2ExecutionPlan) {
	const unsupportedTypes = Array.from(
		new Set(unsupportedPlan.map((item) => item.type))
	).join(', ');

	return (
		`Blueprint v2 execution plan contains unsupported items: ` +
		`${unsupportedTypes}.`
	);
}

/**
 * Converts the top-level Blueprint v2 fields into a simple ordered plan.
 *
 * The plan keeps the original v2 data intact. It only decides execution order
 * and records where each item came from, which makes unsupported items visible
 * instead of silently dropping them during lowering.
 */
export function createBlueprintV2ExecutionPlan(
	declaration: BlueprintV2Declaration
): BlueprintV2ExecutionPlan {
	const plan: BlueprintV2ExecutionPlan = [];

	if (
		declaration.constants &&
		Object.keys(declaration.constants).length > 0
	) {
		plan.push({
			type: 'defineWpConfigConsts',
			consts: declaration.constants,
		});
	}

	if (
		declaration.siteOptions &&
		Object.keys(declaration.siteOptions).length > 0
	) {
		plan.push({
			type: 'setSiteOptions',
			options: declaration.siteOptions,
		});
	}

	for (const [index, muPlugin] of (declaration.muPlugins ?? []).entries()) {
		plan.push({
			type: 'installMuPlugin',
			muPlugin,
			sourcePath: `/muPlugins/${index}`,
		});
	}

	for (const [index, theme] of (declaration.themes ?? []).entries()) {
		plan.push({
			type: 'installTheme',
			theme,
			active: false,
			sourcePath: `/themes/${index}`,
		});
	}

	if (declaration.activeTheme !== undefined) {
		plan.push({
			type: 'installTheme',
			theme: declaration.activeTheme,
			active: true,
			sourcePath: '/activeTheme',
		});
	}

	for (const [index, plugin] of (declaration.plugins ?? []).entries()) {
		plan.push({
			type: 'installPlugin',
			plugin,
			sourcePath: `/plugins/${index}`,
		});
	}

	if (declaration.fonts && Object.keys(declaration.fonts).length > 0) {
		plan.push({
			type: 'installFonts',
			fonts: declaration.fonts,
		});
	}

	for (const [index, media] of (declaration.media ?? []).entries()) {
		plan.push({
			type: 'importMedia',
			media,
			sourcePath: `/media/${index}`,
		});
	}

	if (declaration.siteLanguage) {
		plan.push({
			type: 'setSiteLanguage',
			language: declaration.siteLanguage,
		});
	}

	if (declaration.roles?.length) {
		plan.push({
			type: 'defineRoles',
			roles: declaration.roles,
		});
	}

	if (declaration.users?.length) {
		plan.push({
			type: 'defineUsers',
			users: declaration.users,
		});
	}

	if (
		declaration.postTypes &&
		Object.keys(declaration.postTypes).length > 0
	) {
		plan.push({
			type: 'definePostTypes',
			postTypes: declaration.postTypes,
		});
	}

	for (const [index, content] of (declaration.content ?? []).entries()) {
		plan.push({
			type: 'importContent',
			content,
			sourcePath: `/content/${index}`,
		});
	}

	for (const [index, step] of (
		declaration.additionalStepsAfterExecution ?? []
	).entries()) {
		plan.push({
			type: 'runStep',
			step,
			sourcePath: `/additionalStepsAfterExecution/${index}`,
		});
	}

	return plan;
}

/**
 * Converts the supported v2 plan items into v1-compatible step records.
 *
 * The v1 step runner already knows how to install plugins, install themes, set
 * options, and run several imperative steps. This function reuses those shapes
 * while keeping unsupported v2-only work in `unsupportedPlan` for future PRs.
 */
export function lowerBlueprintV2ExecutionPlan(
	plan: BlueprintV2ExecutionPlan
): BlueprintV2StepPlanLoweringResult {
	const steps: StepDefinition[] = [];
	const unsupportedPlan: BlueprintV2ExecutionPlan = [];

	for (const planItem of plan) {
		const loweredSteps = lowerBlueprintV2ExecutionPlanItem(planItem);
		if (loweredSteps) {
			steps.push(...loweredSteps);
		} else {
			unsupportedPlan.push(planItem);
		}
	}

	return { steps, unsupportedPlan };
}

/**
 * Lowers one v2 plan item when it has a direct v1 step equivalent.
 *
 * Returning `undefined` is intentional: it means "this plan item is valid v2,
 * but this PR has not taught the TypeScript runner how to represent it yet."
 */
function lowerBlueprintV2ExecutionPlanItem(
	planItem: BlueprintV2ExecutionPlanItem
): StepDefinition[] | undefined {
	switch (planItem.type) {
		case 'defineWpConfigConsts':
			return [
				{
					step: 'defineWpConfigConsts',
					consts: planItem.consts,
				},
			];
		case 'setSiteOptions':
			return [
				{
					step: 'setSiteOptions',
					options: planItem.options,
				},
			];
		case 'installTheme':
			return [createInstallThemeStep(planItem.theme, planItem.active)];
		case 'installPlugin':
			return [createInstallPluginStep(planItem.plugin)];
		case 'setSiteLanguage':
			return [
				{
					step: 'setSiteLanguage',
					language: planItem.language,
				},
			];
		case 'runStep':
			return lowerAdditionalBlueprintV2Step(planItem.step);
		default:
			return undefined;
	}
}

/**
 * Lowers v2's `additionalStepsAfterExecution` entries that already match v1
 * steps closely enough to reuse their existing runner implementations.
 */
function lowerAdditionalBlueprintV2Step(
	step: BlueprintV2Step
): StepDefinition[] | undefined {
	switch (step.step) {
		case 'activatePlugin':
			return [
				{
					step: 'activatePlugin',
					pluginPath: step.pluginPath,
					pluginName: step.humanReadableName,
				},
			];
		case 'activateTheme':
			return [
				{
					step: 'activateTheme',
					themeFolderName: step.themeDirectoryName,
				},
			];
		case 'cp':
			return [
				{
					step: 'cp',
					fromPath: toPlaygroundPath(step.fromPath),
					toPath: toPlaygroundPath(step.toPath),
				},
			];
		case 'defineConstants':
			return [
				{
					step: 'defineWpConfigConsts',
					consts: step.constants,
				},
			];
		case 'importThemeStarterContent':
			return [
				{
					step: 'importThemeStarterContent',
					themeSlug: step.themeSlug,
				},
			];
		case 'installPlugin':
			return [createInstallPluginStep(step)];
		case 'installTheme':
			return [createInstallThemeStep(step, step.active ?? true)];
		case 'mkdir':
			return [
				{
					step: 'mkdir',
					path: toPlaygroundPath(step.path),
				},
			];
		case 'mv':
			return [
				{
					step: 'mv',
					fromPath: toPlaygroundPath(step.fromPath),
					toPath: toPlaygroundPath(step.toPath),
				},
			];
		case 'rm':
			return [
				{
					step: 'rm',
					path: toPlaygroundPath(step.path),
				},
			];
		case 'rmdir':
			return [
				{
					step: 'rmdir',
					path: toPlaygroundPath(step.path),
				},
			];
		case 'setSiteLanguage':
			return [
				{
					step: 'setSiteLanguage',
					language: step.language,
				},
			];
		case 'setSiteOptions':
			return [
				{
					step: 'setSiteOptions',
					options: step.options,
				},
			];
		case 'wp-cli':
			return [
				{
					step: 'wp-cli',
					command: step.command,
					wpCliPath: step.wpCliPath,
				},
			];
		default:
			return undefined;
	}
}

/**
 * Creates the v1 `installPlugin` step for a v2 plugin declaration.
 *
 * Blueprint v2 accepts either a bare data reference (`"akismet"`) or an object
 * with a `source` plus install options. `normalizeAssetDefinition()` gives both
 * forms one shape before this function maps the fields to v1 names.
 */
function createInstallPluginStep(plugin: BlueprintV2Plugin): StepDefinition {
	const definition = normalizeAssetDefinition(plugin);
	const step: InstallPluginStep<FileReference, DirectoryReference> = {
		step: 'installPlugin',
		pluginData: convertV2DataReferenceToV1(definition.source, 'plugin'),
		options: createInstallPluginOptions(definition),
	};

	if (definition.ifAlreadyInstalled) {
		step.ifAlreadyInstalled = definition.ifAlreadyInstalled;
	}

	return step;
}

/**
 * Maps plugin-only v2 install options to the v1 `installPlugin` option names.
 */
function createInstallPluginOptions(
	definition: BlueprintV2InstallAssetDefinition
): InstallPluginOptions {
	const options: InstallPluginOptions = {
		activate: definition.active ?? true,
	};

	if (definition.activationOptions) {
		options.activationOptions = definition.activationOptions;
	}
	if (
		definition.onError === 'skip-plugin' ||
		definition.onError === 'throw'
	) {
		options.onError = definition.onError;
	}
	if (definition.targetDirectoryName) {
		options.targetFolderName = definition.targetDirectoryName;
	}
	if (definition.humanReadableName) {
		options.humanReadableName = definition.humanReadableName;
	}

	return options;
}

/**
 * Creates the v1 `installTheme` step for a v2 theme declaration.
 *
 * `active` comes from the surrounding v2 plan item because top-level themes and
 * `activeTheme` use the same source shapes but different activation behavior.
 */
function createInstallThemeStep(
	theme: BlueprintV2Theme | BlueprintV2ActiveTheme,
	active: boolean
): StepDefinition {
	const definition = normalizeAssetDefinition(theme);
	const step: InstallThemeStep<FileReference, DirectoryReference> = {
		step: 'installTheme',
		themeData: convertV2DataReferenceToV1(definition.source, 'theme'),
		options: createInstallThemeOptions(definition, active),
	};

	if (definition.ifAlreadyInstalled) {
		step.ifAlreadyInstalled = definition.ifAlreadyInstalled;
	}

	return step;
}

/**
 * Maps theme-only v2 install options to the v1 `installTheme` option names.
 */
function createInstallThemeOptions(
	definition: BlueprintV2InstallAssetDefinition,
	active: boolean
): InstallThemeOptions {
	const options: InstallThemeOptions = {
		activate: active,
		importStarterContent: definition.importStarterContent ?? false,
	};

	if (definition.targetDirectoryName) {
		options.targetFolderName = definition.targetDirectoryName;
	}
	if (definition.onError === 'skip-theme' || definition.onError === 'throw') {
		options.onError = definition.onError;
	}
	if (definition.humanReadableName) {
		options.humanReadableName = definition.humanReadableName;
	}

	return options;
}

/**
 * Turns the two accepted v2 asset forms into a single object shape.
 *
 * Objects with `source` are full install definitions. Inline files, inline
 * directories, git references, and strings are data references and must be
 * wrapped as `{ source }` before they can be lowered.
 */
function normalizeAssetDefinition(
	asset: BlueprintV2Plugin | BlueprintV2Theme | BlueprintV2ActiveTheme
): BlueprintV2InstallAssetDefinition {
	if (
		asset &&
		typeof asset === 'object' &&
		'source' in asset &&
		!isInlineFile(asset) &&
		!isInlineDirectory(asset) &&
		!isGitPath(asset)
	) {
		return asset as BlueprintV2InstallAssetDefinition;
	}
	return { source: asset as BlueprintV2DataReference };
}

/**
 * Maps a Blueprint v2 data reference to the equivalent v1 resource.
 *
 * V2 groups URLs, WordPress.org slugs, execution-context paths, inline data,
 * and git repositories into one data-reference concept. V1 uses separate
 * `resource` names, so each supported v2 form is identified here explicitly.
 */
function convertV2DataReferenceToV1(
	reference: BlueprintV2DataReference,
	context: 'plugin' | 'theme'
): FileReference | DirectoryReference {
	if (typeof reference === 'string') {
		if (seemsLikeGitRepoUrl(reference)) {
			return {
				resource: 'zip',
				inner: {
					resource: 'git:directory',
					url: reference.trim().replace(/\/+$/, ''),
					ref: 'HEAD',
				},
			};
		}
		if (isHttpUrl(reference)) {
			return { resource: 'url', url: reference };
		}
		if (isExecutionContextPath(reference)) {
			return {
				resource: 'bundled',
				path: normalizeExecutionContextPath(reference),
			};
		}
		return wordpressOrgResource(
			reference,
			context === 'plugin' ? 'plugins' : 'themes'
		);
	}

	if (isInlineFile(reference)) {
		return {
			resource: 'literal',
			name: reference.filename,
			contents: reference.content,
		};
	}

	if (isInlineDirectory(reference)) {
		return {
			resource: 'literal:directory',
			name: reference.directoryName,
			files: inlineDirectoryFilesToFileTree(reference.files),
		};
	}

	if (isGitPath(reference)) {
		return {
			resource: 'git:directory',
			url: reference.gitRepository,
			ref: reference.ref || 'HEAD',
			path: reference.pathInRepository || reference.path || '',
		};
	}

	throw new UnsupportedBlueprintV2FeatureError(
		context,
		'Unsupported Blueprint v2 data reference.'
	);
}

/**
 * Converts a v2 target-site path into the absolute WordPress VFS path that v1
 * file steps expect.
 *
 * V2 paths in imperative file steps are site-relative (`site:...`) or plain
 * relative paths. Empty paths and parent-directory segments are rejected because
 * they would make destructive steps like `rm` ambiguous or unsafe.
 */
function toPlaygroundPath(path: string): string {
	if (typeof path !== 'string' || path.trim() === '') {
		throw new UnsupportedBlueprintV2FeatureError(
			'path',
			'Invalid Blueprint v2 path: must not be empty.'
		);
	}
	if (pathContainsParentDirectorySegment(path)) {
		throw new UnsupportedBlueprintV2FeatureError(
			'path',
			`Invalid Blueprint v2 path "${path}": must not contain parent directory segments.`
		);
	}
	if (path.startsWith('site:')) {
		return joinPaths('/wordpress', path.slice('site:'.length));
	}
	if (path === '/wordpress' || path.startsWith('/wordpress/')) {
		return path;
	}
	return joinPaths('/wordpress', path);
}

/**
 * Checks whether a string is an HTTP(S) URL rather than a WordPress.org slug or
 * a Blueprint execution-context path.
 */
function isHttpUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

/**
 * Checks whether a string points at a file in the Blueprint Execution Context.
 */
function isExecutionContextPath(value: string) {
	// The Blueprint v2 schema defines both "./" and "/" as paths in the
	// Blueprint Execution Context. "/" is chrooted there, not in WordPress.
	return (
		(value.startsWith('./') || value.startsWith('/')) &&
		!pathContainsParentDirectorySegment(
			normalizeExecutionContextPath(value)
		)
	);
}

/**
 * Removes the execution-context marker so v1 bundled resources can resolve the
 * path relative to the bundle root.
 */
function normalizeExecutionContextPath(path: string) {
	return path.replace(/^\.?\//, '');
}

/**
 * Rejects parent-directory traversal before a v2 path is converted to a v1 VFS
 * or bundled-resource path.
 */
function pathContainsParentDirectorySegment(path: string) {
	const vfsPath = path.startsWith('site:')
		? path.slice('site:'.length)
		: path;
	return vfsPath.replace(/\\/g, '/').split('/').includes('..');
}

/**
 * Converts a WordPress.org slug, optionally with `@version`, to the v1 resource
 * shape that the existing plugin/theme installers already consume.
 */
function wordpressOrgResource(
	reference: string,
	type: 'plugins' | 'themes'
): FileReference {
	const { slug, version } = splitWordPressOrgVersionSuffix(reference);
	if (version && version !== 'latest') {
		const singular = type === 'plugins' ? 'plugin' : 'theme';
		return {
			resource: 'url',
			url: `https://downloads.wordpress.org/${singular}/${slug}.${version}.zip`,
		};
	}
	return {
		resource:
			type === 'plugins'
				? 'wordpress.org/plugins'
				: 'wordpress.org/themes',
		slug,
	} as FileReference;
}

/**
 * Splits only the optional `@version` suffix defined by Blueprint v2. The slug
 * itself stays opaque so future WordPress.org slug formats keep working.
 */
function splitWordPressOrgVersionSuffix(reference: string) {
	const separatorIndex = reference.lastIndexOf('@');
	if (separatorIndex === -1) {
		return { slug: reference };
	}

	const version = reference.slice(separatorIndex + 1);
	if (!isSupportedWordPressOrgReferenceVersion(version)) {
		return { slug: reference };
	}

	return {
		slug: reference.slice(0, separatorIndex),
		version,
	};
}

function isSupportedWordPressOrgReferenceVersion(version: string) {
	return version === 'latest' || /^\d+\.\d+(?:\.\d+)?$/.test(version);
}

/**
 * Detects v2 inline file references.
 */
function isInlineFile(
	value: any
): value is { filename: string; content: string } {
	return (
		value &&
		typeof value === 'object' &&
		typeof value.filename === 'string' &&
		typeof value.content === 'string'
	);
}

/**
 * Detects v2 inline directory references.
 */
function isInlineDirectory(value: any): value is {
	directoryName: string;
	files: Record<string, string | BlueprintV2InlineDirectory>;
} {
	return (
		value &&
		typeof value === 'object' &&
		typeof value.directoryName === 'string' &&
		value.files &&
		typeof value.files === 'object'
	);
}

/**
 * Detects v2 git directory references.
 */
function isGitPath(value: any): value is {
	gitRepository: string;
	ref?: string;
	pathInRepository?: string;
	path?: string;
} {
	return (
		value &&
		typeof value === 'object' &&
		typeof value.gitRepository === 'string'
	);
}

/**
 * Converts v2 inline directory contents to the recursive file-tree object used
 * by v1 literal directory resources.
 *
 * File names come from user input, so `Object.defineProperty()` is used instead
 * of normal assignment. That keeps names such as `__proto__` as file entries
 * instead of letting JavaScript treat them as object-prototype operations.
 */
function inlineDirectoryFilesToFileTree(
	files: Record<string, string | BlueprintV2InlineDirectory>
): FileTree {
	const fileTree: FileTree = {};
	for (const [path, content] of Object.entries(files)) {
		const value =
			typeof content === 'string'
				? content
				: inlineDirectoryFilesToFileTree(content.files);
		Object.defineProperty(fileTree, path, {
			value,
			enumerable: true,
			configurable: true,
			writable: true,
		});
	}
	return fileTree;
}
