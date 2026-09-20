import type { FileTree, UniversalPHP } from '@php-wasm/universal';
import { basename, joinPaths, resolvePathUnder } from '@php-wasm/util';
import type { RuntimeConfiguration } from '../types';
import type { ResolveRuntimeConfigurationOptions } from '../resolve-runtime-configuration';
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
import {
	Resource,
	type DirectoryReference,
	type FileReference,
} from '../v1/resources';
import type { BlueprintV2Declaration } from './blueprint-v2-declaration';
import {
	resolveBlueprintV2RuntimeConfiguration,
	type BlueprintV2SiteMode,
} from './resolve-runtime-configuration';

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
type BlueprintV2ContentBaseline = NonNullable<
	BlueprintV2Declaration['contentBaseline']
>;
type BlueprintV2ContentType = Extract<
	BlueprintV2ContentBaseline,
	readonly unknown[]
>[number];
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
type BlueprintV2ImportContentStep = Extract<
	BlueprintV2Step,
	{ step: 'importContent' }
>;
type BlueprintV2RunPHPStep = Extract<BlueprintV2Step, { step: 'runPHP' }>;
type BlueprintV2ImportMediaStep = Extract<
	BlueprintV2Step,
	{ step: 'importMedia' }
>;
type BlueprintV2WriteFilesStep = Extract<
	BlueprintV2Step,
	{ step: 'writeFiles' }
>;
type BlueprintV2PostContent = Extract<BlueprintV2Content, { type: 'posts' }>;
type BlueprintV2WxrContent = Extract<BlueprintV2Content, { type: 'wxr' }>;
type JsonObject = Record<string, any>;
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
type BlueprintV2FileDataReference =
	| string
	| {
			filename: string;
			content: string;
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

const SITE_CREATION_CONTENT_TYPES: BlueprintV2ContentType[] = [
	'posts',
	'pages',
	'comments',
];

export type BlueprintV2ExecutionPlan = BlueprintV2ExecutionPlanItem[];
export type BlueprintV2StepPlan = StepDefinition[];
export type BlueprintV2StepPlanLoweringResult = {
	steps: BlueprintV2StepPlan;
	unsupportedPlan: BlueprintV2ExecutionPlan;
};

type BlueprintV2LoweringContext = {
	nextTempFileIndex: number;
};

export type BlueprintV2ExecutionPlanItem =
	| {
			type: 'applyContentBaseline';
			contentBaseline: BlueprintV2ContentBaseline;
			sourcePath: '/contentBaseline';
	  }
	| {
			type: 'applyUsersBaseline';
			sourcePath: '/usersBaseline';
	  }
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
> &
	ResolveRuntimeConfigurationOptions & {
		onBlueprintValidated?: (blueprint: BlueprintV2Declaration) => void;
	};

export type ResolveBlueprintV2WordPressSourceOptions = Pick<
	CompileBlueprintV1Options,
	| 'corsProxy'
	| 'gitAdditionalHeadersCallback'
	| 'progress'
	| 'semaphore'
	| 'streamBundledFile'
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
	const runtime = await resolveBlueprintV2RuntimeConfiguration(
		declaration,
		options.siteMode,
		options.onBlueprintValidated
	);
	const plan = createBlueprintV2ExecutionPlan(declaration, options.siteMode);
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
			const v1Runner = await compileBlueprintV1(v1Blueprint, {
				progress: options.progress,
				streamBundledFile: options.streamBundledFile,
			});
			await v1Runner.run(playground);
		},
	};
}

/**
 * Loads a custom WordPress source into the file expected by the boot API.
 *
 * Built-in versions and HTTP(S) ZIP URLs already use each consumer's normal
 * WordPress download path. Execution-context, inline, and Git references need
 * the Blueprint resource loader to turn them into a concrete archive first.
 */
export async function resolveBlueprintV2WordPressSource(
	declaration: BlueprintV2Declaration,
	options: ResolveBlueprintV2WordPressSourceOptions = {}
): Promise<File | undefined> {
	const { assertValidBlueprintV2Declaration } =
		await import('./validate-blueprint-v2');
	assertValidBlueprintV2Declaration(declaration);
	const source = getCustomWordPressDataReference(
		declaration.wordpressVersion
	);
	if (!source) {
		return undefined;
	}

	const resourceReference = convertV2DataReferenceToV1(source, 'wordpress');
	const resource = Resource.create(
		isDirectoryReference(resourceReference)
			? {
					resource: 'zip',
					inner: resourceReference,
					name: 'wordpress.zip',
				}
			: resourceReference,
		options
	);
	return (await resource.resolve()) as File;
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
			wp:
				declaration.wordpressVersion === 'none'
					? false
					: runtime.wpVersion,
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
	const unsupportedItems = unsupportedPlan
		.map(
			(item) =>
				`${getUnsupportedPlanItemPath(item)} (${getUnsupportedPlanItemName(item)})`
		)
		.join(', ');

	return (
		`Blueprint v2 execution plan contains unsupported items: ` +
		`${unsupportedItems}.`
	);
}

function getUnsupportedPlanItemName(item: BlueprintV2ExecutionPlanItem) {
	if (item.type === 'runStep') {
		return item.step.step;
	}
	return item.type;
}

function getUnsupportedPlanItemPath(item: BlueprintV2ExecutionPlanItem) {
	return 'sourcePath' in item ? item.sourcePath : `/${item.type}`;
}

/**
 * Converts the top-level Blueprint v2 fields into a simple ordered plan.
 *
 * The plan keeps the original v2 data intact. It only decides execution order
 * and records where each item came from, which makes unsupported items visible
 * instead of silently dropping them during lowering.
 */
export function createBlueprintV2ExecutionPlan(
	declaration: BlueprintV2Declaration,
	siteMode: BlueprintV2SiteMode = 'create-new-site'
): BlueprintV2ExecutionPlan {
	const plan: BlueprintV2ExecutionPlan = [];
	const contentBaseline = declaration.contentBaseline;

	if (siteMode === 'create-new-site' && contentBaseline !== undefined) {
		const preservedContent = getPreservedContentTypes(contentBaseline);
		if (
			SITE_CREATION_CONTENT_TYPES.some(
				(contentType) => !preservedContent.includes(contentType)
			)
		) {
			plan.push({
				type: 'applyContentBaseline',
				contentBaseline,
				sourcePath: '/contentBaseline',
			});
		}
	}
	if (
		siteMode === 'create-new-site' &&
		declaration.usersBaseline === 'empty'
	) {
		plan.push({
			type: 'applyUsersBaseline',
			sourcePath: '/usersBaseline',
		});
	}

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
	const context: BlueprintV2LoweringContext = {
		nextTempFileIndex: 0,
	};

	for (const planItem of plan) {
		const loweredSteps = lowerBlueprintV2ExecutionPlanItem(
			planItem,
			context
		);
		if (loweredSteps) {
			steps.push(...addProgressMetadata(loweredSteps, planItem));
		} else {
			unsupportedPlan.push(planItem);
		}
	}

	return { steps, unsupportedPlan };
}

/**
 * Assigns progress metadata to the v1 steps produced by one v2 plan item.
 *
 * Some v2 declarations expand into multiple v1 steps. Splitting one unit of
 * progress across those steps keeps the tracker aligned with user-facing v2
 * declarations instead of leaking the internal lowering shape.
 */
function addProgressMetadata(
	steps: StepDefinition[],
	planItem: BlueprintV2ExecutionPlanItem
): StepDefinition[] {
	if (steps.length === 0) {
		return steps;
	}
	const caption = getProgressCaption(planItem);
	const weight = 1 / steps.length;
	return steps.map((step) => ({
		...step,
		progress: {
			...step.progress,
			caption: step.progress?.caption ?? caption,
			weight: step.progress?.weight ?? weight,
		},
	}));
}

/**
 * Returns the progress caption for a single v2 execution-plan item.
 *
 * Keep this switch exhaustive. A new execution-plan item should fail type
 * checks here until the runner decides what progress text to report for it.
 */
function getProgressCaption(planItem: BlueprintV2ExecutionPlanItem): string {
	switch (planItem.type) {
		case 'applyContentBaseline':
			return 'Removing initial content';
		case 'applyUsersBaseline':
			return 'Removing initial users';
		case 'defineWpConfigConsts':
			return 'Defining constants';
		case 'setSiteOptions':
			return 'Setting site options';
		case 'installMuPlugin':
			return 'Installing must-use plugin';
		case 'installTheme':
			return planItem.active
				? 'Installing active theme'
				: 'Installing theme';
		case 'installPlugin':
			return 'Installing plugin';
		case 'installFonts':
			return 'Installing fonts';
		case 'importMedia':
			return 'Importing media';
		case 'setSiteLanguage':
			return 'Setting site language';
		case 'defineRoles':
			return 'Creating roles';
		case 'defineUsers':
			return 'Creating users';
		case 'definePostTypes':
			return 'Registering post types';
		case 'importContent':
			return getContentProgressCaption(planItem.content);
		case 'runStep':
			return getAdditionalStepProgressCaption(planItem.step);
	}
	return assertNever(planItem);
}

/**
 * Makes discriminated-union switches fail at compile time when they miss a
 * case. The thrown error is only a runtime fallback for malformed input.
 */
function assertNever(value: never): never {
	throw new Error(`Unexpected Blueprint v2 progress item: ${value}`);
}

/**
 * Returns the progress caption for v2 content imports.
 *
 * Keep this switch exhaustive. Adding a new content type should require an
 * explicit caption decision instead of silently falling back to generic text.
 */
function getContentProgressCaption(content: BlueprintV2Content): string {
	switch (content.type) {
		case 'mysql-dump':
			return 'Importing SQL content';
		case 'posts':
			return 'Importing posts';
		case 'wxr':
			return 'Importing WXR content';
	}
	return assertNever(content);
}

/**
 * Returns the progress caption for `additionalStepsAfterExecution` entries.
 *
 * Keep this switch exhaustive. These are direct v1-style steps embedded in v2,
 * so new supported step types need a visible progress label here as well.
 */
function getAdditionalStepProgressCaption(step: BlueprintV2Step): string {
	switch (step.step) {
		case 'activatePlugin':
			return 'Activating plugin';
		case 'activateTheme':
			return 'Activating theme';
		case 'cp':
			return 'Copying files';
		case 'defineConstants':
			return 'Defining constants';
		case 'enableMultisite':
			return 'Enabling multisite';
		case 'importContent':
			return 'Importing content';
		case 'importMedia':
			return 'Importing media';
		case 'importThemeStarterContent':
			return 'Importing theme starter content';
		case 'installPlugin':
			return 'Installing plugin';
		case 'installTheme':
			return 'Installing theme';
		case 'mkdir':
			return 'Creating directory';
		case 'mv':
			return 'Moving files';
		case 'rm':
			return 'Removing file';
		case 'rmdir':
			return 'Removing directory';
		case 'resetData':
			return 'Resetting WordPress data';
		case 'runPHP':
			return 'Running PHP';
		case 'runSQL':
			return 'Executing SQL queries';
		case 'setSiteLanguage':
			return 'Setting site language';
		case 'setSiteOptions':
			return 'Setting site options';
		case 'unzip':
			return 'Extracting ZIP file';
		case 'wp-cli':
			return 'Running WP-CLI';
		case 'writeFiles':
			return 'Writing files';
	}
	return assertNever(step);
}

/**
 * Lowers one v2 plan item when it has a direct v1 step equivalent.
 *
 * Returning `undefined` is intentional: it means "this plan item is valid v2,
 * but this PR has not taught the TypeScript runner how to represent it yet."
 */
function lowerBlueprintV2ExecutionPlanItem(
	planItem: BlueprintV2ExecutionPlanItem,
	context: BlueprintV2LoweringContext
): StepDefinition[] | undefined {
	switch (planItem.type) {
		case 'applyContentBaseline':
			return [
				{
					step: 'resetData',
					contentTypes: getRemovedContentTypes(
						planItem.contentBaseline
					),
				},
			];
		case 'applyUsersBaseline':
			return lowerUsersBaseline();
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
		case 'installMuPlugin':
			return lowerMuPlugin(planItem.muPlugin, planItem.sourcePath);
		case 'installFonts':
			return lowerFonts(planItem.fonts, context);
		case 'importMedia':
			return lowerMediaItems(
				[planItem.media],
				planItem.sourcePath,
				context
			);
		case 'defineRoles':
			return [createRolesStep(planItem.roles)];
		case 'defineUsers':
			return [createUsersStep(planItem.users)];
		case 'definePostTypes':
			return lowerPostTypes(planItem.postTypes);
		case 'importContent':
			return lowerBlueprintV2Content(
				planItem.content,
				planItem.sourcePath,
				context
			);
		case 'setSiteLanguage':
			return [
				{
					step: 'setSiteLanguage',
					language: planItem.language,
				},
			];
		case 'runStep':
			return lowerAdditionalBlueprintV2Step(
				planItem.step,
				planItem.sourcePath,
				context
			);
		default:
			return undefined;
	}
}

function getRemovedContentTypes(
	contentBaseline: BlueprintV2ContentBaseline
): BlueprintV2ContentType[] {
	const preservedContent = getPreservedContentTypes(contentBaseline);
	return SITE_CREATION_CONTENT_TYPES.filter(
		(contentType) => !preservedContent.includes(contentType)
	);
}

function getPreservedContentTypes(
	contentBaseline: BlueprintV2ContentBaseline
): readonly BlueprintV2ContentType[] {
	if (contentBaseline === 'keep-all') {
		return SITE_CREATION_CONTENT_TYPES;
	}
	if (contentBaseline === 'empty') {
		return [];
	}
	return asArray(contentBaseline);
}

/**
 * Removes the users created by the WordPress installation wizard.
 *
 * Schema validation guarantees content is removed first and the Blueprint
 * declares a replacement administrator. Resetting the empty tables lets that
 * administrator receive the same identifier as the vanilla account it replaces.
 */
function lowerUsersBaseline(): StepDefinition[] {
	return [
		{
			step: 'runPHP',
			code: `<?php
			require '/wordpress/wp-load.php';
			require_once ABSPATH . 'wp-admin/includes/user.php';

			$user_ids = get_users(['fields' => 'ID']);
			foreach ($user_ids as $user_id) {
				wp_delete_user((int) $user_id);
			}

			$reset_sequence_if_empty = static function($table_name) use ($wpdb) {
				$count = $wpdb->get_var("SELECT COUNT(*) FROM {$table_name}");
				if ((int) $count !== 0) {
					return;
				}
				if (isset($GLOBALS['@pdo'])) {
					$statement = $GLOBALS['@pdo']->prepare(
						'DELETE FROM SQLITE_SEQUENCE WHERE NAME = :table_name'
					);
					$statement->execute([':table_name' => $table_name]);
					return;
				}
				$wpdb->query("ALTER TABLE {$table_name} AUTO_INCREMENT = 1");
			};

			$reset_sequence_if_empty($wpdb->users);
			$reset_sequence_if_empty($wpdb->usermeta);
			`,
		},
	];
}

function lowerBlueprintV2Content(
	content: BlueprintV2Content,
	featurePath: string,
	context: BlueprintV2LoweringContext
): StepDefinition[] | undefined {
	switch (content.type) {
		case 'mysql-dump':
			return asArray(content.source).map((source, index) => ({
				step: 'runSql',
				sql: convertV2FileDataReferenceToV1(
					source,
					`${featurePath}.source[${index}]`
				),
			}));
		case 'wxr':
			return lowerBlueprintV2WxrContent(content, featurePath);
		case 'posts':
			return lowerPostsContent(content, featurePath, context);
		default:
			return undefined;
	}
}

function lowerBlueprintV2WxrContent(
	content: BlueprintV2WxrContent,
	featurePath: string
): StepDefinition[] | undefined {
	const authorsMode =
		content.authorsMode ??
		(content.importUsers ? 'create' : 'default-author');
	const importUsers =
		content.importUsers ?? (authorsMode === 'create' ? true : false);

	return asArray(content.source).map((source, index) => {
		const step: StepDefinition = {
			step: 'importWxr',
			file: convertV2FileDataReferenceToV1(
				source,
				`${featurePath}.source[${index}]`
			),
			fetchAttachments: content.staticAssets !== 'hotlink',
			rewriteUrls: content.urlsMode !== 'preserve',
			importComments: content.importComments ?? false,
			authorsMode,
			importUsers,
		};
		if (content.urlsMap !== undefined) {
			step.urlMapping = content.urlsMap;
		}
		if (content.authorsMap !== undefined) {
			step.authorsMap = content.authorsMap;
		}
		if (content.defaultAuthorUsername !== undefined) {
			step.defaultAuthorUsername = content.defaultAuthorUsername;
		}
		return step;
	});
}

/**
 * Lowers v2's `additionalStepsAfterExecution` entries that already match v1
 * steps closely enough to reuse their existing runner implementations.
 */
function lowerAdditionalBlueprintV2Step(
	step: BlueprintV2Step,
	featurePath: string,
	context: BlueprintV2LoweringContext
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
		case 'enableMultisite':
			return [
				{
					step: 'enableMultisite',
				},
			];
		case 'importContent':
			return lowerImportContentStep(step, context);
		case 'importMedia':
			return lowerImportMediaStep(step, featurePath, context);
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
		case 'resetData':
			return [
				{
					step: 'resetData',
					contentTypes: step.contentTypes,
				},
			];
		case 'runPHP':
			return lowerRunPHPStep(step, featurePath, context);
		case 'runSQL':
			return [
				{
					step: 'runSql',
					sql: convertV2FileDataReferenceToV1(
						step.source,
						'runSQL.source'
					),
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
		case 'unzip':
			return [
				{
					step: 'unzip',
					zipFile: convertV2FileDataReferenceToV1(
						step.zipFile,
						'unzip.zipFile'
					),
					extractToPath: toPlaygroundPath(step.extractToPath),
				},
			];
		case 'writeFiles':
			return lowerWriteFilesStep(step);
		default:
			return undefined;
	}
}

/**
 * Lowers nested `importContent` entries one-by-one so unsupported content
 * still bubbles up as an unsupported v2 plan item.
 */
function lowerImportContentStep(
	step: BlueprintV2ImportContentStep,
	context: BlueprintV2LoweringContext
): StepDefinition[] | undefined {
	const steps: StepDefinition[] = [];
	for (const [index, content] of step.content.entries()) {
		const loweredSteps = lowerBlueprintV2Content(
			content,
			`importContent.content[${index}]`,
			context
		);
		if (!loweredSteps) {
			return undefined;
		}
		steps.push(...loweredSteps);
	}
	return steps;
}

/**
 * Lowers file-backed `runPHP` steps by materializing the PHP script into a
 * compiler-owned temp path before requiring it.
 */
function lowerRunPHPStep(
	step: BlueprintV2RunPHPStep,
	featurePath: string,
	context: BlueprintV2LoweringContext
): StepDefinition[] | undefined {
	if (isInlineFile(step.code)) {
		if (step.env) {
			return [
				{
					step: 'runPHPWithOptions',
					options: {
						code: step.code.content,
						env: step.env,
					},
				},
			];
		}
		return [
			{
				step: 'runPHP',
				code: step.code,
			},
		];
	}

	const phpPath = nextTempFilePath(context, 'blueprint-run-php', 'php');
	return [
		{
			step: 'writeFile',
			path: phpPath,
			data: convertV2FileDataReferenceToV1(
				step.code,
				`${featurePath}/code`
			),
		},
		{
			step: 'runPHPWithOptions',
			options: {
				code: `<?php require ${JSON.stringify(phpPath)};`,
				env: step.env || {},
			},
		},
	];
}

/**
 * Adapts step-local media declarations before delegating to the shared media
 * lowering path.
 */
function lowerImportMediaStep(
	step: BlueprintV2ImportMediaStep,
	featurePath: string,
	context: BlueprintV2LoweringContext
): StepDefinition[] {
	return lowerMediaItems(step.media, `${featurePath}/media`, context);
}

/**
 * Writes a v2 mu-plugin reference directly into `mu-plugins`.
 *
 * Structured inline-file and inline-directory names are already filenames, so
 * they are passed through without rewriting.
 */
function lowerMuPlugin(
	muPlugin: BlueprintV2MuPlugin,
	featurePath: string
): StepDefinition[] {
	const targetPath = getMuPluginTargetPath(muPlugin, featurePath);
	const resource = convertV2WritableDataReferenceToV1(muPlugin, featurePath);
	if (isDirectoryReference(resource)) {
		return [
			{
				step: 'writeFiles',
				writeToPath: targetPath,
				filesTree: resource,
			},
		];
	}
	return [
		{
			step: 'writeFile',
			path: targetPath,
			data: resource,
		},
	];
}

/**
 * Splits post declarations into inline posts and file-backed posts for the
 * PHP importer.
 */
function lowerPostsContent(
	content: BlueprintV2PostContent,
	featurePath: string,
	context: BlueprintV2LoweringContext
): StepDefinition[] {
	const steps: StepDefinition[] = [];
	const inlinePosts: JsonObject[] = [];
	const postFiles: JsonObject[] = [];
	const sourceIsArray = Array.isArray(content.source);
	const sources = (sourceIsArray ? content.source : [content.source]) as (
		| BlueprintV2FileDataReference
		| JsonObject
	)[];

	for (const [index, source] of sources.entries()) {
		const sourcePath = sourceIsArray
			? `${featurePath}.source[${index}]`
			: `${featurePath}.source`;

		if (isV2FileDataReferenceLike(source)) {
			const path = nextTempFilePath(context, 'blueprint-post-content');
			steps.push({
				step: 'writeFile',
				path,
				data: convertV2FileDataReferenceToV1(source, sourcePath),
			});
			postFiles.push({
				path,
				post_title: 'Untitled Post',
				post_type: 'post',
			});
			continue;
		}

		inlinePosts.push({ ...(source as JsonObject) });
	}

	if (inlinePosts.length === 0 && postFiles.length === 0) {
		return steps;
	}

	steps.push({
		step: 'runPHPWithOptions',
		options: {
			code: IMPORT_POSTS_PHP,
			env: {
				BLUEPRINT_POSTS: JSON.stringify(inlinePosts),
				BLUEPRINT_POST_FILES: JSON.stringify(postFiles),
				BLUEPRINT_URLS_MODE: content.urlsMode || 'rewrite',
				BLUEPRINT_URLS_MAP: JSON.stringify(content.urlsMap || {}),
			},
		},
	});
	return steps;
}

/**
 * Materializes media file references and keeps user-facing media metadata
 * separate from compiler-owned temporary file paths.
 */
function lowerMediaItems(
	mediaItems: BlueprintV2Media[],
	featurePath: string,
	context: BlueprintV2LoweringContext
): StepDefinition[] {
	const steps: StepDefinition[] = [];
	const materializedMedia: JsonObject[] = [];

	for (const [index, item] of mediaItems.entries()) {
		const definition =
			item && typeof item === 'object' && 'source' in item
				? item
				: { source: item };
		const sourcePath = `${featurePath}[${index}]`;
		const filename = fileReferenceBasename(definition.source, sourcePath);
		const path = nextTempFilePath(context, 'blueprint-media');
		steps.push({
			step: 'writeFile',
			path,
			data: convertV2FileDataReferenceToV1(definition.source, sourcePath),
		});

		const media: JsonObject = { path, filename };
		for (const field of ['title', 'description', 'alt', 'caption']) {
			if ((definition as any)[field] !== undefined) {
				media[field] = (definition as any)[field];
			}
		}
		materializedMedia.push(media);
	}

	if (materializedMedia.length === 0) {
		return steps;
	}

	steps.push({
		step: 'runPHPWithOptions',
		options: {
			code: IMPORT_MEDIA_PHP,
			env: {
				BLUEPRINT_MEDIA: JSON.stringify(materializedMedia),
			},
		},
	});
	return steps;
}

/**
 * Registers v2 post types by writing generated mu-plugins.
 *
 * File-backed argument objects stay in support files so PHP can load the JSON
 * at runtime without embedding arbitrary file contents in code.
 */
function lowerPostTypes(postTypes: BlueprintV2PostTypes): StepDefinition[] {
	return Object.entries(postTypes).flatMap(([slug, args], index) => {
		const supportFileName = `blueprint-post-type-${index}`;
		const pluginPath = `/wordpress/wp-content/mu-plugins/${supportFileName}.php`;

		if (typeof args === 'string') {
			const argsPath = `/wordpress/wp-content/mu-plugins/${supportFileName}.json`;
			return [
				{
					step: 'writeFile',
					path: argsPath,
					data: convertV2FileDataReferenceToV1(
						args,
						`postTypes.${JSON.stringify(slug)}`
					),
				},
				{
					step: 'writeFile',
					path: pluginPath,
					data: {
						resource: 'literal',
						name: `${supportFileName}.php`,
						contents: createPostTypePluginCode(slug, argsPath),
					},
				},
			];
		}

		const postTypeArgs: JsonObject = { ...(args as JsonObject) };
		if (postTypeArgs['label'] === undefined) {
			postTypeArgs['label'] = defaultDisplayNameFromSlug(slug);
		}
		return [
			{
				step: 'writeFile',
				path: pluginPath,
				data: {
					resource: 'literal',
					name: `${supportFileName}.php`,
					contents: createInlinePostTypePluginCode(
						slug,
						postTypeArgs
					),
				},
			},
		];
	});
}

/**
 * Packages role declarations for the PHP runtime code that applies WordPress
 * role API changes.
 */
function createRolesStep(roles: BlueprintV2Role[]): StepDefinition {
	return {
		step: 'runPHPWithOptions',
		options: {
			code: DEFINE_ROLES_PHP,
			env: {
				BLUEPRINT_ROLES: JSON.stringify(roles),
			},
		},
	};
}

/**
 * Packages user declarations for the PHP runtime code that creates or updates
 * WordPress users.
 */
function createUsersStep(users: BlueprintV2User[]): StepDefinition {
	return {
		step: 'runPHPWithOptions',
		options: {
			code: DEFINE_USERS_PHP,
			env: {
				BLUEPRINT_USERS: JSON.stringify(users),
			},
		},
	};
}

/**
 * Lowers v2 font collections and inline font shortcuts into WordPress font
 * library records.
 *
 * Font binaries are materialized separately and referenced by opaque tokens in
 * the collection JSON consumed by the PHP installer.
 */
function lowerFonts(
	fonts: BlueprintV2Fonts,
	context: BlueprintV2LoweringContext
): StepDefinition[] {
	const steps: StepDefinition[] = [];
	const collections: JsonObject[] = [];
	const fontFiles: Record<string, JsonObject> = {};
	let fileIndex = 0;

	for (const [slug, definition] of Object.entries(fonts)) {
		const fontPath = `fonts.${JSON.stringify(slug)}`;
		if (isV2FileDataReferenceLike(definition)) {
			const token = materializeFontSource(
				definition,
				`${fontPath}.source`,
				slug,
				steps,
				fontFiles,
				fileIndex++,
				context
			);
			const name = defaultDisplayNameFromSlug(slug);
			collections.push({
				slug,
				name,
				font_families: [
					{
						font_family_settings: {
							name,
							slug,
							fontFamily: name,
							fontFace: [
								{
									fontFamily: name,
									src: token,
								},
							],
						},
					},
				],
			});
			continue;
		}

		const collection = cloneJson(definition as JsonObject);
		collection['slug'] = slug;
		collection['name'] =
			collection['name'] || defaultDisplayNameFromSlug(slug);
		collection['font_families'] = (collection['font_families'] || []).map(
			(family: JsonObject, familyIndex: number) => {
				const nextFamily = cloneJson(family);
				const settings = {
					...(nextFamily['font_family_settings'] || {}),
				};
				if (Array.isArray(settings['fontFace'])) {
					settings['fontFace'] = settings['fontFace'].map(
						(face: JsonObject, faceIndex: number) => {
							const nextFace = { ...face };
							nextFace['src'] = materializeFontFaceSource(
								nextFace['src'] as
									| BlueprintV2FileDataReference
									| BlueprintV2FileDataReference[],
								`${fontPath}.font_families[${familyIndex}].font_family_settings.fontFace[${faceIndex}].src`,
								(settings['slug'] as string) || slug,
								steps,
								fontFiles,
								() => fileIndex++,
								context
							);
							return nextFace;
						}
					);
				}
				nextFamily['font_family_settings'] = settings;
				return nextFamily;
			}
		);
		collections.push(collection);
	}

	if (collections.length === 0) {
		return steps;
	}

	steps.push({
		step: 'runPHPWithOptions',
		options: {
			code: INSTALL_FONTS_PHP,
			env: {
				BLUEPRINT_FONT_COLLECTIONS: JSON.stringify(collections),
				BLUEPRINT_FONT_FILES: JSON.stringify(fontFiles),
			},
		},
	});
	return steps;
}

/**
 * Lowers v2 `writeFiles` entries while preserving whether each source is a
 * single file or a directory tree.
 */
function lowerWriteFilesStep(
	step: BlueprintV2WriteFilesStep
): StepDefinition[] {
	const steps: StepDefinition[] = [];
	for (const [path, dataReference] of Object.entries(step.files)) {
		const writeToPath = toPlaygroundPath(path);
		const resource = convertV2WritableDataReferenceToV1(
			dataReference,
			`writeFiles.files[${JSON.stringify(path)}]`
		);
		if (isDirectoryReference(resource)) {
			steps.push({
				step: 'writeFiles',
				writeToPath,
				filesTree: resource,
			});
		} else {
			steps.push({
				step: 'writeFile',
				path: writeToPath,
				data: resource,
			});
		}
	}
	return steps;
}

/**
 * Lowers a font face `src` value while preserving whether the declaration used
 * one source or an ordered fallback list.
 */
function materializeFontFaceSource(
	source: BlueprintV2FileDataReference | BlueprintV2FileDataReference[],
	sourcePath: string,
	slug: string,
	steps: StepDefinition[],
	fontFiles: Record<string, JsonObject>,
	nextIndex: () => number,
	context: BlueprintV2LoweringContext
) {
	if (Array.isArray(source)) {
		return source.map((item, index) =>
			materializeFontSource(
				item,
				`${sourcePath}[${index}]`,
				slug,
				steps,
				fontFiles,
				nextIndex(),
				context
			)
		);
	}
	return materializeFontSource(
		source,
		sourcePath,
		slug,
		steps,
		fontFiles,
		nextIndex(),
		context
	);
}

/**
 * Materializes one font binary and returns the token that the generated PHP
 * installer later replaces with copied font-file metadata.
 */
function materializeFontSource(
	source: BlueprintV2FileDataReference,
	sourcePath: string,
	slug: string,
	steps: StepDefinition[],
	fontFiles: Record<string, JsonObject>,
	index: number,
	context: BlueprintV2LoweringContext
) {
	const filename = fileReferenceBasename(source, sourcePath);
	if (!/\.(woff2|woff|ttf|otf)$/i.test(filename)) {
		throw new UnsupportedBlueprintV2FeatureError(
			sourcePath,
			'Blueprint v2 font sources must reference .woff2, .woff, .ttf, or .otf files.'
		);
	}
	const token = `font-${index}`;
	const path = nextTempFilePath(context, 'blueprint-font');
	steps.push({
		step: 'writeFile',
		path,
		data: convertV2FileDataReferenceToV1(source, sourcePath),
	});
	fontFiles[`blueprint-font-file:${token}`] = {
		path,
		filename,
	};
	return `blueprint-font-file:${token}`;
}

/**
 * Builds a mu-plugin that registers a post type from an inline JSON object.
 */
function createInlinePostTypePluginCode(slug: string, args: JsonObject) {
	return `<?php
add_action('init', function () {
	register_post_type(${JSON.stringify(slug)}, json_decode(${JSON.stringify(
		JSON.stringify(args)
	)}, true));
}, 0);
`;
}

/**
 * Builds a mu-plugin that registers a post type from a support JSON file
 * written next to the generated plugin.
 */
function createPostTypePluginCode(slug: string, argsPath: string) {
	const argsFilename = basename(argsPath);
	return `<?php
add_action('init', function () {
	$args = json_decode(file_get_contents(__DIR__ . '/${argsFilename}'), true);
	if (!is_array($args)) {
		$args = array();
	}
	if (!isset($args['label'])) {
		$args['label'] = ${JSON.stringify(defaultDisplayNameFromSlug(slug))};
	}
	register_post_type(${JSON.stringify(slug)}, $args);
}, 0);
`;
}

const DEFINE_ROLES_PHP = `<?php
require '/wordpress/wp-load.php';

$roles = json_decode(getenv('BLUEPRINT_ROLES') ?: '[]', true);
if (!is_array($roles)) {
	throw new Exception('Invalid Blueprint roles payload.');
}

foreach ($roles as $role) {
	if (empty($role['name']) || !is_string($role['name'])) {
		continue;
	}
	$role_name = $role['name'];
	$display_name = $role['display_name'] ?? ucfirst($role_name);
	$capabilities = $role['capabilities'] ?? array();
	if (!get_role($role_name)) {
		add_role($role_name, $display_name, array('read' => true));
	}
	$role_object = get_role($role_name);
	if (!$role_object) {
		throw new Exception('Could not create Blueprint role: ' . $role_name);
	}
	foreach ($capabilities as $capability => $grant) {
		if (filter_var($grant, FILTER_VALIDATE_BOOLEAN)) {
			$role_object->add_cap($capability);
		} else {
			$role_object->remove_cap($capability);
		}
	}
}
`;

const DEFINE_USERS_PHP = `<?php
require '/wordpress/wp-load.php';

$users = json_decode(getenv('BLUEPRINT_USERS') ?: '[]', true);
if (!is_array($users)) {
	throw new Exception('Invalid Blueprint users payload.');
}

foreach ($users as $user) {
	if (empty($user['username']) || !is_string($user['username'])) {
		continue;
	}
	$username = $user['username'];
	$existing = get_user_by('login', $username);
	if ($existing) {
		$user_id = $existing->ID;
	} else {
		$email = $user['email'] ?? $username . '@example.com';
		$password = $user['password'] ?? wp_generate_password(24, true, true);
		$user_id = wp_create_user($username, $password, $email);
		if (is_wp_error($user_id)) {
			throw new Exception($user_id->get_error_message());
		}
	}
	$user_object = new WP_User($user_id);
	if (!empty($user['role']) && is_string($user['role'])) {
		$user_object->set_role($user['role']);
	}
	foreach (($user['meta'] ?? array()) as $meta_key => $meta_value) {
		update_user_meta($user_id, $meta_key, $meta_value);
	}
}
`;

const IMPORT_POSTS_PHP = `<?php
require '/wordpress/wp-load.php';

$posts = json_decode(getenv('BLUEPRINT_POSTS') ?: '[]', true);
$post_files = json_decode(getenv('BLUEPRINT_POST_FILES') ?: '[]', true);
$urls_mode = getenv('BLUEPRINT_URLS_MODE') ?: 'rewrite';
$urls_map = json_decode(getenv('BLUEPRINT_URLS_MAP') ?: '{}', true);

if (!is_array($posts) || !is_array($post_files) || !is_array($urls_map)) {
	throw new Exception('Invalid Blueprint posts payload.');
}

$blueprint_temp_files = array();
foreach ($post_files as $file) {
	if (is_array($file) && !empty($file['path']) && is_string($file['path'])) {
		$blueprint_temp_files[] = $file['path'];
	}
}

try {
	foreach ($post_files as $file) {
		$source_path = $file['path'] ?? '';
		if (!$source_path || !is_readable($source_path)) {
			throw new Exception('Post content source is not readable: ' . $source_path);
		}
		$posts[] = array(
			'post_title' => $file['post_title'] ?? 'Untitled Post',
			'post_content' => file_get_contents($source_path),
			'post_status' => 'publish',
			'post_type' => $file['post_type'] ?? 'post',
		);
	}

	$default_author = blueprint_default_post_author();
	wp_set_current_user($default_author);

	foreach ($posts as $post) {
		if (!is_array($post)) {
			throw new Exception('Each Blueprint post must be an object.');
		}

		$post = blueprint_prepare_post($post, $default_author, $urls_mode, $urls_map);
		$post_tags = $post['post_tags'] ?? null;
		$page_template = $post['page_template'] ?? null;
		$tax_input = $post['tax_input'] ?? null;
		unset($post['post_tags'], $post['page_template'], $post['tax_input']);

		$post_id = wp_insert_post(wp_slash($post), true);
		if (is_wp_error($post_id)) {
			throw new Exception($post_id->get_error_message());
		}

		if (is_array($post_tags)) {
			blueprint_set_terms($post_id, 'post_tag', $post_tags);
		}
		if (is_array($tax_input)) {
			foreach ($tax_input as $taxonomy => $terms) {
				if (taxonomy_exists($taxonomy) && is_array($terms)) {
					blueprint_set_terms($post_id, $taxonomy, $terms);
				}
			}
		}
		if ($page_template && ($post['post_type'] ?? 'post') === 'page') {
			update_post_meta($post_id, '_wp_page_template', $page_template);
		}
	}
} finally {
	blueprint_cleanup_post_temp_files($blueprint_temp_files);
}

/**
 * Builds the wp_insert_post() payload for one Blueprint post.
 */
function blueprint_prepare_post(array $post, int $default_author, string $urls_mode, array $urls_map): array {
	if (!isset($post['post_author'])) {
		$post['post_author'] = $default_author;
	} else {
		$post['post_author'] = (int) $post['post_author'];
		if ($post['post_author'] <= 0 || !get_userdata($post['post_author'])) {
			$post['post_author'] = $default_author;
		}
	}

	if (isset($post['post_parent_name']) && !isset($post['post_parent'])) {
		$post['post_parent'] = blueprint_find_parent_post_id(
			$post['post_parent_name'],
			$post['post_type'] ?? 'page'
		);
	}
	unset($post['post_parent_name']);

	if (isset($post['post_category']) && is_array($post['post_category'])) {
		$post['post_category'] = blueprint_ensure_terms('category', $post['post_category']);
	}

	foreach (array('post_content', 'post_excerpt', 'guid') as $field) {
		if (isset($post[$field]) && is_string($post[$field])) {
			$post[$field] = blueprint_rewrite_urls($post[$field], $urls_mode, $urls_map);
		}
	}
	if (isset($post['meta_input']) && is_array($post['meta_input'])) {
		$post['meta_input'] = blueprint_rewrite_urls($post['meta_input'], $urls_mode, $urls_map);
	}

	return $post;
}

/**
 * Returns the author used when imported post data omits one.
 */
function blueprint_default_post_author(): int {
	$admins = get_users(array(
		'role' => 'administrator',
		'number' => 1,
		'orderby' => 'ID',
		'order' => 'ASC',
		'fields' => 'ID',
	));
	if (!empty($admins)) {
		return (int) $admins[0];
	}

	$users = get_users(array(
		'number' => 1,
		'orderby' => 'ID',
		'order' => 'ASC',
		'fields' => 'ID',
	));
	if (!empty($users)) {
		return (int) $users[0];
	}

	$existing = get_user_by('login', 'blueprint-author');
	if ($existing) {
		return (int) $existing->ID;
	}

	$user_id = wp_create_user(
		'blueprint-author',
		wp_generate_password(24, true, true),
		'blueprint-author@example.com'
	);
	if (is_wp_error($user_id)) {
		throw new Exception($user_id->get_error_message());
	}
	return (int) $user_id;
}

/**
 * Resolves a parent post by title for hierarchical post declarations.
 */
function blueprint_find_parent_post_id(string $name, string $post_type): int {
	$parent = get_page_by_path(sanitize_title($name), OBJECT, $post_type);
	if (!$parent) {
		$parent = get_page_by_title($name, OBJECT, $post_type);
	}
	if (!$parent) {
		throw new Exception('Could not resolve post_parent_name: ' . $name);
	}
	return (int) $parent->ID;
}

/**
 * Ensures and assigns taxonomy terms for one imported post.
 */
function blueprint_set_terms(int $post_id, string $taxonomy, array $terms): void {
	$term_ids = blueprint_ensure_terms($taxonomy, $terms);
	if (!empty($term_ids)) {
		$result = wp_set_object_terms($post_id, $term_ids, $taxonomy, false);
		if (is_wp_error($result)) {
			throw new Exception($result->get_error_message());
		}
	}
}

/**
 * Creates missing terms and returns IDs ready for wp_set_post_terms().
 */
function blueprint_ensure_terms(string $taxonomy, array $terms): array {
	$term_ids = array();
	foreach ($terms as $term_name) {
		if (!is_string($term_name) || $term_name === '') {
			continue;
		}
		$term = get_term_by('slug', sanitize_title($term_name), $taxonomy);
		if (!$term) {
			$term = get_term_by('name', $term_name, $taxonomy);
		}
		if (!$term) {
			$created = wp_insert_term($term_name, $taxonomy, array(
				'slug' => sanitize_title($term_name),
			));
			if (is_wp_error($created)) {
				throw new Exception($created->get_error_message());
			}
			$term_ids[] = (int) $created['term_id'];
			continue;
		}
		$term_ids[] = (int) $term->term_id;
	}
	return $term_ids;
}

/**
 * Applies the requested URL-preservation or URL-rewrite policy recursively.
 */
function blueprint_rewrite_urls($value, string $urls_mode, array $urls_map) {
	if ($urls_mode === 'preserve' || empty($urls_map)) {
		return $value;
	}
	if (is_string($value)) {
		return strtr($value, $urls_map);
	}
	if (is_array($value)) {
		foreach ($value as $key => $item) {
			$value[$key] = blueprint_rewrite_urls($item, $urls_mode, $urls_map);
		}
		return $value;
	}
	return $value;
}

/**
 * Removes temporary files used while importing file-backed posts.
 */
function blueprint_cleanup_post_temp_files(array $paths): void {
	foreach (array_unique($paths) as $path) {
		if (is_string($path) && file_exists($path)) {
			@unlink($path);
		}
	}
}
`;

const IMPORT_MEDIA_PHP = `<?php
require '/wordpress/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/image.php';
require_once ABSPATH . 'wp-admin/includes/file.php';

$media_items = json_decode(getenv('BLUEPRINT_MEDIA') ?: '[]', true);
if (!is_array($media_items)) {
	throw new Exception('Invalid Blueprint media payload.');
}

$blueprint_temp_files = array();
foreach ($media_items as $item) {
	if (is_array($item) && !empty($item['path']) && is_string($item['path'])) {
		$blueprint_temp_files[] = $item['path'];
	}
}

try {
	foreach ($media_items as $item) {
		$source_path = $item['path'] ?? '';
		if (!$source_path || !is_readable($source_path)) {
			throw new Exception('Media source is not readable: ' . $source_path);
		}

		$uploads = wp_upload_dir();
		if (!empty($uploads['error'])) {
			throw new Exception($uploads['error']);
		}
		if (!wp_mkdir_p($uploads['path'])) {
			throw new Exception('Could not create uploads directory: ' . $uploads['path']);
		}

		$filename = basename($item['filename'] ?? $source_path);
		if (!is_string($filename) || basename($filename) !== $filename || sanitize_file_name($filename) !== $filename) {
			throw new Exception('Invalid Blueprint media filename: must already be a valid filename.');
		}
		$filename = wp_unique_filename($uploads['path'], $filename);
		$target_path = trailingslashit($uploads['path']) . $filename;
		if (!copy($source_path, $target_path)) {
			throw new Exception('Could not copy media file to uploads directory.');
		}

		$filetype = wp_check_filetype($filename, null);
		$attachment = array(
			'guid' => trailingslashit($uploads['url']) . $filename,
			'post_mime_type' => $filetype['type'] ?: 'application/octet-stream',
			'post_title' => $item['title'] ?? preg_replace('/\\.[^.]+$/', '', $filename),
			'post_content' => $item['description'] ?? '',
			'post_excerpt' => $item['caption'] ?? '',
			'post_status' => 'inherit',
		);

		$attachment_id = wp_insert_attachment($attachment, $target_path, 0, true);
		if (is_wp_error($attachment_id)) {
			throw new Exception($attachment_id->get_error_message());
		}

		$metadata = wp_generate_attachment_metadata($attachment_id, $target_path);
		if (!is_wp_error($metadata) && !empty($metadata)) {
			wp_update_attachment_metadata($attachment_id, $metadata);
		}
		if (array_key_exists('alt', $item)) {
			update_post_meta($attachment_id, '_wp_attachment_image_alt', $item['alt']);
		}
	}
} finally {
	blueprint_cleanup_media_temp_files($blueprint_temp_files);
}

/**
 * Removes temporary files used while importing media attachments.
 */
function blueprint_cleanup_media_temp_files(array $paths): void {
	foreach (array_unique($paths) as $path) {
		if (is_string($path) && file_exists($path)) {
			@unlink($path);
		}
	}
}
`;

const INSTALL_FONTS_PHP = `<?php
require '/wordpress/wp-load.php';

$collections = json_decode(getenv('BLUEPRINT_FONT_COLLECTIONS') ?: '[]', true);
$files = json_decode(getenv('BLUEPRINT_FONT_FILES') ?: '{}', true);

if (!is_array($collections) || !is_array($files)) {
	throw new Exception('Invalid Blueprint fonts payload.');
}
if (!function_exists('wp_get_font_dir') || !post_type_exists('wp_font_family') || !post_type_exists('wp_font_face')) {
	throw new Exception('Blueprint fonts require WordPress 6.5 or newer.');
}

/**
 * Requires a Blueprint slug field to already be a WordPress slug.
 */
function blueprint_require_valid_slug(string $slug, string $field): string {
	if ($slug === '' || sanitize_title($slug) !== $slug) {
		throw new Exception('Invalid Blueprint ' . $field . ': must already be a valid slug.');
	}
	return $slug;
}

$blueprint_temp_files = blueprint_font_temp_files($files);
try {
	$font_dir = wp_get_font_dir();
	if (!empty($font_dir['error'])) {
		throw new Exception($font_dir['error']);
	}
	if (!wp_mkdir_p($font_dir['basedir'])) {
		throw new Exception('Could not create font directory: ' . $font_dir['basedir']);
	}

	$registered_collections = array();
	foreach ($collections as $collection) {
		if (!is_array($collection) || empty($collection['slug']) || !is_string($collection['slug'])) {
			throw new Exception('Each Blueprint font collection must have a slug.');
		}

		$slug = blueprint_require_valid_slug($collection['slug'], 'font collection slug');
		$families = isset($collection['font_families']) && is_array($collection['font_families'])
			? $collection['font_families']
			: array();

		foreach ($families as $family_index => $family) {
			if (!is_array($family) || !isset($family['font_family_settings']) || !is_array($family['font_family_settings'])) {
				throw new Exception('Each Blueprint font family must include font_family_settings.');
			}

			$settings = $family['font_family_settings'];
			$family_id = blueprint_upsert_font_family($settings);
			if (!empty($settings['fontFace']) && is_array($settings['fontFace'])) {
				foreach ($settings['fontFace'] as $face_index => $face) {
					if (!is_array($face)) {
						throw new Exception('Each Blueprint fontFace entry must be an object.');
					}
					$prepared_face = blueprint_prepare_font_face($face, $files, $font_dir);
					blueprint_upsert_font_face($family_id, $prepared_face['settings'], $prepared_face['files']);
					$settings['fontFace'][$face_index] = $prepared_face['settings'];
				}
			}
			$families[$family_index]['font_family_settings'] = $settings;
		}

		$collection_args = array(
			'name' => $collection['name'] ?? blueprint_default_display_name_from_slug($slug),
			'font_families' => $families,
		);
		$categories = blueprint_collect_font_categories($families);
		if (!empty($categories)) {
			$collection_args['categories'] = $categories;
		}
		$registered_collections[$slug] = $collection_args;
		blueprint_register_font_collection($slug, $collection_args);
	}

	blueprint_write_font_collections_mu_plugin($registered_collections);
} finally {
	blueprint_cleanup_font_temp_files($blueprint_temp_files);
}

/**
 * Creates or updates a WordPress font-family post for a font collection.
 */
function blueprint_upsert_font_family(array $settings): int {
	foreach (array('name', 'slug', 'fontFamily') as $field) {
		if (empty($settings[$field]) || !is_string($settings[$field])) {
			throw new Exception('Font family setting "' . $field . '" is required.');
		}
	}

	$slug = blueprint_require_valid_slug($settings['slug'], 'font family slug');
	$post_content = $settings;
	unset($post_content['name'], $post_content['slug']);

	$existing = get_posts(array(
		'post_type' => 'wp_font_family',
		'name' => $slug,
		'post_status' => 'any',
		'numberposts' => 1,
	));
	$post = array(
		'post_type' => 'wp_font_family',
		'post_status' => 'publish',
		'post_title' => $settings['name'],
		'post_name' => $slug,
		'post_content' => wp_json_encode($post_content),
	);
	if (!empty($existing)) {
		$post['ID'] = $existing[0]->ID;
	}

	$post_id = wp_insert_post(wp_slash($post), true);
	if (is_wp_error($post_id)) {
		throw new Exception($post_id->get_error_message());
	}
	return (int) $post_id;
}

/**
 * Converts Blueprint font-face settings into WordPress font-library fields.
 */
function blueprint_prepare_font_face(array $settings, array $files, array $font_dir): array {
	if (empty($settings['fontFamily']) || empty($settings['src'])) {
		throw new Exception('Font face settings require fontFamily and src.');
	}

	$srcs = is_array($settings['src']) ? $settings['src'] : array($settings['src']);
	$processed_srcs = array();
	$file_meta = array();

	foreach ($srcs as $src) {
		if (is_string($src) && isset($files[$src])) {
			$copied = blueprint_copy_font_file($files[$src], $font_dir);
			$processed_srcs[] = $copied['url'];
			$file_meta[] = $copied['relative'];
			continue;
		}
		$processed_srcs[] = $src;
	}

	$settings['src'] = count($processed_srcs) === 1 ? $processed_srcs[0] : $processed_srcs;
	return array(
		'settings' => $settings,
		'files' => $file_meta,
	);
}

/**
 * Copies one materialized font binary into the WordPress uploads directory.
 */
function blueprint_copy_font_file(array $file, array $font_dir): array {
	$source_path = $file['path'] ?? '';
	if (!$source_path || !is_readable($source_path)) {
		throw new Exception('Font source is not readable: ' . $source_path);
	}

	$filename = $file['filename'] ?? basename($source_path);
	if (!is_string($filename) || basename($filename) !== $filename || sanitize_file_name($filename) !== $filename) {
		throw new Exception('Invalid Blueprint font filename: must already be a valid filename.');
	}
	if (!preg_match('/\\.(woff2|woff|ttf|otf)$/i', $filename)) {
		throw new Exception('Unsupported font file extension: ' . $filename);
	}

	$unique_filename = wp_unique_filename($font_dir['basedir'], $filename);
	$target_path = trailingslashit($font_dir['basedir']) . $unique_filename;
	if (!copy($source_path, $target_path)) {
		throw new Exception('Could not copy font file to fonts directory.');
	}

	return array(
		'url' => trailingslashit($font_dir['baseurl']) . $unique_filename,
		'relative' => $unique_filename,
	);
}

/**
 * Creates or updates a font-face post belonging to a font family.
 */
function blueprint_upsert_font_face(int $family_id, array $settings, array $file_meta): int {
	$title = blueprint_font_face_slug($settings);
	$existing = get_posts(array(
		'post_type' => 'wp_font_face',
		'post_parent' => $family_id,
		'title' => $title,
		'post_status' => 'any',
		'numberposts' => 1,
	));

	$post = array(
		'post_type' => 'wp_font_face',
		'post_parent' => $family_id,
		'post_status' => 'publish',
		'post_title' => $title,
		'post_name' => sanitize_title($title),
		'post_content' => wp_json_encode($settings),
	);
	if (!empty($existing)) {
		$post['ID'] = $existing[0]->ID;
	}

	$post_id = wp_insert_post(wp_slash($post), true);
	if (is_wp_error($post_id)) {
		throw new Exception($post_id->get_error_message());
	}

	delete_post_meta($post_id, '_wp_font_face_file');
	foreach ($file_meta as $relative_path) {
		add_post_meta($post_id, '_wp_font_face_file', $relative_path);
	}
	return (int) $post_id;
}

/**
 * Builds the stable slug used to find an existing font-face post.
 */
function blueprint_font_face_slug(array $settings): string {
	if (class_exists('WP_Font_Utils') && method_exists('WP_Font_Utils', 'get_font_face_slug')) {
		return WP_Font_Utils::get_font_face_slug($settings);
	}
	$parts = array($settings['fontFamily'] ?? 'font');
	foreach (array('fontStyle', 'fontWeight', 'fontStretch') as $field) {
		if (!empty($settings[$field])) {
			$parts[] = (string) $settings[$field];
		}
	}
	return implode('-', $parts);
}

/**
 * Collects category slugs declared by all families in a collection.
 */
function blueprint_collect_font_categories(array $families): array {
	$categories = array();
	foreach ($families as $family) {
		foreach (($family['categories'] ?? array()) as $category) {
			if (!is_string($category) || $category === '') {
				continue;
			}
			$slug = blueprint_require_valid_slug($category, 'font category slug');
			$categories[$slug] = array(
				'name' => blueprint_default_display_name_from_slug($slug),
				'slug' => $slug,
			);
		}
	}
	return array_values($categories);
}

/**
 * Registers collection metadata after font posts have been imported.
 */
function blueprint_register_font_collection(string $slug, array $collection_args): void {
	if (!function_exists('wp_register_font_collection') || !class_exists('WP_Font_Library')) {
		return;
	}
	$library = WP_Font_Library::get_instance();
	if ($library->get_font_collection($slug) && function_exists('wp_unregister_font_collection')) {
		wp_unregister_font_collection($slug);
	}
	$result = wp_register_font_collection($slug, $collection_args);
	if (is_wp_error($result)) {
		throw new Exception($result->get_error_message());
	}
}

/**
 * Persists imported font collections so they are registered on every boot.
 */
function blueprint_write_font_collections_mu_plugin(array $collections): void {
	if (empty($collections)) {
		return;
	}
	$dir = WP_CONTENT_DIR . '/mu-plugins';
	if (!wp_mkdir_p($dir)) {
		throw new Exception('Could not create mu-plugins directory for font collections.');
	}
	$code = "<?php\\nadd_action('init', function () {\\n" .
		"\\tif (!function_exists('wp_register_font_collection') || !class_exists('WP_Font_Library')) {\\n\\t\\treturn;\\n\\t}\\n" .
		"\\t\\$collections = " . var_export($collections, true) . ";\\n" .
		"\\t\\$library = WP_Font_Library::get_instance();\\n" .
		"\\tforeach (\\$collections as \\$slug => \\$args) {\\n" .
		"\\t\\tif (\\$library->get_font_collection(\\$slug) && function_exists('wp_unregister_font_collection')) {\\n\\t\\t\\twp_unregister_font_collection(\\$slug);\\n\\t\\t}\\n" .
		"\\t\\twp_register_font_collection(\\$slug, \\$args);\\n" .
		"\\t}\\n" .
		"}, 0);\\n";
	file_put_contents($dir . '/blueprint-font-collections.php', $code);
}

/**
 * Converts a slug into the fallback label used by generated font settings.
 */
function blueprint_default_display_name_from_slug(string $slug): string {
	return ucwords(str_replace(array('-', '_'), ' ', $slug));
}

/**
 * Extracts temp paths from the materialized font-file map for cleanup.
 */
function blueprint_font_temp_files(array $files): array {
	$paths = array();
	foreach ($files as $file) {
		if (is_array($file) && !empty($file['path']) && is_string($file['path'])) {
			$paths[] = $file['path'];
		}
	}
	return $paths;
}

/**
 * Removes temporary files used while importing fonts.
 */
function blueprint_cleanup_font_temp_files(array $paths): void {
	foreach (array_unique($paths) as $path) {
		if (is_string($path) && file_exists($path)) {
			@unlink($path);
		}
	}
}
`;

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
 * Returns WordPress data references that cannot use the existing version/URL
 * download path and therefore need the Blueprint resource loader.
 */
function getCustomWordPressDataReference(
	wordpressVersion: BlueprintV2Declaration['wordpressVersion']
): BlueprintV2DataReference | undefined {
	if (
		typeof wordpressVersion === 'string' &&
		isExecutionContextPath(wordpressVersion)
	) {
		return wordpressVersion;
	}
	if (
		isInlineFile(wordpressVersion) ||
		isInlineDirectory(wordpressVersion) ||
		isGitPath(wordpressVersion)
	) {
		return wordpressVersion;
	}
	return undefined;
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
	context: 'plugin' | 'theme' | 'wordpress'
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
		if (context === 'wordpress') {
			throw new UnsupportedBlueprintV2FeatureError(
				'wordpressVersion',
				'Unsupported Blueprint v2 WordPress data reference.'
			);
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

function convertV2FileDataReferenceToV1(
	reference: BlueprintV2FileDataReference,
	featurePath: string
): FileReference {
	if (typeof reference === 'string') {
		if (isHttpUrl(reference)) {
			return { resource: 'url', url: reference };
		}
		if (isTargetSitePath(reference)) {
			return {
				resource: 'vfs',
				path: toPlaygroundPath(reference, featurePath),
			};
		}
		if (isExecutionContextPath(reference)) {
			return {
				resource: 'bundled',
				path: normalizeExecutionContextPath(reference),
			};
		}
		throw new UnsupportedBlueprintV2FeatureError(
			featurePath,
			'Blueprint v2 file references must be URLs, execution-context paths, or target-site paths.'
		);
	}

	if (isInlineFile(reference)) {
		return {
			resource: 'literal',
			name: reference.filename,
			contents: reference.content,
		};
	}

	throw new UnsupportedBlueprintV2FeatureError(
		featurePath,
		'Unsupported Blueprint v2 file reference.'
	);
}

function convertV2WritableDataReferenceToV1(
	reference: BlueprintV2DataReference,
	featurePath: string
): FileReference | DirectoryReference {
	if (typeof reference === 'string') {
		if (isHttpUrl(reference)) {
			return { resource: 'url', url: reference };
		}
		if (isExecutionContextPath(reference)) {
			return {
				resource: 'bundled',
				path: normalizeExecutionContextPath(reference),
			};
		}
		throw new UnsupportedBlueprintV2FeatureError(
			featurePath,
			'Blueprint v2 writable data references must be URLs or execution-context paths.'
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
		featurePath,
		'Unsupported Blueprint v2 writable data reference.'
	);
}

function isDirectoryReference(
	resource: FileReference | DirectoryReference
): resource is DirectoryReference {
	return (
		resource.resource === 'literal:directory' ||
		resource.resource === 'git:directory'
	);
}

/**
 * Computes the mu-plugin installation path from structured data-reference
 * fields without rewriting explicit inline filenames or directory names.
 */
function getMuPluginTargetPath(
	reference: BlueprintV2DataReference,
	featurePath: string
) {
	const muPluginsPath = '/wordpress/wp-content/mu-plugins';
	if (isInlineFile(reference)) {
		return joinPaths(muPluginsPath, reference.filename);
	}
	if (isInlineDirectory(reference)) {
		return joinPaths(muPluginsPath, reference.directoryName);
	}
	if (isGitPath(reference)) {
		return joinPaths(
			muPluginsPath,
			gitPathBasename(reference, featurePath)
		);
	}
	if (typeof reference === 'string') {
		return joinPaths(
			muPluginsPath,
			fileReferenceBasename(reference, featurePath)
		);
	}
	throw new UnsupportedBlueprintV2FeatureError(
		featurePath,
		'Unsupported Blueprint v2 mu-plugin data reference.'
	);
}

/**
 * Distinguishes file references from inline JSON objects in union fields such
 * as posts and media declarations.
 */
function isV2FileDataReferenceLike(
	value: any
): value is BlueprintV2FileDataReference {
	return typeof value === 'string' || isInlineFile(value);
}

/**
 * Allocates a compiler-owned temp path for generated support files.
 *
 * The path intentionally does not include Blueprint-provided names.
 */
function nextTempFilePath(
	context: BlueprintV2LoweringContext,
	prefix: string,
	extension?: string
) {
	const suffix = extension ? `.${extension}` : '';
	return `/tmp/${prefix}-${context.nextTempFileIndex++}${suffix}`;
}

/**
 * Extracts the user-facing filename from supported file-reference shapes.
 *
 * This is used for WordPress metadata such as media and font filenames, not
 * for compiler temporary paths.
 */
function fileReferenceBasename(
	reference: BlueprintV2FileDataReference,
	featurePath: string
) {
	if (typeof reference === 'string') {
		if (isHttpUrl(reference)) {
			return basename(new URL(reference).pathname);
		}
		if (isExecutionContextPath(reference)) {
			return basename(normalizeExecutionContextPath(reference));
		}
		if (isTargetSitePath(reference)) {
			return basename(toPlaygroundPath(reference, featurePath));
		}
	}
	if (isInlineFile(reference)) {
		return reference.filename;
	}
	throw new UnsupportedBlueprintV2FeatureError(
		featurePath,
		'Blueprint v2 file references must be URLs, execution-context paths, ' +
			'target-site paths, or inline files.'
	);
}

/**
 * Gets the target name for a git data reference from its structured repository
 * path, or from the repository URL when no path is provided.
 */
function gitPathBasename(
	reference: Extract<BlueprintV2DataReference, { gitRepository: string }>,
	featurePath: string
) {
	const pathInRepository = reference.pathInRepository || reference.path;
	if (pathInRepository) {
		if (pathContainsParentDirectorySegment(pathInRepository)) {
			throw new UnsupportedBlueprintV2FeatureError(
				`${featurePath}.pathInRepository`,
				'Blueprint v2 git paths must not contain parent directory segments.'
			);
		}
		return basename(pathInRepository);
	}
	return basename(new URL(reference.gitRepository).pathname);
}

/**
 * Converts a machine slug into a fallback display name for generated
 * WordPress records.
 */
function defaultDisplayNameFromSlug(slug: string) {
	return slug
		.replace(/[-_]+/g, ' ')
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * Clones JSON-compatible Blueprint data before adding compiler defaults.
 */
function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

function asArray<T>(value: T | T[]): T[] {
	return Array.isArray(value) ? value : [value];
}

/**
 * Converts a v2 target-site path into the absolute WordPress VFS path that v1
 * file steps expect.
 *
 * V2 paths in imperative file steps are site-relative (`site:...`) or plain
 * relative paths. Paths that resolve outside the WordPress root are rejected.
 */
function toPlaygroundPath(path: string, featurePath = 'path'): string {
	if (typeof path !== 'string' || path.trim() === '') {
		throw new UnsupportedBlueprintV2FeatureError(
			featurePath,
			'Invalid Blueprint v2 path: must not be empty.'
		);
	}

	const hasTargetSitePrefix = path.startsWith('site:');
	const pathWithinSite = hasTargetSitePrefix
		? path.slice('site:'.length)
		: path;
	if (!hasTargetSitePrefix && pathWithinSite === '/wordpress') {
		return '/wordpress';
	}
	const candidatePath =
		!hasTargetSitePrefix && pathWithinSite.startsWith('/wordpress/')
			? pathWithinSite
			: joinPaths('/wordpress', pathWithinSite);
	const resolvedPath = resolvePathUnder(candidatePath, '/wordpress');
	if (!resolvedPath) {
		throw new UnsupportedBlueprintV2FeatureError(
			featurePath,
			`Invalid Blueprint v2 path "${path}": must stay within the target WordPress root.`
		);
	}
	return resolvedPath;
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

/** Checks whether a file reference names the mutable target-site filesystem. */
function isTargetSitePath(value: string) {
	return value.startsWith('site:');
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
