import type { BlueprintV2Declaration } from '../types';

/**
 * Transpiles a V1 blueprint (any blueprint without a `version`
 * property) into V2 format following the spec's mapping tables.
 *
 * The mapping covers:
 * - Top-level properties (versions, applicationOptions, meta)
 * - Declarative shorthand (constants, siteOptions, plugins)
 * - V1 steps → V2 steps with per-step field rewrites
 * - Resource objects → V2 data references
 * - `/wordpress/` path translation
 */
export function transpileV1toV2(
	v1: Record<string, unknown>
): BlueprintV2Declaration {
	const v2: Record<string, unknown> = { version: 2 };

	mapVersionConstraints(v1, v2);
	mapApplicationOptions(v1, v2);
	mapBlueprintMeta(v1, v2);

	// Build additionalStepsAfterExecution from V1 declarative
	// properties and explicit steps.
	const steps: Record<string, unknown>[] = [];
	transpileV1Constants(v1, steps);
	transpileV1SiteOptions(v1, steps);
	transpileV1Plugins(v1, steps);
	transpileV1Steps(v1, steps);

	if (steps.length > 0) {
		v2.additionalStepsAfterExecution = steps;
	}

	return v2 as BlueprintV2Declaration;
}

// ------------------------------------------------------------------
// Top-level property mapping
// ------------------------------------------------------------------

/**
 * Maps `preferredVersions.php/wp` → `phpVersion`/`wordpressVersion`.
 */
function mapVersionConstraints(
	v1: Record<string, unknown>,
	v2: Record<string, unknown>
): void {
	const prefs = v1.preferredVersions as Record<string, unknown> | undefined;
	if (!prefs) {
		return;
	}
	if (prefs.php !== undefined) {
		v2.phpVersion = String(prefs.php);
	}
	if (prefs.wp !== undefined) {
		v2.wordpressVersion = String(prefs.wp);
	}
}

/**
 * Maps `landingPage`, `login`, and `features.networking` into
 * `applicationOptions['wordpress-playground']`.
 */
function mapApplicationOptions(
	v1: Record<string, unknown>,
	v2: Record<string, unknown>
): void {
	const playgroundOpts: Record<string, unknown> = {};

	if (v1.landingPage !== undefined) {
		playgroundOpts.landingPage = v1.landingPage;
	}

	if (v1.login !== undefined) {
		playgroundOpts.login = v1.login;
	}

	const features = v1.features as Record<string, unknown> | undefined;
	if (features?.networking !== undefined) {
		playgroundOpts.networkAccess = features.networking;
	}

	if (Object.keys(playgroundOpts).length > 0) {
		v2.applicationOptions = {
			'wordpress-playground': playgroundOpts,
		};
	}
}

/**
 * Maps `meta.*` → `blueprintMeta.*`.
 */
function mapBlueprintMeta(
	v1: Record<string, unknown>,
	v2: Record<string, unknown>
): void {
	const meta = v1.meta as Record<string, unknown> | undefined;
	if (!meta) {
		return;
	}

	const bpMeta: Record<string, unknown> = {};

	if (meta.title !== undefined) {
		bpMeta.name = meta.title;
	}
	if (meta.description !== undefined) {
		bpMeta.description = meta.description;
	}
	if (meta.author !== undefined) {
		bpMeta.authors = [meta.author];
	}
	if (meta.categories !== undefined) {
		bpMeta.tags = meta.categories;
	}

	if (Object.keys(bpMeta).length > 0) {
		v2.blueprintMeta = bpMeta;
	}
}

// ------------------------------------------------------------------
// Declarative property → step transpilation
// ------------------------------------------------------------------

/**
 * V1 `constants` → `defineConstants` step.
 */
function transpileV1Constants(
	v1: Record<string, unknown>,
	steps: Record<string, unknown>[]
): void {
	if (!v1.constants) {
		return;
	}
	steps.push({
		step: 'defineConstants',
		constants: v1.constants,
	});
}

/**
 * V1 `siteOptions` → `setSiteOptions` step.
 */
function transpileV1SiteOptions(
	v1: Record<string, unknown>,
	steps: Record<string, unknown>[]
): void {
	if (!v1.siteOptions) {
		return;
	}
	steps.push({
		step: 'setSiteOptions',
		options: v1.siteOptions,
	});
}

/**
 * V1 `plugins` shorthand → `installPlugin` steps.
 * Each entry is either a slug string or a V1 resource.
 */
function transpileV1Plugins(
	v1: Record<string, unknown>,
	steps: Record<string, unknown>[]
): void {
	const plugins = v1.plugins as unknown[] | undefined;
	if (!plugins) {
		return;
	}
	for (const entry of plugins) {
		if (typeof entry === 'string') {
			steps.push({
				step: 'installPlugin',
				source: entry,
				active: true,
			});
		} else if (isResourceObject(entry)) {
			steps.push({
				step: 'installPlugin',
				source: convertResourceToDataReference(entry),
				active: true,
			});
		}
	}
}

// ------------------------------------------------------------------
// V1 step → V2 step transpilation
// ------------------------------------------------------------------

/**
 * Rewrites V1 `steps` into V2 `additionalStepsAfterExecution`
 * entries with per-step field renaming.
 */
function transpileV1Steps(
	v1: Record<string, unknown>,
	steps: Record<string, unknown>[]
): void {
	const v1Steps = v1.steps as unknown[] | undefined;
	if (!v1Steps) {
		return;
	}

	for (const raw of v1Steps) {
		// Filter out falsy entries (V1 allows undefined/false/null)
		if (!raw || typeof raw !== 'object') {
			continue;
		}
		const step = raw as Record<string, unknown>;
		const rewritten = rewriteStep(step);
		if (rewritten) {
			steps.push(rewritten);
		}
	}
}

/**
 * Step name mapping: V1 name → V2 name.
 */
const STEP_NAME_MAP: Record<string, string> = {
	defineWpConfigConsts: 'defineConstants',
	'wp-cli': 'wpCLI',
	wpCLI: 'wpCLI',
	runPHPWithOptions: 'runPHP',
	importWxr: 'importContent',
	writeFile: 'writeFiles',
	runSql: 'runSQL',
};

/**
 * Rewrites a single V1 step to its V2 equivalent.
 */
function rewriteStep(
	step: Record<string, unknown>
): Record<string, unknown> | null {
	const v1Name = step.step as string;
	if (!v1Name) {
		return null;
	}

	const v2Name = STEP_NAME_MAP[v1Name] ?? v1Name;

	switch (v1Name) {
		case 'installPlugin':
			return rewriteInstallPlugin(step);
		case 'installTheme':
			return rewriteInstallTheme(step);
		case 'activatePlugin':
			return rewriteActivatePlugin(step);
		case 'activateTheme':
			return rewriteActivateTheme(step);
		case 'defineWpConfigConsts':
			return rewriteDefineWpConfigConsts(step);
		case 'runPHP':
			return rewriteRunPHP(step);
		case 'runPHPWithOptions':
			return rewriteRunPHPWithOptions(step);
		case 'setSiteOptions':
			return rewriteSetSiteOptions(step);
		case 'wp-cli':
		case 'wpCLI':
			return rewriteWpCLI(step, v2Name);
		case 'writeFile':
			return rewriteWriteFile(step);
		case 'writeFiles':
			return rewriteWriteFiles(step);
		case 'importWxr':
			return rewriteImportWxr(step);
		case 'importWordPressFiles':
			return rewriteImportWordPressFiles(step);
		case 'unzip':
			return rewriteUnzip(step);
		case 'runSql':
			return rewriteRunSql(step);
		case 'login':
			return rewriteLogin(step);
		case 'cp':
		case 'mv':
			return rewriteCpMv(step);
		case 'rm':
		case 'mkdir':
		case 'rmdir':
			return rewritePathStep(step);
		case 'setSiteLanguage':
			return { step: v2Name, language: step.language };
		case 'enableMultisite':
			return { step: 'enableMultisite' };
		case 'importThemeStarterContent':
			return rewriteImportThemeStarterContent(step);
		case 'updateUserMeta':
			return rewriteUpdateUserMeta(step);
		case 'defineSiteUrl':
			return {
				step: 'defineSiteUrl',
				siteUrl: step.siteUrl,
			};
		case 'resetData':
			return { step: 'resetData' };
		case 'request':
			// Deprecated — pass through for best-effort
			return { step: 'request', ...omit(step, 'step') };
		default:
			// Unknown step — pass through as-is
			return { step: v2Name, ...omit(step, 'step') };
	}
}

// ------------------------------------------------------------------
// Per-step rewrite functions
// ------------------------------------------------------------------

function rewriteInstallPlugin(
	step: Record<string, unknown>
): Record<string, unknown> {
	// V1: pluginData or pluginZipFile → V2: source
	const source = step.pluginData ?? step.pluginZipFile ?? step.source;
	const result: Record<string, unknown> = {
		step: 'installPlugin',
		source: convertFieldToDataReference(source),
	};
	const options = step.options as Record<string, unknown> | undefined;
	if (options?.activate !== undefined) {
		result.active = options.activate;
	}
	if (step.ifAlreadyInstalled !== undefined) {
		result.ifAlreadyInstalled = step.ifAlreadyInstalled;
	}
	if (options?.targetFolderName !== undefined) {
		result.targetFolderName = options.targetFolderName;
	}
	return result;
}

function rewriteInstallTheme(
	step: Record<string, unknown>
): Record<string, unknown> {
	// V1: themeData or themeZipFile → V2: source
	const source = step.themeData ?? step.themeZipFile ?? step.source;
	const result: Record<string, unknown> = {
		step: 'installTheme',
		source: convertFieldToDataReference(source),
	};
	const options = step.options as Record<string, unknown> | undefined;
	if (options?.activate !== undefined) {
		result.active = options.activate;
	}
	if (step.ifAlreadyInstalled !== undefined) {
		result.ifAlreadyInstalled = step.ifAlreadyInstalled;
	}
	if (options?.importStarterContent !== undefined) {
		result.importStarterContent = options.importStarterContent;
	}
	if (options?.targetFolderName !== undefined) {
		result.targetFolderName = options.targetFolderName;
	}
	return result;
}

function rewriteActivatePlugin(
	step: Record<string, unknown>
): Record<string, unknown> {
	return {
		step: 'activatePlugin',
		pluginPath: translateWordPressPath(String(step.pluginPath ?? '')),
		...(step.pluginName !== undefined
			? { pluginName: step.pluginName }
			: {}),
	};
}

function rewriteActivateTheme(
	step: Record<string, unknown>
): Record<string, unknown> {
	return {
		step: 'activateTheme',
		themeDirectoryName: step.themeFolderName,
	};
}

function rewriteDefineWpConfigConsts(
	step: Record<string, unknown>
): Record<string, unknown> {
	return {
		step: 'defineConstants',
		constants: step.consts,
	};
}

function rewriteRunPHP(step: Record<string, unknown>): Record<string, unknown> {
	const code = step.code;
	if (typeof code === 'string') {
		return {
			step: 'runPHP',
			code: translateWordPressPathsInPHP(code),
		};
	}
	return { step: 'runPHP', code };
}

function rewriteRunPHPWithOptions(
	step: Record<string, unknown>
): Record<string, unknown> {
	// V1 runPHPWithOptions wraps options in an `options` field
	const options = step.options as Record<string, unknown> | undefined;
	if (!options) {
		return { step: 'runPHP' };
	}
	const result: Record<string, unknown> = {
		step: 'runPHP',
	};
	if (typeof options.code === 'string') {
		result.code = translateWordPressPathsInPHP(options.code);
	} else if (options.code !== undefined) {
		result.code = options.code;
	}
	if (options.env !== undefined) {
		result.env = options.env;
	}
	return result;
}

function rewriteSetSiteOptions(
	step: Record<string, unknown>
): Record<string, unknown> {
	return {
		step: 'setSiteOptions',
		options: step.options,
	};
}

function rewriteWpCLI(
	step: Record<string, unknown>,
	v2Name: string
): Record<string, unknown> {
	return {
		step: v2Name,
		command: step.command,
		...(step.wpCliPath !== undefined ? { wpCliPath: step.wpCliPath } : {}),
	};
}

function rewriteWriteFile(
	step: Record<string, unknown>
): Record<string, unknown> {
	const path = translateWordPressPath(String(step.path ?? ''));
	const data = convertFieldToDataReference(step.data);
	return {
		step: 'writeFiles',
		writeToPath: path,
		data,
	};
}

function rewriteWriteFiles(
	step: Record<string, unknown>
): Record<string, unknown> {
	const writeToPath = translateWordPressPath(String(step.writeToPath ?? ''));
	const filesTree = convertFieldToDataReference(step.filesTree);
	return {
		step: 'writeFiles',
		writeToPath,
		filesTree,
	};
}

function rewriteImportWxr(
	step: Record<string, unknown>
): Record<string, unknown> {
	return {
		step: 'importContent',
		source: convertFieldToDataReference(step.file),
		type: 'wxr',
	};
}

function rewriteImportWordPressFiles(
	step: Record<string, unknown>
): Record<string, unknown> {
	return {
		step: 'writeFiles',
		writeToPath: '/',
		data: convertFieldToDataReference(step.wordPressFilesZip),
		...(step.pathInZip !== undefined ? { pathInZip: step.pathInZip } : {}),
	};
}

function rewriteUnzip(step: Record<string, unknown>): Record<string, unknown> {
	const zipFile = step.zipFile ?? step.zipPath ?? step.source;
	return {
		step: 'unzip',
		source: convertFieldToDataReference(zipFile),
		extractToPath: translateWordPressPath(String(step.extractToPath ?? '')),
	};
}

function rewriteRunSql(step: Record<string, unknown>): Record<string, unknown> {
	return {
		step: 'runSQL',
		source: convertFieldToDataReference(step.sql),
	};
}

function rewriteLogin(step: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {
		step: 'login',
	};
	if (step.username !== undefined) {
		result.username = step.username;
	}
	if (step.password !== undefined) {
		result.password = step.password;
	}
	return result;
}

function rewriteCpMv(step: Record<string, unknown>): Record<string, unknown> {
	return {
		step: step.step as string,
		fromPath: translateWordPressPath(String(step.fromPath ?? '')),
		toPath: translateWordPressPath(String(step.toPath ?? '')),
	};
}

function rewritePathStep(
	step: Record<string, unknown>
): Record<string, unknown> {
	return {
		step: step.step as string,
		path: translateWordPressPath(String(step.path ?? '')),
	};
}

function rewriteImportThemeStarterContent(
	step: Record<string, unknown>
): Record<string, unknown> {
	const result: Record<string, unknown> = {
		step: 'importThemeStarterContent',
	};
	if (step.themeSlug !== undefined) {
		result.themeSlug = step.themeSlug;
	}
	return result;
}

function rewriteUpdateUserMeta(
	step: Record<string, unknown>
): Record<string, unknown> {
	return {
		step: 'updateUserMeta',
		userId: step.userId,
		meta: step.meta,
	};
}

// ------------------------------------------------------------------
// Resource → DataReference conversion
// ------------------------------------------------------------------

/**
 * Checks whether a value is a V1 resource object
 * (has a `resource` property).
 */
function isResourceObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && 'resource' in value;
}

/**
 * Converts a step field value to a V2 data reference.
 * If it's a V1 resource object, converts it; otherwise
 * returns as-is.
 */
function convertFieldToDataReference(value: unknown): unknown {
	if (typeof value === 'string') {
		return value;
	}
	if (isResourceObject(value)) {
		return convertResourceToDataReference(value);
	}
	return value;
}

/**
 * Converts a V1 resource object to a V2 data reference.
 */
function convertResourceToDataReference(
	resource: Record<string, unknown>
): unknown {
	switch (resource.resource) {
		case 'url':
			return resource.url as string;

		case 'literal':
			return {
				filename: resource.name,
				content: resource.contents,
			};

		case 'wordpress.org/plugins':
			return resource.slug as string;

		case 'wordpress.org/themes':
			return resource.slug as string;

		case 'vfs':
			return `site:${translateWordPressPath(
				String(resource.path ?? '')
			)}`;

		case 'bundled':
			return `./${resource.path}`;

		case 'git:directory':
			return convertGitDirectoryReference(resource);

		case 'literal:directory':
			return {
				directoryName: resource.name,
				files: resource.files,
			};

		case 'zip': {
			// Unwrap zip wrapper — convert inner reference
			const inner = resource.inner;
			return convertFieldToDataReference(inner);
		}

		default:
			// Unknown resource — pass through
			return resource;
	}
}

/**
 * Converts a V1 `git:directory` resource to a V2 GitPath.
 */
function convertGitDirectoryReference(
	resource: Record<string, unknown>
): Record<string, unknown> {
	const result: Record<string, unknown> = {
		gitRepository: resource.url,
	};
	if (resource.ref !== undefined) {
		result.ref = resource.ref;
	}
	if (resource.path !== undefined) {
		result.pathInRepository = resource.path;
	}
	return result;
}

// ------------------------------------------------------------------
// Path translation
// ------------------------------------------------------------------

/**
 * Translates `/wordpress/` VFS paths to document-root-relative
 * paths. In V2, paths no longer have the `/wordpress/` prefix.
 */
function translateWordPressPath(path: string): string {
	if (path.startsWith('/wordpress/')) {
		return path.slice('/wordpress'.length);
	}
	if (path.startsWith('wordpress/')) {
		return '/' + path.slice('wordpress/'.length);
	}
	return path;
}

/**
 * Translates `/wordpress/` path literals in PHP code to use
 * `getenv('DOCROOT')`.
 */
function translateWordPressPathsInPHP(code: string): string {
	// Replace '/wordpress/' literal paths in PHP with
	// getenv('DOCROOT') concatenation.
	return code.replace(/\/wordpress\//g, "' . getenv('DOCROOT') . '/");
}

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------

function omit(
	obj: Record<string, unknown>,
	...keys: string[]
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (!keys.includes(key)) {
			result[key] = value;
		}
	}
	return result;
}
