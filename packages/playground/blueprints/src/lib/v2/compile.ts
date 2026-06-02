import type { AllPHPVersion, UniversalPHP } from '@php-wasm/universal';
import { AllPHPVersions, LatestSupportedPHPVersion } from '@php-wasm/universal';
import {
	basename as pathBasename,
	isGitRepoUrl,
	joinPaths,
} from '@php-wasm/util';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	compileBlueprintV1,
	getBlueprintDeclaration as getBlueprintV1Declaration,
	type CompileBlueprintV1Options,
	type CompiledBlueprintV1,
	type OnStepCompleted,
} from '../v1/compile';
import type {
	BlueprintV1Declaration,
	PHPConstants,
	StreamBundledFile,
} from '../v1/types';
import {
	Resource,
	type DirectoryReference,
	type FileReference,
} from '../v1/resources';
import type { BlueprintBundle, RuntimeConfiguration } from '../types';
import type {
	BlueprintV2,
	BlueprintV2Declaration,
	RawBlueprintV2Data,
} from './blueprint-v2-declaration';

type JsonObject = Record<string, any>;
export type V2Step = JsonObject & { step: string };
type V2DataReference =
	| string
	| {
			filename: string;
			content: string;
	  }
	| {
			directoryName: string;
			files: Record<string, string | V2InlineDirectory>;
	  }
	| {
			gitRepository: string;
			ref?: string;
			pathInRepository?: string;
			path?: string;
	  };
type V2InlineDirectory = {
	files: Record<string, string | V2InlineDirectory>;
};
type UpgradedV1RuntimeConfiguration = Partial<
	Pick<RuntimeConfiguration, 'extraLibraries' | 'intl'>
>;

// V1 migrations carry compatibility-only metadata that must not become public
// Blueprint v2 JSON. Any clone of a migrated declaration must copy these
// symbols before validation/lowering so v1 runtime flags and absolute paths
// keep their original behavior.
const upgradedV1RuntimeConfiguration = Symbol('upgradedV1RuntimeConfiguration');
const upgradedV1Declaration = Symbol('upgradedV1Declaration');

export type BlueprintV2ValidationError = {
	path: string;
	message: string;
};

export type BlueprintV2ValidationResult =
	| { valid: true }
	| { valid: false; errors: BlueprintV2ValidationError[] };

export class InvalidBlueprintV2Error extends Error {
	public readonly validationErrors?: BlueprintV2ValidationError[];

	constructor(
		message: string,
		validationErrors?: BlueprintV2ValidationError[]
	) {
		super(message);
		this.name = 'InvalidBlueprintV2Error';
		this.validationErrors = validationErrors;
	}
}

export class UnsupportedBlueprintV2FeatureError extends Error {
	public readonly featurePath: string;

	constructor(featurePath: string, message: string) {
		super(`${featurePath}: ${message}`);
		this.name = 'UnsupportedBlueprintV2FeatureError';
		this.featurePath = featurePath;
	}
}

export interface CompileBlueprintV2Options extends Omit<
	CompileBlueprintV1Options,
	'streamBundledFile' | 'onBlueprintValidated' | 'additionalSteps'
> {
	streamBundledFile?: StreamBundledFile;
	onBlueprintValidated?: (blueprint: BlueprintV2Declaration) => void;
	additionalSteps?: V2Step[];
}

export interface CompiledBlueprintV2 extends CompiledBlueprintV1 {
	declaration: BlueprintV2Declaration;
	run: (playground: UniversalPHP) => Promise<void>;
}

export async function compileBlueprintV2(
	input:
		| BlueprintV2
		| BlueprintV1Declaration
		| BlueprintBundle
		| RawBlueprintV2Data,
	options: CompileBlueprintV2Options = {}
): Promise<CompiledBlueprintV2> {
	const finalOptions: CompileBlueprintV2Options = {
		...options,
	};
	if (isBlueprintBundle(input)) {
		finalOptions.streamBundledFile = function (...args: [any]) {
			return input.read(...args);
		};
	}

	let declaration = await getBlueprintV2Declaration(input);
	if (!declaration || typeof declaration !== 'object') {
		throw new InvalidBlueprintV2Error(
			'Invalid Blueprint v2: expected a JSON object.'
		);
	}

	if ((declaration as any).version === undefined) {
		declaration = upgradeBlueprintV1ToV2(
			declaration as BlueprintV1Declaration
		);
	}
	if (finalOptions.additionalSteps?.length) {
		declaration = appendAdditionalV2Steps(
			declaration as BlueprintV2Declaration,
			finalOptions.additionalSteps
		);
	}

	assertValidBlueprintV2Declaration(declaration as BlueprintV2Declaration);

	const blueprint = declaration as BlueprintV2Declaration;
	const v1Blueprint = blueprintV2ToBlueprintV1(blueprint);
	const v1Options = {
		...finalOptions,
	} as unknown as CompileBlueprintV1Options;
	delete (v1Options as CompileBlueprintV2Options).additionalSteps;
	delete (v1Options as CompileBlueprintV2Options).onBlueprintValidated;
	const compiled = await compileBlueprintV1(v1Blueprint, {
		...v1Options,
		onBlueprintValidated: () => {},
	});

	finalOptions.onBlueprintValidated?.(blueprint);

	return {
		...compiled,
		declaration: blueprint,
	};
}

export async function runBlueprintV2Steps(
	compiledBlueprint: CompiledBlueprintV2,
	playground: UniversalPHP
) {
	await compiledBlueprint.run(playground);
}

export async function getBlueprintV2Declaration(
	blueprint:
		| BlueprintV2
		| BlueprintV1Declaration
		| BlueprintBundle
		| RawBlueprintV2Data
): Promise<BlueprintV2Declaration | BlueprintV1Declaration> {
	if (typeof blueprint === 'string') {
		return JSON.parse(blueprint);
	}
	if (blueprint && typeof blueprint === 'object' && 'read' in blueprint) {
		return getBlueprintV1Declaration(blueprint as BlueprintBundle) as any;
	}
	return blueprint as BlueprintV2Declaration | BlueprintV1Declaration;
}

function appendAdditionalV2Steps(
	blueprint: BlueprintV2Declaration,
	additionalSteps: V2Step[]
): BlueprintV2Declaration {
	const nextBlueprint = {
		...(blueprint as JsonObject),
		additionalStepsAfterExecution: [
			...((blueprint as JsonObject)['additionalStepsAfterExecution'] ||
				[]),
			...additionalSteps,
		],
	} as BlueprintV2Declaration;
	copyUpgradedV1Metadata(blueprint, nextBlueprint);
	return nextBlueprint;
}

function isBlueprintBundle(input: any): input is BlueprintBundle {
	return input && 'read' in input && typeof input.read === 'function';
}

export function validateBlueprintV2(
	blueprintMaybe: object
): BlueprintV2ValidationResult {
	const blueprint = blueprintMaybe as JsonObject;
	const errors: BlueprintV2ValidationError[] = [];
	const allowV1AbsolutePaths = isUpgradedV1Declaration(blueprintMaybe);
	if (
		!blueprint ||
		typeof blueprint !== 'object' ||
		Array.isArray(blueprint)
	) {
		return {
			valid: false,
			errors: [{ path: '/', message: 'must be an object' }],
		};
	}

	if (blueprint['version'] !== 2) {
		errors.push({
			path: '/version',
			message: 'must be exactly 2',
		});
	}

	for (const key of Object.keys(blueprint)) {
		if (!V2_TOP_LEVEL_KEYS.has(key)) {
			errors.push({
				path: '/',
				message: `has unexpected property "${key}"`,
			});
			continue;
		}
		validateV2TopLevelField(key, blueprint[key], errors);
	}

	const additionalSteps = Array.isArray(
		blueprint['additionalStepsAfterExecution']
	)
		? blueprint['additionalStepsAfterExecution']
		: [];
	for (const [index, step] of additionalSteps.entries()) {
		validateV2Step(
			step,
			`/additionalStepsAfterExecution/${index}`,
			errors,
			allowV1AbsolutePaths
		);
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}
	return { valid: true };
}

export function resolveBlueprintV2RuntimeConfiguration(
	blueprint: BlueprintV2Declaration
): RuntimeConfiguration {
	const playgroundOptions = getPlaygroundApplicationOptions(blueprint);
	const v1RuntimeConfiguration = getUpgradedV1RuntimeConfiguration(blueprint);
	const extraLibraries = new Set(
		v1RuntimeConfiguration?.extraLibraries || []
	);
	if (blueprintRequiresWpCli(blueprint)) {
		extraLibraries.add('wp-cli');
	}
	return {
		phpVersion: resolveV2PHPVersion(blueprint.phpVersion),
		wpVersion: resolveV2WordPressVersion(blueprint.wordpressVersion),
		intl: v1RuntimeConfiguration?.intl ?? false,
		networking: playgroundOptions?.networkAccess ?? false,
		extraLibraries: [...extraLibraries],
		constants: blueprint.constants || {},
	};
}

export interface ResolvedBlueprintV2WordPressSource {
	wpVersion: string;
	wordPressZip?: File;
}

export async function hasBlueprintV2WordPressZipReference(
	input:
		| BlueprintV2
		| BlueprintV1Declaration
		| BlueprintBundle
		| RawBlueprintV2Data
): Promise<boolean> {
	let declaration = await getBlueprintV2Declaration(input);
	if ((declaration as any).version === undefined) {
		declaration = upgradeBlueprintV1ToV2(
			declaration as BlueprintV1Declaration
		);
	}
	assertValidBlueprintV2Declaration(declaration as BlueprintV2Declaration);
	return !!getWordPressZipDataReference(
		(declaration as BlueprintV2Declaration).wordpressVersion
	);
}

export async function resolveBlueprintV2WordPressSource(
	input:
		| BlueprintV2
		| BlueprintV1Declaration
		| BlueprintBundle
		| RawBlueprintV2Data,
	options: Pick<
		CompileBlueprintV2Options,
		| 'corsProxy'
		| 'gitAdditionalHeadersCallback'
		| 'progress'
		| 'semaphore'
		| 'streamBundledFile'
	> = {}
): Promise<ResolvedBlueprintV2WordPressSource> {
	const finalOptions = { ...options };
	if (isBlueprintBundle(input)) {
		finalOptions.streamBundledFile = function (...args: [any]) {
			return input.read(...args);
		};
	}

	let declaration = await getBlueprintV2Declaration(input);
	if ((declaration as any).version === undefined) {
		declaration = upgradeBlueprintV1ToV2(
			declaration as BlueprintV1Declaration
		);
	}
	assertValidBlueprintV2Declaration(declaration as BlueprintV2Declaration);

	const blueprint = declaration as BlueprintV2Declaration;
	const wpVersion = resolveV2WordPressVersion(blueprint.wordpressVersion);
	const source = getWordPressZipDataReference(blueprint.wordpressVersion);
	if (!source) {
		return { wpVersion };
	}

	const resourceReference = convertV2DataReferenceToV1(source);
	const resource = Resource.create(
		isV1DirectoryReference(resourceReference)
			? {
					resource: 'zip',
					inner: resourceReference,
					name: `${customWordPressVersionLabel(source)}.zip`,
				}
			: resourceReference,
		finalOptions
	);
	const wordPressZip = (await resource.resolve()) as File;
	return { wpVersion, wordPressZip };
}

export function upgradeBlueprintV1ToV2(
	v1: BlueprintV1Declaration
): BlueprintV2Declaration {
	const v2: JsonObject = {
		version: 2,
	};
	const steps: V2Step[] = [];

	if (v1.preferredVersions?.wp === false) {
		assertV1BlueprintWithoutWordPressCanUpgrade(v1);
	}

	if ((v1 as any)['$schema']) {
		v2['$schema'] = (v1 as any)['$schema'];
	}
	if (v1.meta) {
		v2['blueprintMeta'] = {
			...(v1.meta.title ? { name: v1.meta.title } : {}),
			...(v1.meta.description
				? { description: v1.meta.description }
				: {}),
			...(v1.meta.categories ? { tags: v1.meta.categories } : {}),
			...(v1.meta.author ? { authors: [v1.meta.author] } : {}),
		};
	}
	if (v1.preferredVersions?.wp && v1.preferredVersions.wp !== 'latest') {
		v2['wordpressVersion'] = v1.preferredVersions.wp;
	}
	if (v1.preferredVersions?.php && v1.preferredVersions.php !== 'latest') {
		v2['phpVersion'] = ['7.2', '7.3'].includes(v1.preferredVersions.php)
			? '7.4'
			: v1.preferredVersions.php;
	}

	const applicationOptions: JsonObject = {};
	if (v1.landingPage) {
		applicationOptions['landingPage'] = v1.landingPage;
	}
	if (v1.login !== undefined) {
		applicationOptions['login'] = v1.login;
	}
	applicationOptions['networkAccess'] = v1.features?.networking ?? true;
	if (Object.keys(applicationOptions).length > 0) {
		v2['applicationOptions'] = {
			'wordpress-playground': applicationOptions,
		};
	}

	if (v1.constants) {
		v2['constants'] = v1.constants;
	}
	if (v1.siteOptions) {
		v2['siteOptions'] = v1.siteOptions;
	}
	if (v1.plugins) {
		v2['plugins'] = v1.plugins.map(convertV1ResourceToV2Reference);
	}

	for (const stepMaybe of v1.steps || []) {
		if (!stepMaybe || typeof stepMaybe !== 'object') {
			continue;
		}
		const step = stepMaybe as JsonObject;
		if (step['step'] === 'login') {
			steps.push(...migrateV1LoginStepToV2(step));
			continue;
		}
		const migrated = migrateV1StepToV2(step);
		if (migrated) {
			steps.push(...migrated);
		}
	}

	if (steps.length > 0) {
		v2['additionalStepsAfterExecution'] = steps;
	}

	const runtimeConfiguration: UpgradedV1RuntimeConfiguration = {};
	if (v1.features?.intl !== undefined) {
		runtimeConfiguration.intl = v1.features.intl;
	}
	if (v1.extraLibraries?.length) {
		runtimeConfiguration.extraLibraries = [...v1.extraLibraries];
	}

	const upgraded = v2 as BlueprintV2Declaration;
	Object.defineProperty(upgraded, upgradedV1Declaration, {
		value: true,
		enumerable: false,
	});
	if (Object.keys(runtimeConfiguration).length > 0) {
		Object.defineProperty(upgraded, upgradedV1RuntimeConfiguration, {
			value: runtimeConfiguration,
			enumerable: false,
		});
	}

	return upgraded;
}

export function blueprintV2ToBlueprintV1(
	blueprint: BlueprintV2Declaration
): BlueprintV1Declaration {
	const v1Steps: any[] = createBlueprintV2ExecutionPlan(blueprint);
	const runtime = resolveBlueprintV2RuntimeConfiguration(blueprint);
	const applicationOptions = getPlaygroundApplicationOptions(blueprint);
	const v1: BlueprintV1Declaration = {
		preferredVersions: {
			php: runtime.phpVersion,
			wp: runtime.wpVersion,
		},
		features: {
			networking: runtime.networking,
			intl: runtime.intl,
		},
		constants: undefined,
		extraLibraries: runtime.extraLibraries,
		steps: v1Steps,
	};

	if (applicationOptions?.landingPage) {
		v1.landingPage = applicationOptions.landingPage;
	}
	if (applicationOptions?.login) {
		v1.login = applicationOptions.login;
	}

	return v1;
}

export function createBlueprintV2ExecutionPlan(
	blueprint: BlueprintV2Declaration
): any[] {
	const steps: any[] = [];
	const source = blueprint as JsonObject;
	const allowV1AbsolutePaths = isUpgradedV1Declaration(blueprint);

	if (source['constants']) {
		steps.push({
			step: 'defineWpConfigConsts',
			consts: source['constants'],
		});
	}

	const siteOptions = { ...(source['siteOptions'] || {}) };
	delete siteOptions['siteUrl'];
	if (Object.keys(siteOptions).length > 0) {
		steps.push({
			step: 'setSiteOptions',
			options: siteOptions,
		});
	}

	if (Array.isArray(source['muPlugins'])) {
		source['muPlugins'].forEach(
			(muPlugin: V2DataReference, index: number) => {
				steps.push(
					...createWriteStepsFromV2Files(
						{
							[getMuPluginTargetPath(muPlugin, index)]: muPlugin,
						},
						`/muPlugins/${index}`
					)
				);
			}
		);
	}

	if (Array.isArray(source['themes'])) {
		for (const theme of source['themes']) {
			steps.push(createInstallThemeStep(theme, false));
		}
	}

	if (source['activeTheme'] !== undefined) {
		steps.push(createInstallThemeStep(source['activeTheme'], true));
	}

	if (Array.isArray(source['plugins'])) {
		for (const plugin of source['plugins']) {
			steps.push(createInstallPluginStep(plugin));
		}
	}

	if (source['fonts']) {
		steps.push(...createFontSteps(source['fonts']));
	}

	if (Array.isArray(source['media']) && source['media'].length > 0) {
		steps.push(...createImportMediaSteps(source['media'], '/media'));
	}

	if (source['siteLanguage']) {
		steps.push({
			step: 'setSiteLanguage',
			language: source['siteLanguage'],
		});
	}

	if (Array.isArray(source['roles']) && source['roles'].length > 0) {
		steps.push(createRolesStep(source['roles']));
	}

	if (Array.isArray(source['users']) && source['users'].length > 0) {
		steps.push(createUsersStep(source['users']));
	}

	if (source['postTypes']) {
		steps.push(...createPostTypeSteps(source['postTypes']));
	}

	if (Array.isArray(source['content'])) {
		steps.push(...createImportContentSteps(source['content'], '/content'));
	}

	for (const [index, step] of (
		source['additionalStepsAfterExecution'] || []
	).entries()) {
		steps.push(
			...convertV2StepToV1Steps(
				step,
				`/additionalStepsAfterExecution/${index}`,
				allowV1AbsolutePaths
			)
		);
	}

	return steps;
}

function convertV2StepToV1Steps(
	step: V2Step,
	path = '/additionalStepsAfterExecution',
	allowV1AbsolutePaths = false
): any[] {
	switch (step['step']) {
		case 'activatePlugin':
			return [
				{
					step: 'activatePlugin',
					pluginPath: step['pluginPath'],
					pluginName: step['humanReadableName'],
				},
			];
		case 'activateTheme':
			return [
				{
					step: 'activateTheme',
					themeFolderName: step['themeDirectoryName'],
				},
			];
		case 'cp':
			return [
				{
					step: 'cp',
					fromPath: toPlaygroundPath(
						step['fromPath'],
						allowV1AbsolutePaths
					),
					toPath: toPlaygroundPath(
						step['toPath'],
						allowV1AbsolutePaths
					),
				},
			];
		case 'defineConstants':
			return [
				{
					step: 'defineWpConfigConsts',
					consts: step['constants'],
				},
			];
		case 'enableMultisite':
			return [{ step: 'enableMultisite' }];
		case 'importContent':
			return createImportContentSteps(
				step['content'] || [],
				`${path}/content`
			);
		case 'importMedia':
			return createImportMediaSteps(step['media'] || [], `${path}/media`);
		case 'importThemeStarterContent':
			return [
				{
					step: 'importThemeStarterContent',
					themeSlug: step['themeSlug'],
				},
			];
		case 'installPlugin':
			return [createInstallPluginStep(step)];
		case 'installTheme':
			return [createInstallThemeStep(step, step['active'] ?? true)];
		case 'mkdir':
			return [
				{
					step: 'mkdir',
					path: toPlaygroundPath(step['path'], allowV1AbsolutePaths),
				},
			];
		case 'mv':
			return [
				{
					step: 'mv',
					fromPath: toPlaygroundPath(
						step['fromPath'],
						allowV1AbsolutePaths
					),
					toPath: toPlaygroundPath(
						step['toPath'],
						allowV1AbsolutePaths
					),
				},
			];
		case 'rm':
			return [
				{
					step: 'rm',
					path: toPlaygroundPath(step['path'], allowV1AbsolutePaths),
				},
			];
		case 'rmdir':
			return [
				{
					step: 'rmdir',
					path: toPlaygroundPath(step['path'], allowV1AbsolutePaths),
				},
			];
		case 'runPHP':
			return createRunPHPSteps(step, `${path}/code`);
		case 'runSQL':
			return [
				{
					step: 'runSql',
					sql: convertV2FileDataReferenceToV1(
						step['source'],
						`${path}/source`,
						'runSQL.source'
					),
				},
			];
		case 'setSiteLanguage':
			return [
				{
					step: 'setSiteLanguage',
					language: step['language'],
				},
			];
		case 'setSiteOptions':
			return [
				{
					step: 'setSiteOptions',
					options: step['options'],
				},
			];
		case 'unzip':
			return [
				{
					step: 'unzip',
					zipFile: convertV2FileDataReferenceToV1(
						step['zipFile'],
						`${path}/zipFile`,
						'unzip.zipFile'
					),
					extractToPath: toPlaygroundPath(
						step['extractToPath'],
						allowV1AbsolutePaths
					),
				},
			];
		case 'wp-cli':
			return [
				{
					step: 'wp-cli',
					command: step['command'],
					wpCliPath: step['wpCliPath'],
				},
			];
		case 'writeFiles':
			return createWriteStepsFromV2Files(
				step['files'] || {},
				'',
				allowV1AbsolutePaths
			);
		default:
			assertNeverStep(step.step);
	}
}

function createInstallPluginStep(plugin: any): any {
	const definition =
		typeof plugin === 'object' &&
		!isInlineFile(plugin) &&
		!isInlineDirectory(plugin) &&
		!isGitPath(plugin)
			? plugin
			: { source: plugin };

	return {
		step: 'installPlugin',
		pluginData: convertV2DataReferenceToV1(definition['source'], 'plugin'),
		...(definition['ifAlreadyInstalled']
			? { ifAlreadyInstalled: definition['ifAlreadyInstalled'] }
			: {}),
		options: {
			activate: definition['active'] ?? true,
			...(definition['activationOptions']
				? { activationOptions: definition['activationOptions'] }
				: {}),
			...(definition['onError']
				? { onError: definition['onError'] }
				: {}),
			...(definition['targetDirectoryName']
				? { targetFolderName: definition['targetDirectoryName'] }
				: {}),
			...(definition['humanReadableName']
				? { humanReadableName: definition['humanReadableName'] }
				: {}),
		},
	};
}

function createInstallThemeStep(theme: any, active: boolean): any {
	const definition =
		typeof theme === 'object' &&
		!isInlineFile(theme) &&
		!isInlineDirectory(theme) &&
		!isGitPath(theme)
			? theme
			: { source: theme };

	return {
		step: 'installTheme',
		themeData: convertV2DataReferenceToV1(definition['source'], 'theme'),
		...(definition['ifAlreadyInstalled']
			? { ifAlreadyInstalled: definition['ifAlreadyInstalled'] }
			: {}),
		options: {
			activate: active,
			importStarterContent: definition['importStarterContent'] ?? false,
			...(definition['targetDirectoryName']
				? { targetFolderName: definition['targetDirectoryName'] }
				: {}),
			...(definition['onError']
				? { onError: definition['onError'] }
				: {}),
			...(definition['humanReadableName']
				? { humanReadableName: definition['humanReadableName'] }
				: {}),
		},
	};
}

function createRunPHPSteps(step: JsonObject, codePath: string) {
	const code = step['code'];
	if (isInlineFile(code)) {
		if (step['env']) {
			return [
				{
					step: 'runPHPWithOptions',
					options: {
						code: code.content,
						env: step['env'],
					},
				},
			];
		}
		return [
			{
				step: 'runPHP',
				code,
			},
		];
	}

	const resource = convertV2FileDataReferenceToV1(
		code,
		codePath,
		'runPHP.code'
	);

	const phpPath = `/tmp/blueprint-run-php-${sanitizePathForTempFile(
		codePath
	)}.php`;
	return [
		{
			step: 'writeFile',
			path: phpPath,
			data: resource,
		},
		{
			step: 'runPHPWithOptions',
			options: {
				code: `<?php require ${JSON.stringify(phpPath)};`,
				env: step['env'] || {},
			},
		},
	];
}

function createWriteStepsFromV2Files(
	files: Record<string, V2DataReference>,
	basePath = '',
	allowV1AbsolutePaths = false
) {
	const steps: any[] = [];
	for (const [targetPath, dataReference] of Object.entries(files)) {
		const path = toPlaygroundPath(targetPath, allowV1AbsolutePaths);
		const resource = convertV2DataReferenceToV1(dataReference);
		if (isV1DirectoryReference(resource)) {
			steps.push({
				step: 'writeFiles',
				writeToPath: path,
				filesTree: resource,
			});
		} else {
			steps.push({
				step: 'writeFile',
				path,
				data: resource,
			});
		}
	}
	if (steps.length === 0 && basePath) {
		throw new InvalidBlueprintV2Error(
			`Invalid Blueprint v2: ${basePath} did not contain any files.`
		);
	}
	return steps;
}

function createImportContentSteps(content: any[], basePath: string): any[] {
	const steps: any[] = [];
	for (const [index, item] of content.entries()) {
		const itemPath = `${basePath}/${index}`;
		if (item?.type === 'mysql-dump') {
			const sources = Array.isArray(item['source'])
				? item['source']
				: [item['source']];
			for (const [sourceIndex, source] of sources.entries()) {
				const sourcePath = Array.isArray(item['source'])
					? `${itemPath}/source/${sourceIndex}`
					: `${itemPath}/source`;
				steps.push({
					step: 'runSql',
					sql: convertV2FileDataReferenceToV1(
						source,
						sourcePath,
						'mysql-dump content'
					),
				});
			}
			continue;
		}
		if (item?.type === 'posts') {
			steps.push(...createImportPostsSteps(item, itemPath));
			continue;
		}
		if (item?.type !== 'wxr') {
			throw new InvalidBlueprintV2Error(
				`Invalid Blueprint v2: ${itemPath}/type must be "mysql-dump", "posts", or "wxr".`
			);
		}
		const sources = Array.isArray(item['source'])
			? item['source']
			: [item['source']];
		for (const [sourceIndex, source] of sources.entries()) {
			const sourcePath = Array.isArray(item['source'])
				? `${itemPath}/source/${sourceIndex}`
				: `${itemPath}/source`;
			steps.push({
				step: 'importWxr',
				file: convertV2FileDataReferenceToV1(
					source,
					sourcePath,
					'WXR content'
				),
				fetchAttachments: item['staticAssets'] !== 'hotlink',
				rewriteUrls: item['urlsMode'] !== 'preserve',
				urlMap: item['urlsMap'] || {},
				authorsMode: item['authorsMode'] || 'create',
				defaultAuthorUsername: item['defaultAuthorUsername'],
				authorsMap: item['authorsMap'] || {},
				importUsers: item['importUsers'] ?? false,
				importComments: item['importComments'] ?? false,
				importSiteOptions: item['importSiteOptions'] ?? false,
			});
		}
	}
	return steps;
}

function createImportPostsSteps(item: any, itemPath: string): any[] {
	const steps: any[] = [];
	const inlinePosts: JsonObject[] = [];
	const postFiles: JsonObject[] = [];
	const sourceIsArray = Array.isArray(item['source']);
	const sources = sourceIsArray ? item['source'] : [item['source']];

	for (const [sourceIndex, source] of sources.entries()) {
		const sourcePath = sourceIsArray
			? `${itemPath}/source/${sourceIndex}`
			: `${itemPath}/source`;

		if (isV2DataReferenceLike(source)) {
			const resource = convertV2FileDataReferenceToV1(
				source,
				sourcePath,
				'posts content'
			);
			const filename = sanitizeFilenameForTempPath(
				getDataReferenceBasename(source, `post-${sourceIndex}.html`)
			);
			const path = `/tmp/blueprint-post-content-${sanitizePathForTempFile(
				sourcePath
			)}-${filename}`;
			steps.push({
				step: 'writeFile',
				path,
				data: resource,
			});
			postFiles.push({
				path,
				filename,
				post_title: 'Test Post',
				post_type: 'post',
			});
			continue;
		}

		if (!isPlainObject(source)) {
			throw new InvalidBlueprintV2Error(
				`Invalid Blueprint v2: ${sourcePath} must be a post object or data reference.`
			);
		}
		inlinePosts.push(normalizePostDefinitionForImport(source));
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
				BLUEPRINT_URLS_MODE: item['urlsMode'] || 'rewrite',
				BLUEPRINT_URLS_MAP: JSON.stringify(item['urlsMap'] || {}),
			},
		},
	});
	return steps;
}

function normalizePostDefinitionForImport(post: JsonObject): JsonObject {
	return { ...post };
}

function createImportMediaSteps(media: any[], basePath: string): any[] {
	const steps: any[] = [];
	const mediaItems: any[] = [];
	for (const [index, item] of media.entries()) {
		const definition =
			isPlainObject(item) && 'source' in item ? item : { source: item };
		const itemPath = `${basePath}/${index}`;
		const resource = convertV2FileDataReferenceToV1(
			definition['source'],
			itemPath,
			'media imports'
		);

		const filename = sanitizeFilenameForTempPath(
			getDataReferenceBasename(definition['source'], `media-${index}`)
		);
		const path = `/tmp/blueprint-media-${sanitizePathForTempFile(
			itemPath
		)}-${filename}`;
		steps.push({
			step: 'writeFile',
			path,
			data: resource,
		});

		const mediaItem: JsonObject = { path, filename };
		for (const field of ['title', 'description', 'alt', 'caption']) {
			if (definition[field] !== undefined) {
				mediaItem[field] = definition[field];
			}
		}
		mediaItems.push(mediaItem);
	}

	if (mediaItems.length === 0) {
		return steps;
	}

	steps.push({
		step: 'runPHPWithOptions',
		options: {
			code: IMPORT_MEDIA_PHP,
			env: {
				BLUEPRINT_MEDIA: JSON.stringify(mediaItems),
			},
		},
	});
	return steps;
}

function createFontSteps(fonts: Record<string, any>): any[] {
	const steps: any[] = [];
	const collections: JsonObject[] = [];
	const fontFiles: Record<string, JsonObject> = {};
	let fileIndex = 0;

	for (const [slug, definition] of Object.entries(fonts)) {
		const fontPath = `/fonts/${escapeJsonPointer(slug)}`;
		if (isV2DataReferenceLike(definition)) {
			const token = materializeFontSource(
				definition,
				`${fontPath}/source`,
				slug,
				steps,
				fontFiles,
				fileIndex++
			);
			const name = humanizeSlug(slug);
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
		if (!isPlainObject(definition)) {
			throw new InvalidBlueprintV2Error(
				`Invalid Blueprint v2: ${fontPath} must be a data reference or font collection.`
			);
		}

		const collection = cloneJson(definition);
		collection['slug'] = slug;
		collection['name'] = collection['name'] || humanizeSlug(slug);
		collection['font_families'] = (collection['font_families'] || []).map(
			(family: JsonObject, familyIndex: number) => {
				const nextFamily = cloneJson(family);
				const settings = {
					...(nextFamily['font_family_settings'] || {}),
				};
				if (Array.isArray(settings.fontFace)) {
					settings.fontFace = settings.fontFace.map(
						(face: JsonObject, faceIndex: number) => {
							const nextFace = { ...face };
							nextFace['src'] = materializeFontFaceSource(
								nextFace['src'],
								`${fontPath}/font_families/${familyIndex}/font_family_settings/fontFace/${faceIndex}/src`,
								settings.slug || slug,
								steps,
								fontFiles,
								() => fileIndex++
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

function materializeFontFaceSource(
	source: any,
	sourcePath: string,
	slug: string,
	steps: any[],
	fontFiles: Record<string, JsonObject>,
	nextIndex: () => number
) {
	if (Array.isArray(source)) {
		return source.map((item, index) =>
			materializeFontSource(
				item,
				`${sourcePath}/${index}`,
				slug,
				steps,
				fontFiles,
				nextIndex()
			)
		);
	}
	return materializeFontSource(
		source,
		sourcePath,
		slug,
		steps,
		fontFiles,
		nextIndex()
	);
}

function materializeFontSource(
	source: V2DataReference,
	sourcePath: string,
	slug: string,
	steps: any[],
	fontFiles: Record<string, JsonObject>,
	index: number
) {
	const resource = convertV2FileDataReferenceToV1(
		source,
		sourcePath,
		'font source'
	);
	const filename = sanitizeFilenameForTempPath(
		getDataReferenceBasename(source, `${slug}.woff2`)
	);
	assertAllowedFontFilename(filename, sourcePath);
	const token = `font-${index}`;
	const path = `/tmp/blueprint-font-${sanitizePathForTempFile(
		sourcePath
	)}-${filename}`;
	steps.push({
		step: 'writeFile',
		path,
		data: resource,
	});
	fontFiles[`blueprint-font-file:${token}`] = {
		path,
		filename,
	};
	return `blueprint-font-file:${token}`;
}

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

		$slug = sanitize_title($collection['slug']);
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
			'name' => $collection['name'] ?? blueprint_humanize_slug($slug),
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

function blueprint_upsert_font_family(array $settings): int {
	foreach (array('name', 'slug', 'fontFamily') as $field) {
		if (empty($settings[$field]) || !is_string($settings[$field])) {
			throw new Exception('Font family setting "' . $field . '" is required.');
		}
	}

	$slug = sanitize_title($settings['slug']);
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

function blueprint_copy_font_file(array $file, array $font_dir): array {
	$source_path = $file['path'] ?? '';
	if (!$source_path || !is_readable($source_path)) {
		throw new Exception('Font source is not readable: ' . $source_path);
	}

	$filename = sanitize_file_name($file['filename'] ?? basename($source_path));
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

function blueprint_collect_font_categories(array $families): array {
	$categories = array();
	foreach ($families as $family) {
		foreach (($family['categories'] ?? array()) as $category) {
			if (!is_string($category) || $category === '') {
				continue;
			}
			$slug = sanitize_title($category);
			$categories[$slug] = array(
				'name' => blueprint_humanize_slug($slug),
				'slug' => $slug,
			);
		}
	}
	return array_values($categories);
}

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

function blueprint_humanize_slug(string $slug): string {
	return ucwords(str_replace(array('-', '_'), ' ', $slug));
}

function blueprint_font_temp_files(array $files): array {
	$paths = array();
	foreach ($files as $file) {
		if (is_array($file) && !empty($file['path']) && is_string($file['path'])) {
			$paths[] = $file['path'];
		}
	}
	return $paths;
}

function blueprint_cleanup_font_temp_files(array $paths): void {
	foreach (array_unique($paths) as $path) {
		if (is_string($path) && file_exists($path)) {
			@unlink($path);
		}
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

function blueprint_find_parent_post_id(string $name, string $post_type): int {
	$parent = get_page_by_path(sanitize_title($name), OBJECT, $post_type);
	if (!$parent) {
		$query = new WP_Query(array(
			'post_type' => $post_type,
			'title' => $name,
			'post_status' => 'any',
			'posts_per_page' => 1,
			'fields' => 'ids',
		));
		if (!empty($query->posts)) {
			return (int) $query->posts[0];
		}
		throw new Exception('Could not resolve post_parent_name: ' . $name);
	}
	return (int) $parent->ID;
}

function blueprint_set_terms(int $post_id, string $taxonomy, array $terms): void {
	$term_ids = blueprint_ensure_terms($taxonomy, $terms);
	if (!empty($term_ids)) {
		$result = wp_set_object_terms($post_id, $term_ids, $taxonomy, false);
		if (is_wp_error($result)) {
			throw new Exception($result->get_error_message());
		}
	}
}

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

$media_items = json_decode(getenv('BLUEPRINT_MEDIA'), true);
if (!is_array($media_items)) {
	throw new Exception('Invalid BLUEPRINT_MEDIA payload.');
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

		$filename = wp_unique_filename($uploads['path'], basename($item['filename'] ?? $source_path));
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

function blueprint_cleanup_media_temp_files(array $paths): void {
	foreach (array_unique($paths) as $path) {
		if (is_string($path) && file_exists($path)) {
			@unlink($path);
		}
	}
}
`;

function createRolesStep(roles: any[]) {
	return {
		step: 'runPHPWithOptions',
		options: {
			code: `<?php
require '/wordpress/wp-load.php';
$roles = json_decode(getenv('BLUEPRINT_ROLES'), true);
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
	foreach ($capabilities as $capability => $grant) {
		if (filter_var($grant, FILTER_VALIDATE_BOOLEAN)) {
			$role_object->add_cap($capability);
		} else {
			$role_object->remove_cap($capability);
		}
	}
}
`,
			env: {
				BLUEPRINT_ROLES: JSON.stringify(roles),
			},
		},
	};
}

function createUsersStep(users: any[]) {
	return {
		step: 'runPHPWithOptions',
		options: {
			code: `<?php
require '/wordpress/wp-load.php';
$users = json_decode(getenv('BLUEPRINT_USERS'), true);
foreach ($users as $user) {
	if (empty($user['username']) || !is_string($user['username'])) {
		continue;
	}
	$username = $user['username'];
	if (get_user_by('login', $username)) {
		continue;
	}
	$email = $user['email'] ?? $username . '@example.com';
	$password = $user['password'] ?? wp_generate_password(12, true, true);
	$role = $user['role'] ?? 'subscriber';
	$user_id = wp_create_user($username, $password, $email);
	if (is_wp_error($user_id)) {
		throw new Exception($user_id->get_error_message());
	}
	$user_object = new WP_User($user_id);
	$user_object->set_role($role);
	foreach (($user['meta'] ?? array()) as $meta_key => $meta_value) {
		update_user_meta($user_id, $meta_key, $meta_value);
	}
}
`,
			env: {
				BLUEPRINT_USERS: JSON.stringify(users),
			},
		},
	};
}

function createPostTypeSteps(postTypes: Record<string, any>) {
	const steps: any[] = [];
	for (const [slug, args] of Object.entries(postTypes)) {
		const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
		const pluginPath = `/wordpress/wp-content/mu-plugins/blueprint-post-type-${safeSlug}.php`;
		if (typeof args === 'string') {
			const argsPath = `/wordpress/wp-content/mu-plugins/blueprint-post-type-${safeSlug}.json`;
			steps.push({
				step: 'writeFile',
				path: argsPath,
				data: convertV2FileDataReferenceToV1(
					args,
					`/postTypes/${escapeJsonPointer(slug)}`,
					'post type definitions'
				),
			});
			steps.push({
				step: 'writeFile',
				path: pluginPath,
				data: {
					resource: 'literal',
					name: `blueprint-post-type-${safeSlug}.php`,
					contents: createPostTypePluginCode(slug, argsPath),
				},
			});
			continue;
		}

		const postTypeArgs = isPlainObject(args) ? { ...args } : {};
		if (postTypeArgs['label'] === undefined) {
			postTypeArgs['label'] = slug
				.replace(/[-_]+/g, ' ')
				.replace(/\b\w/g, (letter) => letter.toUpperCase());
		}
		steps.push({
			step: 'writeFile',
			path: pluginPath,
			data: {
				resource: 'literal',
				name: `blueprint-post-type-${safeSlug}.php`,
				contents: `<?php
add_action('init', function () {
	register_post_type(${JSON.stringify(slug)}, json_decode(${JSON.stringify(
		JSON.stringify(postTypeArgs)
	)}, true));
}, 0);
`,
			},
		});
	}
	return steps;
}

function createPostTypePluginCode(slug: string, argsPath: string) {
	const basename = argsPath.split('/').pop() || 'post-type.json';
	return `<?php
add_action('init', function () {
	$args = json_decode(file_get_contents(__DIR__ . '/${basename}'), true);
	if (!is_array($args)) {
		$args = array();
	}
	if (!isset($args['label'])) {
		$args['label'] = ${JSON.stringify(
			slug
				.replace(/[-_]+/g, ' ')
				.replace(/\b\w/g, (letter) => letter.toUpperCase())
		)};
	}
	register_post_type(${JSON.stringify(slug)}, $args);
}, 0);
`;
}

function convertV2DataReferenceToV1(
	reference: V2DataReference,
	context?: 'plugin' | 'theme'
): FileReference | DirectoryReference {
	if (typeof reference === 'string') {
		if (
			(context === 'plugin' || context === 'theme') &&
			isGitRepoUrl(reference)
		) {
			return {
				resource: 'zip',
				inner: {
					resource: 'git:directory',
					url: reference.trim().replace(/\/+$/, ''),
					ref: 'HEAD',
				},
			} as FileReference;
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
		if (context === 'plugin') {
			return wordpressOrgResource(reference, 'plugins');
		}
		if (context === 'theme') {
			return wordpressOrgResource(reference, 'themes');
		}
		throw new InvalidBlueprintV2Error(
			`Invalid Blueprint v2 data reference "${reference}". ` +
				'Strings must be URLs, execution-context paths, or contextual plugin/theme slugs.'
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
	throw new InvalidBlueprintV2Error(
		`Unsupported Blueprint v2 data reference: ${JSON.stringify(reference)}`
	);
}

function convertV2FileDataReferenceToV1(
	reference: V2DataReference,
	path: string,
	label: string
): FileReference {
	const resource = convertV2DataReferenceToV1(reference);
	if (isV1DirectoryReference(resource)) {
		throw new UnsupportedBlueprintV2FeatureError(
			path,
			`${label} must reference files, not directories`
		);
	}
	return resource;
}

function convertV1ResourceToV2Reference(resource: any): any {
	if (typeof resource === 'string') {
		return resource;
	}
	if (!resource || typeof resource !== 'object') {
		return resource;
	}
	switch (resource.resource) {
		case 'literal':
			return {
				filename: resource.name,
				content: resource.contents,
			};
		case 'wordpress.org/themes':
		case 'wordpress.org/plugins':
			return resource.slug;
		case 'vfs':
			throw new UnsupportedBlueprintV2FeatureError(
				'/v1/resource/vfs',
				'v1 VFS resources cannot be represented as Blueprint v2 data references'
			);
		case 'url':
			return resource.url;
		case 'bundled':
			return resource.path.startsWith('./') ||
				resource.path.startsWith('/')
				? resource.path
				: `./${resource.path}`;
		case 'literal:directory':
			return {
				directoryName: resource.name,
				files: resource.files,
			};
		case 'git:directory':
			return {
				gitRepository: resource.url,
				pathInRepository: resource.path,
				ref: resource.ref,
			};
		case 'zip':
			if (isV1DirectoryReference(resource.inner)) {
				return convertV1ResourceToV2Reference(resource.inner);
			}
			throw new UnsupportedBlueprintV2FeatureError(
				'/v1/resource/zip',
				'v1 ZIP resources wrapping files cannot be represented as Blueprint v2 data references'
			);
		default:
			return resource;
	}
}

function migrateV1StepToV2(step: JsonObject): V2Step[] {
	switch (step['step']) {
		case 'activatePlugin':
			return [
				{
					step: 'activatePlugin',
					pluginPath: step['pluginPath'],
					humanReadableName: step['humanReadableName'],
				},
			];
		case 'activateTheme':
			return [
				{
					step: 'activateTheme',
					themeDirectoryName: step['themeFolderName'],
					humanReadableName: step['humanReadableName'],
				},
			];
		case 'cp':
			return [
				{
					step: 'cp',
					fromPath: migrateV1Path(step['fromPath']),
					toPath: migrateV1Path(step['toPath']),
				},
			];
		case 'defineWpConfigConsts':
			return [
				{
					step: 'defineConstants',
					constants: step['consts'],
				},
			];
		case 'defineSiteUrl':
			return [
				{
					step: 'defineConstants',
					constants: {
						WP_HOME: step['siteUrl'],
						WP_SITEURL: step['siteUrl'],
					},
				},
			];
		case 'enableMultisite':
			return [{ step: 'enableMultisite' }];
		case 'importWxr':
		case 'importFile': {
			const wxrContent: JsonObject = {
				type: 'wxr',
				source: convertV1ResourceToV2Reference(step['file']),
				staticAssets:
					step['fetchAttachments'] === false ? 'hotlink' : 'fetch',
				urlsMode:
					step['rewriteUrls'] === false ? 'preserve' : 'rewrite',
				authorsMode: step['authorsMode'] || 'default-author',
				defaultAuthorUsername: step['defaultAuthorUsername'] || 'admin',
				authorsMap: step['authorsMap'] || {},
				importUsers: step['importUsers'] ?? false,
				importComments: step['importComments'] ?? true,
				importSiteOptions: step['importSiteOptions'] ?? false,
			};
			if (step['urlMap']) {
				wxrContent['urlsMap'] = step['urlMap'];
			}
			return [
				{
					step: 'importContent',
					content: [wxrContent],
				},
			];
		}
		case 'importThemeStarterContent':
			return [
				{
					step: 'importThemeStarterContent',
					themeSlug: step['themeSlug'],
				},
			];
		case 'installPlugin':
			return [
				{
					step: 'installPlugin',
					source: convertV1ResourceToV2Reference(
						step['pluginData'] ?? step['pluginZipFile']
					),
					active: step['options']?.activate,
					activationOptions: step['options']?.activationOptions,
					onError: step['options']?.onError,
					ifAlreadyInstalled: step['ifAlreadyInstalled'],
					targetDirectoryName: step['options']?.targetFolderName,
					humanReadableName: step['options']?.humanReadableName,
				},
			];
		case 'installTheme':
			return [
				{
					step: 'installTheme',
					source: convertV1ResourceToV2Reference(
						step['themeData'] ?? step['themeZipFile']
					),
					active: step['options']?.activate,
					importStarterContent: step['options']?.importStarterContent,
					targetDirectoryName: step['options']?.targetFolderName,
					onError: step['options']?.onError,
					ifAlreadyInstalled: step['ifAlreadyInstalled'],
					humanReadableName: step['options']?.humanReadableName,
				},
			];
		case 'mkdir':
		case 'rm':
		case 'rmdir':
			return [
				{
					step: step['step'] === 'rmDir' ? 'rmdir' : step['step'],
					path: migrateV1Path(step['path']),
				},
			];
		case 'rmDir':
			return [{ step: 'rmdir', path: migrateV1Path(step['path']) }];
		case 'mv':
			return [
				{
					step: 'mv',
					fromPath: migrateV1Path(step['fromPath']),
					toPath: migrateV1Path(step['toPath']),
				},
			];
		case 'runPHP':
			return [
				{
					step: 'runPHP',
					code: {
						filename: 'script.php',
						content: step['code'],
					},
				},
			];
		case 'runPHPWithOptions':
			return [
				{
					step: 'runPHP',
					code: {
						filename: 'script.php',
						content: step['options']?.code,
					},
					...(step['options']?.env
						? { env: step['options'].env }
						: {}),
				},
			];
		case 'runSQL':
		case 'runSql':
			return [
				{
					step: 'runSQL',
					source: convertV1ResourceToV2Reference(step['sql']),
				},
			];
		case 'setSiteLanguage':
			return [{ step: 'setSiteLanguage', language: step['language'] }];
		case 'setSiteOptions':
			return [{ step: 'setSiteOptions', options: step['options'] }];
		case 'unzip':
			return [
				{
					step: 'unzip',
					zipFile: convertV1ResourceToV2Reference(
						step['zipFile'] ?? step['zipPath']
					),
					extractToPath: migrateV1Path(step['extractToPath']),
				},
			];
		case 'updateUserMeta':
			return [
				{
					step: 'runPHP',
					code: {
						filename: 'script.php',
						content: `<?php
require '/wordpress/wp-load.php';
$meta = json_decode(getenv('META'), true);
foreach ($meta as $name => $value) {
	update_user_meta(getenv('USER_ID'), $name, $value);
}
`,
					},
					env: {
						USER_ID: String(step['userId']),
						META: JSON.stringify(step['meta']),
					},
				},
			];
		case 'writeFile': {
			const path = migrateV1Path(step['path']);
			return [
				{
					step: 'writeFiles',
					files: {
						[path]:
							typeof step['data'] === 'string'
								? {
										filename: basenameFromUrlOrPath(path),
										content: step['data'],
									}
								: convertV1ResourceToV2Reference(step['data']),
					},
				},
			];
		}
		case 'writeFiles': {
			const basePath = migrateV1Path(step['writeToPath']);
			if (step['filesTree']?.resource) {
				const resource = convertV1ResourceToV2Reference(
					step['filesTree']
				);
				if (
					typeof resource === 'string' ||
					!resource ||
					typeof resource !== 'object' ||
					!('files' in resource || 'gitRepository' in resource)
				) {
					throw new UnsupportedBlueprintV2FeatureError(
						'/steps/writeFiles/filesTree',
						'only literal and git directory resources can be migrated to Blueprint v2 writeFiles steps'
					);
				}
				return [
					{
						step: 'writeFiles',
						files: {
							[basePath]: resource,
						},
					},
				];
			}
			const files: Record<string, any> = {};
			for (const [path, data] of Object.entries(
				step['filesTree']?.files || {}
			)) {
				files[`${basePath}/${path}`] =
					typeof data === 'string'
						? {
								filename: basenameFromUrlOrPath(path),
								content: data,
							}
						: convertV1ResourceToV2Reference(data);
			}
			return [{ step: 'writeFiles', files }];
		}
		case 'wp-cli':
			return [{ step: 'wp-cli', command: step['command'] }];
		default:
			throw new UnsupportedBlueprintV2FeatureError(
				`/steps/${String(step['step'] || 'unknown')}`,
				`v1 step "${String(
					step['step']
				)}" cannot be represented as a Blueprint v2 step`
			);
	}
}

function migrateV1LoginStepToV2(step: JsonObject): V2Step[] {
	let username = 'admin';
	if (step['username'] !== undefined) {
		if (typeof step['username'] !== 'string') {
			throw new InvalidBlueprintV2Error(
				'/steps/login/username: must be a string'
			);
		}
		username = step['username'];
	}
	return [
		{
			step: 'defineConstants',
			constants: {
				PLAYGROUND_AUTO_LOGIN_AS_USER: username,
			},
		},
	];
}

const V1_WORDPRESS_ONLY_FEATURES = new Set([
	'installPlugin',
	'installTheme',
	'activatePlugin',
	'activateTheme',
	'login',
	'setSiteOptions',
	'updateUserMeta',
	'importWxr',
	'importFile',
	'importWordPressFiles',
	'enableMultisite',
	'wp-cli',
	'resetData',
]);

function assertV1BlueprintWithoutWordPressCanUpgrade(
	blueprint: BlueprintV1Declaration
) {
	const offenders: string[] = [];
	if (blueprint.plugins?.length) {
		offenders.push('plugins');
	}
	if (blueprint.siteOptions) {
		offenders.push('siteOptions');
	}
	if (blueprint.login) {
		offenders.push('login');
	}
	if (blueprint.extraLibraries?.includes('wp-cli')) {
		offenders.push("extraLibraries includes 'wp-cli'");
	}
	const badSteps = (blueprint.steps || [])
		.filter((step) => !!step && typeof step === 'object' && 'step' in step)
		.map((step) => String((step as any).step))
		.filter((name) => V1_WORDPRESS_ONLY_FEATURES.has(name));
	if (badSteps.length) {
		offenders.push(`steps: ${[...new Set(badSteps)].join(', ')}`);
	}
	if (offenders.length) {
		throw new InvalidBlueprintV2Error(
			`Blueprint has \`preferredVersions.wp: false\` but uses ` +
				`WordPress-only features: ${offenders.join('; ')}. Remove ` +
				`these or drop \`preferredVersions.wp: false\`.`
		);
	}
}

function validateV2TopLevelField(
	key: string,
	value: any,
	errors: BlueprintV2ValidationError[]
) {
	const path = `/${key}`;
	switch (key) {
		case 'version':
			return;
		case '$schema':
			validateSchemaReference(value, path, errors);
			return;
		case 'blueprintMeta':
			validateBlueprintMeta(value, path, errors);
			return;
		case 'applicationOptions':
			validateApplicationOptions(value, path, errors);
			return;
		case 'siteOptions':
			validateObject(value, path, errors);
			if (isPlainObject(value) && 'siteUrl' in value) {
				errors.push({
					path: `${path}/siteUrl`,
					message: 'must not be declared in siteOptions',
				});
			}
			return;
		case 'constants':
			validateConstants(value, path, errors);
			return;
		case 'fonts':
			validateFonts(value, path, errors);
			return;
		case 'postTypes':
			validatePostTypes(value, path, errors);
			return;
		case 'siteLanguage':
			validateString(value, path, errors);
			return;
		case 'wordpressVersion':
			validateWordPressVersion(value, path, errors);
			return;
		case 'phpVersion':
			validatePHPVersion(value, path, errors);
			return;
		case 'activeTheme':
			validateThemeDefinition(value, path, errors);
			return;
		case 'themes':
			validateArray(value, path, errors, (item, itemPath) =>
				validateThemeDefinition(item, itemPath, errors)
			);
			return;
		case 'plugins':
			validateArray(value, path, errors, (item, itemPath) =>
				validatePluginDefinition(item, itemPath, errors)
			);
			return;
		case 'muPlugins':
			validateArray(value, path, errors, (item, itemPath) =>
				validateDataReference(item, itemPath, errors)
			);
			return;
		case 'users':
			validateArray(value, path, errors, (item, itemPath) =>
				validateUserDefinition(item, itemPath, errors)
			);
			return;
		case 'roles':
			validateArray(value, path, errors, (item, itemPath) =>
				validateRoleDefinition(item, itemPath, errors)
			);
			return;
		case 'additionalStepsAfterExecution':
			validateArray(value, path, errors);
			return;
		case 'content':
			validateArray(value, path, errors, (item, itemPath) =>
				validateContentDefinition(item, itemPath, errors)
			);
			return;
		case 'media':
			validateArray(value, path, errors, (item, itemPath) =>
				validateMediaDefinition(item, itemPath, errors)
			);
			return;
	}
}

function validateV2Step(
	step: any,
	path: string,
	errors: BlueprintV2ValidationError[],
	allowV1AbsolutePaths = false
) {
	if (!step || typeof step !== 'object' || Array.isArray(step)) {
		errors.push({ path, message: 'must be an object' });
		return;
	}
	if (!V2_STEP_REQUIRED_FIELDS[step.step]) {
		errors.push({
			path: `${path}/step`,
			message: `unknown step "${String(step.step)}"`,
		});
		return;
	}
	for (const field of V2_STEP_REQUIRED_FIELDS[step.step]) {
		if (step[field] === undefined) {
			errors.push({
				path,
				message: `must have required property "${field}"`,
			});
		}
	}
	validateAllowedProperties(
		step,
		path,
		V2_STEP_ALLOWED_PROPERTIES[step.step],
		errors
	);
	validateV2StepFieldTypes(step, path, errors, allowV1AbsolutePaths);
}

function validateV2StepFieldTypes(
	step: JsonObject,
	path: string,
	errors: BlueprintV2ValidationError[],
	allowV1AbsolutePaths = false
) {
	switch (step['step']) {
		case 'activatePlugin':
			validatePlaygroundPath(
				step['pluginPath'],
				`${path}/pluginPath`,
				errors,
				allowV1AbsolutePaths
			);
			validateOptionalString(
				step['humanReadableName'],
				`${path}/humanReadableName`,
				errors
			);
			return;
		case 'activateTheme':
			validatePathSegment(
				step['themeDirectoryName'],
				`${path}/themeDirectoryName`,
				errors
			);
			validateOptionalString(
				step['humanReadableName'],
				`${path}/humanReadableName`,
				errors
			);
			return;
		case 'cp':
		case 'mv':
			validatePlaygroundPath(
				step['fromPath'],
				`${path}/fromPath`,
				errors,
				allowV1AbsolutePaths
			);
			validatePlaygroundPath(
				step['toPath'],
				`${path}/toPath`,
				errors,
				allowV1AbsolutePaths
			);
			return;
		case 'defineConstants':
			validateConstants(step['constants'], `${path}/constants`, errors);
			return;
		case 'importContent':
			validateArray(
				step['content'],
				`${path}/content`,
				errors,
				(item, itemPath) =>
					validateContentDefinition(item, itemPath, errors)
			);
			return;
		case 'importMedia':
			validateArray(
				step['media'],
				`${path}/media`,
				errors,
				(item, itemPath) =>
					validateMediaDefinition(item, itemPath, errors)
			);
			return;
		case 'importThemeStarterContent':
			validateOptionalString(
				step['themeSlug'],
				`${path}/themeSlug`,
				errors
			);
			return;
		case 'installPlugin':
			validatePluginDefinition(step, path, errors, { allowStep: true });
			return;
		case 'installTheme':
			validateThemeDefinition(step, path, errors, {
				allowStep: true,
				allowActive: true,
			});
			validateOptionalBoolean(step['active'], `${path}/active`, errors);
			return;
		case 'mkdir':
		case 'rm':
		case 'rmdir':
			validatePlaygroundPath(
				step['path'],
				`${path}/path`,
				errors,
				allowV1AbsolutePaths
			);
			return;
		case 'runPHP':
			validateFileDataReference(step['code'], `${path}/code`, errors);
			validateStringRecord(step['env'], `${path}/env`, errors);
			return;
		case 'runSQL':
			validateFileDataReference(step['source'], `${path}/source`, errors);
			return;
		case 'setSiteLanguage':
			validateString(step['language'], `${path}/language`, errors);
			return;
		case 'setSiteOptions':
			validateObject(step['options'], `${path}/options`, errors);
			return;
		case 'unzip':
			validateFileDataReference(
				step['zipFile'],
				`${path}/zipFile`,
				errors
			);
			validatePlaygroundPath(
				step['extractToPath'],
				`${path}/extractToPath`,
				errors,
				allowV1AbsolutePaths
			);
			return;
		case 'wp-cli':
			validateString(step['command'], `${path}/command`, errors);
			validateOptionalString(
				step['wpCliPath'],
				`${path}/wpCliPath`,
				errors
			);
			return;
		case 'writeFiles':
			validateRecord(
				step['files'],
				`${path}/files`,
				errors,
				(item, itemPath) =>
					validateDataReference(item, itemPath, errors)
			);
			if (isPlainObject(step['files'])) {
				for (const targetPath of Object.keys(step['files'])) {
					validatePlaygroundPath(
						targetPath,
						`${path}/files/${escapeJsonPointer(targetPath)}`,
						errors,
						allowV1AbsolutePaths
					);
				}
			}
			return;
	}
}

function validateSchemaReference(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (
		typeof value === 'string' &&
		(isHttpUrl(value) || isExecutionContextPath(value))
	) {
		return;
	}
	errors.push({
		path,
		message: 'must be a URL or execution-context path',
	});
}

function validateBlueprintMeta(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (!isPlainObject(value)) {
		errors.push({ path, message: 'must be an object' });
		return;
	}
	validateAllowedProperties(
		value,
		path,
		new Set([
			'name',
			'description',
			'moreInfo',
			'version',
			'authors',
			'homepage',
			'donateLink',
			'tags',
			'license',
		]),
		errors
	);
	for (const field of [
		'name',
		'description',
		'moreInfo',
		'version',
		'license',
	]) {
		validateOptionalString(value[field], `${path}/${field}`, errors);
	}
	validateStringArray(value['authors'], `${path}/authors`, errors);
	validateStringArray(value['tags'], `${path}/tags`, errors);
	validateOptionalUrl(value['homepage'], `${path}/homepage`, errors);
	validateOptionalUrl(value['donateLink'], `${path}/donateLink`, errors);
}

function validateApplicationOptions(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (!isPlainObject(value)) {
		errors.push({ path, message: 'must be an object' });
		return;
	}
	validateAllowedProperties(
		value,
		path,
		new Set(['wordpress-playground']),
		errors
	);
	const playgroundOptions = value['wordpress-playground'];
	if (playgroundOptions === undefined) {
		errors.push({
			path,
			message: 'must have required property "wordpress-playground"',
		});
		return;
	}
	if (!isPlainObject(playgroundOptions)) {
		errors.push({
			path: `${path}/wordpress-playground`,
			message: 'must be an object',
		});
		return;
	}
	validateAllowedProperties(
		playgroundOptions,
		`${path}/wordpress-playground`,
		new Set(['landingPage', 'login', 'networkAccess']),
		errors
	);
	validateOptionalString(
		playgroundOptions['landingPage'],
		`${path}/wordpress-playground/landingPage`,
		errors
	);
	validateLoginOption(
		playgroundOptions['login'],
		`${path}/wordpress-playground/login`,
		errors
	);
	validateOptionalBoolean(
		playgroundOptions['networkAccess'],
		`${path}/wordpress-playground/networkAccess`,
		errors
	);
}

function validateLoginOption(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (value === undefined || typeof value === 'boolean') {
		return;
	}
	if (!isPlainObject(value)) {
		errors.push({ path, message: 'must be a boolean or login object' });
		return;
	}
	validateAllowedProperties(
		value,
		path,
		new Set(['username', 'password']),
		errors
	);
	for (const field of ['username', 'password']) {
		if (value[field] === undefined) {
			errors.push({
				path,
				message: `must have required property "${field}"`,
			});
		}
		validateString(value[field], `${path}/${field}`, errors);
	}
}

function validateConstants(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	validateRecord(value, path, errors, (constant, constantPath) => {
		if (
			typeof constant !== 'string' &&
			typeof constant !== 'number' &&
			typeof constant !== 'boolean'
		) {
			errors.push({
				path: constantPath,
				message: 'must be a string, number, or boolean',
			});
		}
	});
}

function validateUserDefinition(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (!isPlainObject(value)) {
		errors.push({ path, message: 'must be an object' });
		return;
	}
	validateAllowedProperties(
		value,
		path,
		new Set(['username', 'email', 'role', 'meta']),
		errors
	);
	for (const field of ['username', 'email', 'role', 'meta']) {
		if (value[field] === undefined) {
			errors.push({
				path,
				message: `must have required property "${field}"`,
			});
		}
	}
	validateString(value['username'], `${path}/username`, errors);
	validateString(value['email'], `${path}/email`, errors);
	validateString(value['role'], `${path}/role`, errors);
	validateStringRecord(value['meta'], `${path}/meta`, errors);
}

function validateRoleDefinition(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (!isPlainObject(value)) {
		errors.push({ path, message: 'must be an object' });
		return;
	}
	validateAllowedProperties(
		value,
		path,
		new Set(['name', 'capabilities']),
		errors
	);
	for (const field of ['name', 'capabilities']) {
		if (value[field] === undefined) {
			errors.push({
				path,
				message: `must have required property "${field}"`,
			});
		}
	}
	validateString(value['name'], `${path}/name`, errors);
	validateStringRecord(value['capabilities'], `${path}/capabilities`, errors);
}

function validatePluginDefinition(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[],
	options: { allowStep?: boolean } = {}
) {
	if (isPlainObject(value) && 'source' in value) {
		validateAllowedProperties(
			value,
			path,
			new Set([
				...(options.allowStep ? ['step'] : []),
				'source',
				'active',
				'targetDirectoryName',
				'activationOptions',
				'onError',
				'ifAlreadyInstalled',
				'humanReadableName',
			]),
			errors
		);
		validateDataReference(value['source'], `${path}/source`, errors, {
			allowDirectorySlug: true,
		});
		validateOptionalBoolean(value['active'], `${path}/active`, errors);
		validateOptionalPathSegment(
			value['targetDirectoryName'],
			`${path}/targetDirectoryName`,
			errors
		);
		validateObjectIfDefined(
			value['activationOptions'],
			`${path}/activationOptions`,
			errors
		);
		if (
			value['onError'] !== undefined &&
			value['onError'] !== 'skip-plugin' &&
			value['onError'] !== 'throw'
		) {
			errors.push({
				path: `${path}/onError`,
				message: 'must be "skip-plugin" or "throw"',
			});
		}
		validateIfAlreadyInstalled(
			value['ifAlreadyInstalled'],
			`${path}/ifAlreadyInstalled`,
			errors
		);
		validateOptionalString(
			value['humanReadableName'],
			`${path}/humanReadableName`,
			errors
		);
		return;
	}
	validateDataReference(value, path, errors, { allowDirectorySlug: true });
}

function validateThemeDefinition(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[],
	options: { allowStep?: boolean; allowActive?: boolean } = {}
) {
	if (isPlainObject(value) && 'source' in value) {
		validateAllowedProperties(
			value,
			path,
			new Set([
				...(options.allowStep ? ['step'] : []),
				'source',
				...(options.allowActive ? ['active'] : []),
				'importStarterContent',
				'targetDirectoryName',
				'onError',
				'ifAlreadyInstalled',
				'humanReadableName',
			]),
			errors
		);
		validateDataReference(value['source'], `${path}/source`, errors, {
			allowDirectorySlug: true,
		});
		validateOptionalBoolean(
			value['importStarterContent'],
			`${path}/importStarterContent`,
			errors
		);
		validateOptionalPathSegment(
			value['targetDirectoryName'],
			`${path}/targetDirectoryName`,
			errors
		);
		if (
			value['onError'] !== undefined &&
			value['onError'] !== 'skip-theme' &&
			value['onError'] !== 'throw'
		) {
			errors.push({
				path: `${path}/onError`,
				message: 'must be "skip-theme" or "throw"',
			});
		}
		validateIfAlreadyInstalled(
			value['ifAlreadyInstalled'],
			`${path}/ifAlreadyInstalled`,
			errors
		);
		validateOptionalString(
			value['humanReadableName'],
			`${path}/humanReadableName`,
			errors
		);
		return;
	}
	validateDataReference(value, path, errors, { allowDirectorySlug: true });
}

function validateContentDefinition(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (!isPlainObject(value)) {
		errors.push({ path, message: 'must be an object' });
		return;
	}
	if (value['type'] === undefined) {
		errors.push({ path, message: 'must have required property "type"' });
		return;
	}
	if (
		value['type'] !== 'mysql-dump' &&
		value['type'] !== 'posts' &&
		value['type'] !== 'wxr'
	) {
		errors.push({
			path: `${path}/type`,
			message: 'must be "mysql-dump", "posts", or "wxr"',
		});
		return;
	}
	if (value['source'] === undefined) {
		errors.push({ path, message: 'must have required property "source"' });
		return;
	}

	if (value['type'] === 'posts') {
		validateAllowedProperties(
			value,
			path,
			new Set(['type', 'source', 'urlsMode', 'urlsMap']),
			errors
		);
		validatePostsSource(value['source'], `${path}/source`, errors);
		validateContentUrlMapping(value, path, errors);
		return;
	}
	validateAllowedProperties(
		value,
		path,
		value['type'] === 'wxr'
			? new Set([
					'type',
					'source',
					'staticAssets',
					'urlsMode',
					'urlsMap',
					'authorsMode',
					'defaultAuthorUsername',
					'authorsMap',
					'importUsers',
					'importComments',
					'importSiteOptions',
				])
			: new Set(['type', 'source']),
		errors
	);
	if (Array.isArray(value['source'])) {
		value['source'].forEach((source: any, index: number) =>
			validateFileDataReference(source, `${path}/source/${index}`, errors)
		);
	} else {
		validateFileDataReference(value['source'], `${path}/source`, errors);
	}
	if (
		value['type'] === 'wxr' &&
		value['staticAssets'] !== undefined &&
		value['staticAssets'] !== 'fetch' &&
		value['staticAssets'] !== 'hotlink'
	) {
		errors.push({
			path: `${path}/staticAssets`,
			message: 'must be "fetch" or "hotlink"',
		});
	}
	if (value['type'] === 'wxr') {
		if (
			value['authorsMode'] !== undefined &&
			value['authorsMode'] !== 'create' &&
			value['authorsMode'] !== 'default-author' &&
			value['authorsMode'] !== 'map'
		) {
			errors.push({
				path: `${path}/authorsMode`,
				message: 'must be "create", "default-author", or "map"',
			});
		}
		validateOptionalString(
			value['defaultAuthorUsername'],
			`${path}/defaultAuthorUsername`,
			errors
		);
		validateStringRecord(value['authorsMap'], `${path}/authorsMap`, errors);
		for (const field of [
			'importUsers',
			'importComments',
			'importSiteOptions',
		]) {
			validateOptionalBoolean(value[field], `${path}/${field}`, errors);
		}
		if (
			value['authorsMode'] === 'map' &&
			value['authorsMap'] === undefined
		) {
			errors.push({
				path,
				message: 'must have required property "authorsMap"',
			});
		}
	}
	validateContentUrlMapping(value, path, errors);
}

function validatePostsSource(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (Array.isArray(value)) {
		value.forEach((source, index) =>
			validatePostsSourceItem(source, `${path}/${index}`, errors)
		);
		return;
	}
	validatePostsSourceItem(value, path, errors);
}

function validatePostsSourceItem(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (typeof value === 'string' || isV2DataReferenceObjectLike(value)) {
		validateFileDataReference(value, path, errors);
		return;
	}
	validateWordPressPost(value, path, errors);
}

function validateWordPressPost(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (!isPlainObject(value)) {
		errors.push({
			path,
			message: 'must be a post object or data reference',
		});
		return;
	}

	validateAllowedProperties(
		value,
		path,
		new Set([
			'post_author',
			'post_date',
			'post_content',
			'post_title',
			'post_excerpt',
			'post_status',
			'post_type',
			'comment_status',
			'post_password',
			'post_name',
			'post_parent_name',
			'menu_order',
			'post_mime_type',
			'guid',
			'post_category',
			'post_tags',
			'tax_input',
			'meta_input',
			'page_template',
		]),
		errors
	);
	const hasPostTitle = value['post_title'] !== undefined;
	if (!hasPostTitle) {
		errors.push({
			path,
			message: 'must have required property "post_title"',
		});
	}
	validateOptionalString(value['post_title'], `${path}/post_title`, errors);
	validateOptionalNumber(value['post_author'], `${path}/post_author`, errors);
	validateOptionalString(value['post_date'], `${path}/post_date`, errors);
	validateOptionalString(
		value['post_content'],
		`${path}/post_content`,
		errors
	);
	validateOptionalString(
		value['post_excerpt'],
		`${path}/post_excerpt`,
		errors
	);
	validateOptionalString(value['post_type'], `${path}/post_type`, errors);
	validateOptionalString(
		value['post_password'],
		`${path}/post_password`,
		errors
	);
	validateOptionalString(value['post_name'], `${path}/post_name`, errors);
	validateOptionalString(
		value['post_parent_name'],
		`${path}/post_parent_name`,
		errors
	);
	validateOptionalNumber(value['menu_order'], `${path}/menu_order`, errors);
	validateOptionalString(
		value['post_mime_type'],
		`${path}/post_mime_type`,
		errors
	);
	validateOptionalString(value['guid'], `${path}/guid`, errors);
	validateOptionalString(
		value['page_template'],
		`${path}/page_template`,
		errors
	);
	validateStringArray(
		value['post_category'],
		`${path}/post_category`,
		errors
	);
	validateStringArray(value['post_tags'], `${path}/post_tags`, errors);
	validateTaxInput(value['tax_input'], `${path}/tax_input`, errors);
	validateObjectIfDefined(value['meta_input'], `${path}/meta_input`, errors);

	if (
		value['post_status'] !== undefined &&
		![
			'publish',
			'pending',
			'draft',
			'auto-draft',
			'future',
			'private',
			'inherit',
			'trash',
		].includes(value['post_status'])
	) {
		errors.push({
			path: `${path}/post_status`,
			message:
				'must be "publish", "pending", "draft", "auto-draft", "future", "private", "inherit", or "trash"',
		});
	}

	if (
		value['comment_status'] !== undefined &&
		value['comment_status'] !== 'open' &&
		value['comment_status'] !== 'closed'
	) {
		errors.push({
			path: `${path}/comment_status`,
			message: 'must be "open" or "closed"',
		});
	}
}

function validateContentUrlMapping(
	value: JsonObject,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (
		value['urlsMode'] !== undefined &&
		value['urlsMode'] !== 'rewrite' &&
		value['urlsMode'] !== 'preserve'
	) {
		errors.push({
			path: `${path}/urlsMode`,
			message: 'must be "rewrite" or "preserve"',
		});
	}
	validateUrlMap(value['urlsMap'], `${path}/urlsMap`, errors);
}

function validateMediaDefinition(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (isPlainObject(value) && 'source' in value) {
		validateAllowedProperties(
			value,
			path,
			new Set(['source', 'title', 'description', 'alt', 'caption']),
			errors
		);
		validateFileDataReference(value['source'], `${path}/source`, errors);
		for (const field of ['title', 'description', 'alt', 'caption']) {
			validateOptionalString(value[field], `${path}/${field}`, errors);
		}
		return;
	}
	validateFileDataReference(value, path, errors);
}

function validatePostTypes(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	validateRecord(value, path, errors, (args, argsPath) => {
		if (typeof args === 'string') {
			if (!isExecutionContextPath(args)) {
				errors.push({
					path: argsPath,
					message: 'must be an execution-context path or object',
				});
			}
			return;
		}
		validateObject(args, argsPath, errors);
	});
}

function validateFonts(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	validateRecord(value, path, errors, (definition, definitionPath) => {
		if (isV2DataReferenceLike(definition)) {
			validateFontSourceReference(definition, definitionPath, errors);
			return;
		}
		validateFontCollection(definition, definitionPath, errors);
	});
}

function validateFontCollection(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (!isPlainObject(value)) {
		errors.push({
			path,
			message: 'must be a data reference or font collection',
		});
		return;
	}
	validateAllowedProperties(
		value,
		path,
		new Set(['$schema', 'font_families']),
		errors
	);
	validateOptionalString(value['$schema'], `${path}/$schema`, errors);
	if (value['font_families'] === undefined) {
		errors.push({
			path,
			message: 'must have required property "font_families"',
		});
		return;
	}
	validateArray(
		value['font_families'],
		`${path}/font_families`,
		errors,
		(family, familyPath) => validateFontFamily(family, familyPath, errors)
	);
}

function validateFontFamily(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (!isPlainObject(value)) {
		errors.push({ path, message: 'must be an object' });
		return;
	}
	validateAllowedProperties(
		value,
		path,
		new Set(['font_family_settings', 'categories']),
		errors
	);
	if (value['font_family_settings'] === undefined) {
		errors.push({
			path,
			message: 'must have required property "font_family_settings"',
		});
	} else {
		validateFontFamilySettings(
			value['font_family_settings'],
			`${path}/font_family_settings`,
			errors
		);
	}
	validateStringArray(value['categories'], `${path}/categories`, errors);
}

function validateFontFamilySettings(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (!isPlainObject(value)) {
		errors.push({ path, message: 'must be an object' });
		return;
	}
	validateAllowedProperties(
		value,
		path,
		new Set(['name', 'slug', 'fontFamily', 'preview', 'fontFace']),
		errors
	);
	for (const field of ['name', 'slug', 'fontFamily']) {
		if (value[field] === undefined) {
			errors.push({
				path,
				message: `must have required property "${field}"`,
			});
		}
		validateString(value[field], `${path}/${field}`, errors);
	}
	validateOptionalString(value['preview'], `${path}/preview`, errors);
	validateArray(
		value['fontFace'],
		`${path}/fontFace`,
		errors,
		(face, facePath) => validateFontFace(face, facePath, errors)
	);
}

function validateFontFace(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (!isPlainObject(value)) {
		errors.push({ path, message: 'must be an object' });
		return;
	}
	validateAllowedProperties(
		value,
		path,
		new Set([
			'preview',
			'fontFamily',
			'fontStyle',
			'fontWeight',
			'fontDisplay',
			'src',
			'fontStretch',
			'ascentOverride',
			'descentOverride',
			'fontVariant',
			'fontFeatureSettings',
			'fontVariationSettings',
			'lineGapOverride',
			'sizeAdjust',
			'unicodeRange',
		]),
		errors
	);
	for (const field of ['fontFamily', 'src']) {
		if (value[field] === undefined) {
			errors.push({
				path,
				message: `must have required property "${field}"`,
			});
		}
	}
	validateOptionalString(value['preview'], `${path}/preview`, errors);
	validateString(value['fontFamily'], `${path}/fontFamily`, errors);
	validateOptionalString(value['fontStyle'], `${path}/fontStyle`, errors);
	if (
		value['fontWeight'] !== undefined &&
		typeof value['fontWeight'] !== 'string' &&
		typeof value['fontWeight'] !== 'number'
	) {
		errors.push({
			path: `${path}/fontWeight`,
			message: 'must be a string or number',
		});
	}
	if (
		value['fontDisplay'] !== undefined &&
		!['auto', 'block', 'fallback', 'swap', 'optional'].includes(
			value['fontDisplay']
		)
	) {
		errors.push({
			path: `${path}/fontDisplay`,
			message:
				'must be "auto", "block", "fallback", "swap", or "optional"',
		});
	}
	validateFontFaceSource(value['src'], `${path}/src`, errors);
	for (const field of [
		'fontStretch',
		'ascentOverride',
		'descentOverride',
		'fontVariant',
		'fontFeatureSettings',
		'fontVariationSettings',
		'lineGapOverride',
		'sizeAdjust',
		'unicodeRange',
	]) {
		validateOptionalString(value[field], `${path}/${field}`, errors);
	}
}

function validateFontFaceSource(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (Array.isArray(value)) {
		value.forEach((source, index) =>
			validateFontSourceReference(source, `${path}/${index}`, errors)
		);
		return;
	}
	validateFontSourceReference(value, path, errors);
}

function validateFontSourceReference(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	validateDataReference(value, path, errors);
	if (isInlineDirectory(value) || isGitPath(value)) {
		errors.push({
			path,
			message: 'must reference a font file, not a directory',
		});
		return;
	}
	if (isValidDataReferenceForFilename(value)) {
		const filename = getDataReferenceBasename(value, '');
		if (!isAllowedFontFilename(filename)) {
			errors.push({
				path,
				message: 'must reference a .woff2, .woff, .ttf, or .otf file',
			});
		}
	}
}

function validateDataReference(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[],
	options: { allowDirectorySlug?: boolean } = {}
) {
	if (value === undefined) {
		return;
	}
	if (typeof value === 'string') {
		if (
			isHttpUrl(value) ||
			isExecutionContextPath(value) ||
			(options.allowDirectorySlug && isDirectorySlug(value))
		) {
			return;
		}
		errors.push({
			path,
			message: options.allowDirectorySlug
				? 'must be a URL, execution-context path, or directory slug'
				: 'must be a URL or execution-context path',
		});
		return;
	}
	if (!isPlainObject(value)) {
		errors.push({ path, message: 'must be a data reference' });
		return;
	}
	if ('filename' in value || 'content' in value) {
		validateAllowedProperties(
			value,
			path,
			new Set(['filename', 'content']),
			errors
		);
		for (const field of ['filename', 'content']) {
			if (value[field] === undefined) {
				errors.push({
					path,
					message: `must have required property "${field}"`,
				});
			}
		}
		validateString(value['filename'], `${path}/filename`, errors);
		validatePathSegment(value['filename'], `${path}/filename`, errors);
		validateString(value['content'], `${path}/content`, errors);
		return;
	}
	if ('directoryName' in value || 'files' in value) {
		validateAllowedProperties(
			value,
			path,
			new Set(['directoryName', 'files']),
			errors
		);
		for (const field of ['directoryName', 'files']) {
			if (value[field] === undefined) {
				errors.push({
					path,
					message: `must have required property "${field}"`,
				});
			}
		}
		validateString(value['directoryName'], `${path}/directoryName`, errors);
		validatePathSegment(
			value['directoryName'],
			`${path}/directoryName`,
			errors
		);
		validateInlineDirectoryFiles(value['files'], `${path}/files`, errors);
		return;
	}
	if ('gitRepository' in value) {
		validateAllowedProperties(
			value,
			path,
			new Set(['gitRepository', 'ref', 'pathInRepository']),
			errors
		);
		validateString(value['gitRepository'], `${path}/gitRepository`, errors);
		if (
			typeof value['gitRepository'] === 'string' &&
			!isHttpUrl(value['gitRepository'])
		) {
			errors.push({
				path: `${path}/gitRepository`,
				message: 'must be an HTTP or HTTPS URL',
			});
		}
		validateOptionalString(value['ref'], `${path}/ref`, errors);
		validateOptionalString(
			value['pathInRepository'],
			`${path}/pathInRepository`,
			errors
		);
		if (
			typeof value['pathInRepository'] === 'string' &&
			pathContainsParentDirectorySegment(value['pathInRepository'])
		) {
			errors.push({
				path: `${path}/pathInRepository`,
				message: 'must not contain parent directory segments',
			});
		}
		return;
	}
	errors.push({ path, message: 'must be a data reference' });
}

function validateFileDataReference(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	validateDataReference(value, path, errors);
	if (isInlineDirectory(value) || isGitPath(value)) {
		errors.push({
			path,
			message: 'must reference a file, not a directory',
		});
	}
}

function validateInlineDirectoryFiles(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	validateRecord(value, path, errors, (item, itemPath) => {
		const filePath = itemPath.split('/').pop() || '';
		const decodedFilePath = filePath
			.replace(/~1/g, '/')
			.replace(/~0/g, '~');
		if (!isValidPathSegment(decodedFilePath)) {
			errors.push({
				path: itemPath,
				message: 'must be a file or directory name, not a path',
			});
		}
		if (typeof item === 'string') {
			return;
		}
		if (isPlainObject(item)) {
			validateAllowedProperties(
				item,
				itemPath,
				new Set(['files']),
				errors
			);
			if (item['files'] === undefined) {
				errors.push({
					path: itemPath,
					message: 'must have required property "files"',
				});
			}
			validateInlineDirectoryFiles(
				item['files'],
				`${itemPath}/files`,
				errors
			);
			return;
		}
		errors.push({
			path: itemPath,
			message: 'must be a string or inline directory',
		});
	});
}

function validatePHPVersion(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	try {
		resolveV2PHPVersion(value);
	} catch (error) {
		errors.push({
			path,
			message:
				error instanceof Error
					? error.message.replace(/^.*?:\s*/, '')
					: String(error),
		});
	}
}

function validateWordPressVersion(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (isDataReferenceObject(value)) {
		validateDataReference(value, path, errors);
	}
	try {
		resolveV2WordPressVersion(value);
	} catch (error) {
		errors.push({
			path,
			message:
				error instanceof Error
					? error.message.replace(/^.*?:\s*/, '')
					: String(error),
		});
	}
}

function validateIfAlreadyInstalled(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (
		value !== undefined &&
		value !== 'overwrite' &&
		value !== 'skip' &&
		value !== 'error'
	) {
		errors.push({
			path,
			message: 'must be "overwrite", "skip", or "error"',
		});
	}
}

function isDataReferenceObject(value: any) {
	return (
		isPlainObject(value) &&
		('filename' in value ||
			'content' in value ||
			'directoryName' in value ||
			'files' in value ||
			'gitRepository' in value)
	);
}

function validateArray(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[],
	validateItem?: (item: any, path: string) => void
) {
	if (value === undefined) {
		return;
	}
	if (!Array.isArray(value)) {
		errors.push({ path, message: 'must be an array' });
		return;
	}
	if (validateItem) {
		value.forEach((item, index) => validateItem(item, `${path}/${index}`));
	}
}

function validateRecord(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[],
	validateValue?: (item: any, path: string) => void
) {
	if (value === undefined) {
		return;
	}
	if (!isPlainObject(value)) {
		errors.push({ path, message: 'must be an object' });
		return;
	}
	if (validateValue) {
		for (const [key, item] of Object.entries(value)) {
			validateValue(item, `${path}/${escapeJsonPointer(key)}`);
		}
	}
}

function validateAllowedProperties(
	value: JsonObject,
	path: string,
	allowedProperties: Set<string>,
	errors: BlueprintV2ValidationError[]
) {
	for (const key of Object.keys(value)) {
		if (!allowedProperties.has(key)) {
			errors.push({
				path,
				message: `has unexpected property "${key}"`,
			});
		}
	}
}

function validateObject(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (value === undefined) {
		return;
	}
	if (!isPlainObject(value)) {
		errors.push({ path, message: 'must be an object' });
	}
}

function validateObjectIfDefined(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (value !== undefined) {
		validateObject(value, path, errors);
	}
}

function validateString(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (value === undefined) {
		return;
	}
	if (typeof value !== 'string') {
		errors.push({ path, message: 'must be a string' });
	}
}

function validatePlaygroundPath(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[],
	allowV1AbsolutePaths = false
) {
	validateString(value, path, errors);
	if (typeof value !== 'string') {
		return;
	}
	if (value.startsWith(V1_ABSOLUTE_PATH_PREFIX) && !allowV1AbsolutePaths) {
		errors.push({
			path,
			message: 'must not use internal v1 absolute path markers',
		});
		return;
	}
	if (pathContainsParentDirectorySegment(value)) {
		errors.push({
			path,
			message: 'must not contain parent directory segments',
		});
	}
}

function validatePathSegment(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	validateString(value, path, errors);
	if (typeof value !== 'string') {
		return;
	}
	if (!isValidPathSegment(value)) {
		errors.push({
			path,
			message: 'must be a directory name, not a path',
		});
		return;
	}
	if (pathContainsParentDirectorySegment(value)) {
		errors.push({
			path,
			message: 'must not contain parent directory segments',
		});
	}
}

function isValidPathSegment(value: string) {
	return (
		value !== '' &&
		value !== '.' &&
		value !== '..' &&
		!value.includes('/') &&
		!value.includes('\\')
	);
}

function validateOptionalPathSegment(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (value !== undefined) {
		validatePathSegment(value, path, errors);
	}
}

function validateOptionalString(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (value !== undefined) {
		validateString(value, path, errors);
	}
}

function validateOptionalUrl(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (value === undefined) {
		return;
	}
	validateString(value, path, errors);
	if (typeof value === 'string' && !isHttpUrl(value)) {
		errors.push({ path, message: 'must be an HTTP or HTTPS URL' });
	}
}

function validateOptionalBoolean(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (value !== undefined && typeof value !== 'boolean') {
		errors.push({ path, message: 'must be a boolean' });
	}
}

function validateOptionalNumber(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (value !== undefined && typeof value !== 'number') {
		errors.push({ path, message: 'must be a number' });
	}
}

function validateStringArray(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (value === undefined) {
		return;
	}
	validateArray(value, path, errors, (item, itemPath) => {
		if (typeof item !== 'string') {
			errors.push({ path: itemPath, message: 'must be a string' });
		}
	});
}

function validateTaxInput(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (value === undefined) {
		return;
	}
	validateRecord(value, path, errors, (terms, termsPath) =>
		validateStringArray(terms, termsPath, errors)
	);
}

function validateStringRecord(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (value === undefined) {
		return;
	}
	validateRecord(value, path, errors, (item, itemPath) => {
		if (typeof item !== 'string') {
			errors.push({ path: itemPath, message: 'must be a string' });
		}
	});
}

function validateUrlMap(
	value: any,
	path: string,
	errors: BlueprintV2ValidationError[]
) {
	if (value === undefined) {
		return;
	}
	validateRecord(value, path, errors, (item, itemPath) => {
		if (typeof item !== 'string') {
			errors.push({ path: itemPath, message: 'must be a string' });
			return;
		}
		if (!isHttpUrl(item)) {
			errors.push({
				path: itemPath,
				message: 'must be an HTTP or HTTPS URL',
			});
		}
	});
	if (!isPlainObject(value)) {
		return;
	}
	for (const key of Object.keys(value)) {
		if (!isHttpUrl(key)) {
			errors.push({
				path: `${path}/${escapeJsonPointer(key)}`,
				message: 'must use an HTTP or HTTPS URL as the source URL',
			});
		}
	}
}

function getPlaygroundApplicationOptions(blueprint: BlueprintV2Declaration):
	| {
			landingPage?: string;
			login?: boolean | { username: string; password: string };
			networkAccess?: boolean;
	  }
	| undefined {
	return (blueprint as any).applicationOptions?.['wordpress-playground'];
}

function getUpgradedV1RuntimeConfiguration(
	blueprint: BlueprintV2Declaration
): UpgradedV1RuntimeConfiguration | undefined {
	return (blueprint as any)[upgradedV1RuntimeConfiguration];
}

function copyUpgradedV1Metadata(
	from: BlueprintV2Declaration,
	to: BlueprintV2Declaration
) {
	if (isUpgradedV1Declaration(from)) {
		Object.defineProperty(to, upgradedV1Declaration, {
			value: true,
			enumerable: false,
		});
	}
	const runtimeConfiguration = getUpgradedV1RuntimeConfiguration(from);
	if (runtimeConfiguration) {
		Object.defineProperty(to, upgradedV1RuntimeConfiguration, {
			value: runtimeConfiguration,
			enumerable: false,
		});
	}
}

function isUpgradedV1Declaration(blueprint: object) {
	return (blueprint as any)[upgradedV1Declaration] === true;
}

function resolveV2PHPVersion(
	version: BlueprintV2Declaration['phpVersion']
): AllPHPVersion {
	if (!version) {
		return DEFAULT_BLUEPRINT_V2_PHP_VERSION;
	}
	if (typeof version === 'string') {
		return normalizeSupportedPHPVersion(version, '/phpVersion');
	}
	if (!isPlainObject(version)) {
		throw new InvalidBlueprintV2Error(
			'/phpVersion: must be a string or version constraint object'
		);
	}
	for (const key of Object.keys(version)) {
		if (!['min', 'max', 'recommended'].includes(key)) {
			throw new InvalidBlueprintV2Error(
				`/phpVersion: has unexpected property "${key}"`
			);
		}
	}
	const min = version.min
		? normalizeSupportedPHPVersionConstraint(version.min, '/phpVersion/min')
		: undefined;
	const max = version.max
		? normalizeSupportedPHPVersionConstraint(version.max, '/phpVersion/max')
		: undefined;
	const recommended = version.recommended
		? normalizeSupportedPHPVersionConstraint(
				version.recommended,
				'/phpVersion/recommended'
			)
		: undefined;
	if (min && max && comparePHPVersions(min, max) > 0) {
		throw new InvalidBlueprintV2Error(
			'/phpVersion: min must be less than or equal to max'
		);
	}
	const compatibleVersions = SUPPORTED_NUMERIC_PHP_VERSIONS.filter(
		(supported) =>
			(!min || comparePHPVersions(supported, min) >= 0) &&
			(!max || comparePHPVersions(supported, max) <= 0)
	);
	if (compatibleVersions.length === 0) {
		throw new InvalidBlueprintV2Error(
			'/phpVersion: no supported PHP version satisfies the constraint'
		);
	}
	if (recommended) {
		if (!compatibleVersions.includes(recommended)) {
			throw new InvalidBlueprintV2Error(
				'/phpVersion/recommended: must satisfy the min/max constraint'
			);
		}
		return recommended;
	}
	if (compatibleVersions.includes(RecommendedPHPVersion)) {
		return RecommendedPHPVersion;
	}
	return compatibleVersions[0];
}

function resolveV2WordPressVersion(
	version: BlueprintV2Declaration['wordpressVersion']
) {
	if (!version) {
		return 'latest';
	}
	if (typeof version === 'string') {
		if (isHttpUrl(version)) {
			return version;
		}
		if (isExecutionContextPath(version)) {
			assertWordPressZipReference(version, '/wordpressVersion');
			return customWordPressVersionLabel(version);
		}
		assertValidWordPressVersion(version, '/wordpressVersion');
		return version;
	}
	if (isInlineFile(version)) {
		assertWordPressZipReference(version, '/wordpressVersion');
		return customWordPressVersionLabel(version);
	}
	if (isInlineDirectory(version) || isGitPath(version)) {
		return customWordPressVersionLabel(version);
	}
	const constraint = version as any;
	if (!isPlainObject(constraint)) {
		throw new InvalidBlueprintV2Error(
			'/wordpressVersion: must be a string, data reference, or version constraint object'
		);
	}
	for (const key of Object.keys(constraint)) {
		if (!['min', 'max', 'preferred', 'recommended'].includes(key)) {
			throw new InvalidBlueprintV2Error(
				`/wordpressVersion: has unexpected property "${key}"`
			);
		}
	}
	const min = constraint['min'];
	const max = constraint['max'];
	const preferredKey =
		constraint['preferred'] !== undefined ? 'preferred' : 'recommended';
	const preferred =
		preferredKey === undefined ? undefined : constraint[preferredKey];
	if (min === undefined) {
		throw new InvalidBlueprintV2Error(
			'/wordpressVersion: must have required property "min"'
		);
	}
	if (min !== undefined) {
		assertValidWordPressConstraintVersion(min, '/wordpressVersion/min');
	}
	if (max !== undefined) {
		assertValidWordPressConstraintVersion(max, '/wordpressVersion/max');
	}
	if (preferred !== undefined) {
		assertValidWordPressPreferredVersion(
			preferred,
			`/wordpressVersion/${preferredKey}`
		);
	}
	if (preferred === 'latest') {
		return resolveLatestSupportedWordPressVersionMatchingConstraint({
			min,
			max,
			path: '/wordpressVersion',
		});
	}
	if (
		min !== undefined &&
		max !== undefined &&
		compareVersionLike(min, max) > 0
	) {
		throw new InvalidBlueprintV2Error(
			'/wordpressVersion: min must be less than or equal to max'
		);
	}
	if (
		preferred !== undefined &&
		((min !== undefined && compareVersionLike(preferred, min) < 0) ||
			(max !== undefined && compareVersionLike(preferred, max) > 0))
	) {
		throw new InvalidBlueprintV2Error(
			`/wordpressVersion/${preferredKey}: must satisfy the min/max constraint`
		);
	}
	if (preferred !== undefined) {
		return preferred;
	}
	return resolveLatestSupportedWordPressVersionMatchingConstraint({
		min,
		max,
		path: '/wordpressVersion',
	});
}

function getWordPressZipDataReference(
	version: BlueprintV2Declaration['wordpressVersion']
): V2DataReference | undefined {
	if (
		typeof version === 'string' &&
		(isHttpUrl(version) || isExecutionContextPath(version))
	) {
		return version;
	}
	if (isInlineFile(version)) {
		return version;
	}
	if (isInlineDirectory(version) || isGitPath(version)) {
		return version;
	}
	return undefined;
}

const SUPPORTED_NUMERIC_PHP_VERSIONS = (AllPHPVersions as readonly string[])
	.filter((version) => version !== 'next')
	.sort((a, b) => comparePHPVersions(b, a)) as AllPHPVersion[];
const DEFAULT_BLUEPRINT_V2_PHP_VERSION = '8.0' as AllPHPVersion;
const SUPPORTED_WORDPRESS_VERSION_CONSTRAINT_CHOICES = [
	'7.0',
	'6.9',
	'6.8',
	'6.7',
	'6.6',
	'6.5',
	'6.4',
	'6.3',
];

function normalizeSupportedPHPVersion(
	version: string,
	path: string
): AllPHPVersion {
	if (version === 'next') {
		return version as AllPHPVersion;
	}
	if (version === 'latest') {
		return LatestSupportedPHPVersion as AllPHPVersion;
	}
	const normalized = version.split('.').slice(0, 2).join('.');
	if (AllPHPVersions.includes(normalized as any)) {
		return normalized as AllPHPVersion;
	}
	throw new InvalidBlueprintV2Error(
		`${path}: unsupported PHP version "${version}"`
	);
}

function normalizeSupportedPHPVersionConstraint(
	version: string,
	path: string
): AllPHPVersion {
	if (version === 'next') {
		throw new InvalidBlueprintV2Error(
			`${path}: "next" can only be used as a top-level phpVersion string`
		);
	}
	return normalizeSupportedPHPVersion(version, path);
}

function comparePHPVersions(a: string, b: string) {
	if (a === b) {
		return 0;
	}
	if (a === 'next') {
		return 1;
	}
	if (b === 'next') {
		return -1;
	}
	return compareVersionLike(a, b);
}

function assertValidWordPressVersion(version: string, path: string) {
	if (
		!['latest', 'beta', 'trunk', 'nightly'].includes(version) &&
		!/^\d+\.\d+(?:\.\d+)?(?:-(?:beta\d+|RC\d+|rc\d+))?$/.test(version)
	) {
		throw new InvalidBlueprintV2Error(
			`${path}: invalid WordPress version "${version}"`
		);
	}
}

function assertValidWordPressConstraintVersion(version: string, path: string) {
	assertValidWordPressVersion(version, path);
	if (['latest', 'beta', 'trunk', 'nightly'].includes(version)) {
		throw new InvalidBlueprintV2Error(
			`${path}: must be a comparable WordPress version`
		);
	}
}

function assertValidWordPressPreferredVersion(version: string, path: string) {
	assertValidWordPressVersion(version, path);
	if (['beta', 'trunk', 'nightly'].includes(version)) {
		throw new InvalidBlueprintV2Error(
			`${path}: must be "latest" or a comparable WordPress version`
		);
	}
}

function resolveLatestSupportedWordPressVersionMatchingConstraint({
	min,
	max,
	path,
}: {
	min: string;
	max?: string;
	path: string;
}) {
	const matchingVersion = SUPPORTED_WORDPRESS_VERSION_CONSTRAINT_CHOICES.find(
		(version) => {
			if (compareVersionLike(version, min) < 0) {
				return false;
			}
			return max === undefined || compareVersionLike(version, max) <= 0;
		}
	);
	if (matchingVersion) {
		return matchingVersion;
	}
	throw new InvalidBlueprintV2Error(
		`${path}: no bundled WordPress version satisfies the min/max constraint`
	);
}

function assertAllowedFontFilename(filename: string, path: string) {
	if (!isAllowedFontFilename(filename)) {
		throw new InvalidBlueprintV2Error(
			`${path}: must reference a .woff2, .woff, .ttf, or .otf file`
		);
	}
}

function isAllowedFontFilename(filename: string) {
	return /\.(woff2|woff|ttf|otf)$/i.test(filename);
}

function assertWordPressZipReference(reference: V2DataReference, path: string) {
	if (!/\.zip$/i.test(getDataReferenceBasename(reference, ''))) {
		throw new InvalidBlueprintV2Error(
			`${path}: must reference a WordPress ZIP file`
		);
	}
}

function customWordPressVersionLabel(reference: V2DataReference) {
	const filename = getDataReferenceBasename(reference, 'wordpress.zip');
	const slug = filename.replace(/\.[^.]+$/, '');
	return `custom-${sanitizePathForTempFile(slug)}`;
}

function compareVersionLike(a: string, b: string) {
	const parsedA = parseVersionLike(a);
	const parsedB = parseVersionLike(b);
	for (let i = 0; i < 4; i++) {
		if (parsedA[i] !== parsedB[i]) {
			return parsedA[i] - parsedB[i];
		}
	}
	return 0;
}

function parseVersionLike(version: string): [number, number, number, number] {
	if (['latest', 'beta', 'trunk', 'nightly'].includes(version)) {
		return [Number.POSITIVE_INFINITY, 0, 0, 0];
	}
	const match = version.match(
		/^(\d+)\.(\d+)(?:\.(\d+))?(?:-(beta|Beta|rc|RC)(\d+))?$/
	);
	if (!match) {
		throw new InvalidBlueprintV2Error(`Invalid version "${version}"`);
	}
	const [, major, minor, patch = '0', prerelease, prereleaseNumber = '0'] =
		match;
	const prereleaseWeight =
		prerelease === undefined
			? 2
			: prerelease.toLowerCase() === 'rc'
				? 1
				: 0;
	return [
		Number(major),
		Number(minor),
		Number(patch),
		prereleaseWeight * 1000 + Number(prereleaseNumber),
	];
}

function blueprintRequiresWpCli(blueprint: BlueprintV2Declaration) {
	const steps = (blueprint as any).additionalStepsAfterExecution || [];
	return steps.some((step: any) => step?.step === 'wp-cli');
}

// Public v2 paths are site-relative unless prefixed with `site:`. Migrated v1
// blueprints may still target `/tmp` or other absolute VFS paths, so the
// internal marker preserves that intent without accepting it from public v2 JSON.
const V1_ABSOLUTE_PATH_PREFIX = 'v1-absolute:';

function toPlaygroundPath(path: string, allowV1AbsolutePaths = false): string {
	if (typeof path !== 'string' || path.length === 0) {
		return '/wordpress';
	}
	if (path.startsWith(V1_ABSOLUTE_PATH_PREFIX)) {
		if (!allowV1AbsolutePaths) {
			throw new InvalidBlueprintV2Error(
				`Invalid Blueprint v2 path "${path}": must not use internal v1 absolute path markers.`
			);
		}
		const v1Path = path.slice(V1_ABSOLUTE_PATH_PREFIX.length);
		if (pathContainsParentDirectorySegment(v1Path)) {
			throw new InvalidBlueprintV2Error(
				`Invalid Blueprint v2 path "${v1Path}": must not contain parent directory segments.`
			);
		}
		return v1Path;
	}
	if (pathContainsParentDirectorySegment(path)) {
		throw new InvalidBlueprintV2Error(
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

function migrateV1Path(path: string): string {
	if (path === '/wordpress') {
		return '/';
	}
	if (path.startsWith('/wordpress/')) {
		return path.slice('/wordpress'.length);
	}
	if (path.startsWith('wordpress/')) {
		return path.slice('wordpress'.length);
	}
	if (path.startsWith('/')) {
		return `${V1_ABSOLUTE_PATH_PREFIX}${path}`;
	}
	return path;
}

function isHttpUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

function isDirectorySlug(value: string) {
	return /^[a-zA-Z0-9_-]+(?:@(latest|\d+\.\d+(?:\.\d+)?))?$/.test(value);
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

function hasParentDirectorySegment(path: string) {
	return path.split('/').includes('..');
}

function pathContainsParentDirectorySegment(path: string) {
	const vfsPath = path.startsWith('site:')
		? path.slice('site:'.length)
		: path;
	return hasParentDirectorySegment(vfsPath.replace(/\\/g, '/'));
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
	files: Record<string, string | V2InlineDirectory>;
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

function isPlainObject(value: any): value is JsonObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isV2DataReferenceLike(value: any): value is V2DataReference {
	return typeof value === 'string' || isV2DataReferenceObjectLike(value);
}

function isV2DataReferenceObjectLike(
	value: any
): value is Exclude<V2DataReference, string> {
	return (
		isPlainObject(value) &&
		('filename' in value ||
			'directoryName' in value ||
			'files' in value ||
			'gitRepository' in value)
	);
}

function isValidDataReferenceForFilename(value: any): value is V2DataReference {
	return (
		typeof value === 'string' ||
		isInlineFile(value) ||
		isInlineDirectory(value) ||
		isGitPath(value)
	);
}

function isV1DirectoryReference(
	resource: FileReference | DirectoryReference
): resource is DirectoryReference {
	return (
		(resource as any).resource === 'literal:directory' ||
		(resource as any).resource === 'git:directory'
	);
}

function inlineDirectoryFilesToFileTree(
	files: Record<string, string | V2InlineDirectory>
): Record<string, string | Record<string, any>> {
	return Object.fromEntries(
		Object.entries(files).map(([path, content]) => {
			if (typeof content === 'string') {
				return [path, content];
			}
			return [path, inlineDirectoryFilesToFileTree(content.files)];
		})
	);
}

function getMuPluginTargetPath(reference: V2DataReference, index: number) {
	if (isInlineFile(reference)) {
		return `/wordpress/wp-content/mu-plugins/${reference.filename}`;
	}
	if (isInlineDirectory(reference)) {
		return `/wordpress/wp-content/mu-plugins/${reference.directoryName}`;
	}
	if (typeof reference === 'string') {
		return `/wordpress/wp-content/mu-plugins/${basenameFromUrlOrPath(reference)}`;
	}
	return `/wordpress/wp-content/mu-plugins/blueprint-mu-plugin-${index}.php`;
}

function basenameFromUrlOrPath(path: string) {
	try {
		const parsed = new URL(path);
		path = parsed.pathname;
	} catch {
		// Not a URL.
	}
	const trimmed = path.replace(/\/+$/, '');
	return pathBasename(trimmed) || 'file';
}

function getDataReferenceBasename(
	reference: V2DataReference,
	fallback: string
) {
	if (typeof reference === 'string') {
		return basenameFromUrlOrPath(reference);
	}
	if (isInlineFile(reference)) {
		return basenameFromUrlOrPath(reference.filename);
	}
	if (isInlineDirectory(reference)) {
		return basenameFromUrlOrPath(reference.directoryName || fallback);
	}
	if (isGitPath(reference)) {
		return basenameFromUrlOrPath(
			reference.pathInRepository || reference.path || fallback
		);
	}
	return fallback;
}

function sanitizePathForTempFile(path: string) {
	return (
		path.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'step'
	);
}

function sanitizeFilenameForTempPath(filename: string) {
	return filename.replace(/[^a-zA-Z0-9._-]+/g, '-') || 'file';
}

function escapeJsonPointer(pathSegment: string) {
	return pathSegment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function humanizeSlug(slug: string) {
	return slug
		.replace(/[-_]+/g, ' ')
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

function formatBlueprintV2ValidationErrors(
	errors: BlueprintV2ValidationError[]
) {
	return (
		`Invalid Blueprint v2: The Blueprint does not conform to the supported schema.\n\n` +
		errors
			.map((error, index) => {
				return `${index + 1}. At path "${error.path}": ${error.message}`;
			})
			.join('\n')
	);
}

function assertValidBlueprintV2Declaration(
	declaration: BlueprintV2Declaration
) {
	const validation = validateBlueprintV2(declaration);
	if (!validation.valid) {
		throw new InvalidBlueprintV2Error(
			formatBlueprintV2ValidationErrors(validation.errors),
			validation.errors
		);
	}
}

function assertNeverStep(step: string): never {
	throw new InvalidBlueprintV2Error(`Unknown Blueprint v2 step: ${step}`);
}

const V2_TOP_LEVEL_KEYS = new Set([
	'version',
	'$schema',
	'blueprintMeta',
	'applicationOptions',
	'siteLanguage',
	'siteOptions',
	'constants',
	'wordpressVersion',
	'phpVersion',
	'activeTheme',
	'themes',
	'plugins',
	'muPlugins',
	'postTypes',
	'fonts',
	'media',
	'content',
	'users',
	'roles',
	'additionalStepsAfterExecution',
]);

const V2_STEP_REQUIRED_FIELDS: Record<string, string[]> = {
	activatePlugin: ['pluginPath'],
	activateTheme: ['themeDirectoryName'],
	cp: ['fromPath', 'toPath'],
	defineConstants: ['constants'],
	enableMultisite: [],
	importContent: ['content'],
	importMedia: ['media'],
	importThemeStarterContent: [],
	installPlugin: ['source'],
	installTheme: ['source'],
	mkdir: ['path'],
	mv: ['fromPath', 'toPath'],
	rm: ['path'],
	rmdir: ['path'],
	runPHP: ['code'],
	runSQL: ['source'],
	setSiteLanguage: ['language'],
	setSiteOptions: ['options'],
	unzip: ['zipFile', 'extractToPath'],
	'wp-cli': ['command'],
	writeFiles: ['files'],
};

const V2_STEP_ALLOWED_PROPERTIES: Record<string, Set<string>> = {
	activatePlugin: new Set(['step', 'pluginPath', 'humanReadableName']),
	activateTheme: new Set(['step', 'themeDirectoryName', 'humanReadableName']),
	cp: new Set(['step', 'fromPath', 'toPath']),
	defineConstants: new Set(['step', 'constants']),
	enableMultisite: new Set(['step']),
	importContent: new Set(['step', 'content']),
	importMedia: new Set(['step', 'media']),
	importThemeStarterContent: new Set(['step', 'themeSlug']),
	installPlugin: new Set([
		'step',
		'source',
		'active',
		'targetDirectoryName',
		'activationOptions',
		'onError',
		'ifAlreadyInstalled',
		'humanReadableName',
	]),
	installTheme: new Set([
		'step',
		'source',
		'active',
		'importStarterContent',
		'targetDirectoryName',
		'onError',
		'ifAlreadyInstalled',
		'humanReadableName',
	]),
	mkdir: new Set(['step', 'path']),
	mv: new Set(['step', 'fromPath', 'toPath']),
	rm: new Set(['step', 'path']),
	rmdir: new Set(['step', 'path']),
	runPHP: new Set(['step', 'code', 'env']),
	runSQL: new Set(['step', 'source']),
	setSiteLanguage: new Set(['step', 'language']),
	setSiteOptions: new Set(['step', 'options']),
	unzip: new Set(['step', 'zipFile', 'extractToPath']),
	'wp-cli': new Set(['step', 'command', 'wpCliPath']),
	writeFiles: new Set(['step', 'files']),
};

export type { OnStepCompleted, PHPConstants };
