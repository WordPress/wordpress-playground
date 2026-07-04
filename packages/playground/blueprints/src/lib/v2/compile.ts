import type { FileTree, UniversalPHP } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import type { RuntimeConfiguration } from '../types';
import { resolveRuntimeConfiguration } from '../resolve-runtime-configuration';
import { seemsLikeGitRepoUrl } from '../is-git-repo-url';
import type { StepDefinition } from '../steps';
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

export async function compileBlueprintV2(
	declaration: BlueprintV2Declaration
): Promise<CompiledBlueprintV2> {
	const runtime = await resolveRuntimeConfiguration(declaration);
	const plan = createBlueprintV2ExecutionPlan(declaration);
	const { steps, unsupportedPlan } = lowerBlueprintV2ExecutionPlan(plan);
	return {
		runtime,
		applicationOptions: declaration.applicationOptions,
		plan,
		steps,
		unsupportedPlan,
		run: async () => {
			if (plan.length > 0) {
				throw new UnsupportedBlueprintV2FeatureError(
					'executionPlan',
					'Blueprint v2 execution plans are not runnable by the TypeScript runner yet.'
				);
			}
		},
	};
}

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

function createInstallPluginStep(plugin: BlueprintV2Plugin): StepDefinition {
	const definition = normalizeAssetDefinition(plugin);

	return {
		step: 'installPlugin',
		pluginData: convertV2DataReferenceToV1(definition.source, 'plugin'),
		...(definition.ifAlreadyInstalled
			? { ifAlreadyInstalled: definition.ifAlreadyInstalled }
			: {}),
		options: {
			activate: definition.active ?? true,
			...(definition.activationOptions
				? { activationOptions: definition.activationOptions }
				: {}),
			...(definition.onError ? { onError: definition.onError } : {}),
			...(definition.targetDirectoryName
				? { targetFolderName: definition.targetDirectoryName }
				: {}),
			...(definition.humanReadableName
				? { humanReadableName: definition.humanReadableName }
				: {}),
		},
	} as StepDefinition;
}

function createInstallThemeStep(
	theme: BlueprintV2Theme | BlueprintV2ActiveTheme,
	active: boolean
): StepDefinition {
	const definition = normalizeAssetDefinition(theme);

	return {
		step: 'installTheme',
		themeData: convertV2DataReferenceToV1(definition.source, 'theme'),
		...(definition.ifAlreadyInstalled
			? { ifAlreadyInstalled: definition.ifAlreadyInstalled }
			: {}),
		options: {
			activate: active,
			importStarterContent: definition.importStarterContent ?? false,
			...(definition.targetDirectoryName
				? { targetFolderName: definition.targetDirectoryName }
				: {}),
			...(definition.onError ? { onError: definition.onError } : {}),
			...(definition.humanReadableName
				? { humanReadableName: definition.humanReadableName }
				: {}),
		},
	} as StepDefinition;
}

function normalizeAssetDefinition(asset: any) {
	if (
		asset &&
		typeof asset === 'object' &&
		!isInlineFile(asset) &&
		!isInlineDirectory(asset) &&
		!isGitPath(asset)
	) {
		return asset;
	}
	return { source: asset };
}

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

function toPlaygroundPath(path: string): string {
	if (typeof path !== 'string' || path.length === 0) {
		return '/wordpress';
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

function isHttpUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

function isExecutionContextPath(value: string) {
	return (
		(value.startsWith('./') || value.startsWith('/')) &&
		!pathContainsParentDirectorySegment(
			normalizeExecutionContextPath(value)
		)
	);
}

function normalizeExecutionContextPath(path: string) {
	return path.replace(/^\.?\//, '');
}

function pathContainsParentDirectorySegment(path: string) {
	const vfsPath = path.startsWith('site:')
		? path.slice('site:'.length)
		: path;
	return vfsPath.replace(/\\/g, '/').split('/').includes('..');
}

function wordpressOrgResource(
	reference: string,
	type: 'plugins' | 'themes'
): FileReference {
	const [slug, version] = reference.split('@');
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

function inlineDirectoryFilesToFileTree(
	files: Record<string, string | BlueprintV2InlineDirectory>
): FileTree {
	return Object.fromEntries(
		Object.entries(files).map(([path, content]) => {
			if (typeof content === 'string') {
				return [path, content];
			}
			return [path, inlineDirectoryFilesToFileTree(content.files)];
		})
	);
}
