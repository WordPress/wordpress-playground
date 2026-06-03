import type {
	BlueprintV1Declaration,
	BlueprintDeclaration,
	BlueprintBundle,
	StepDefinition,
	BlueprintV1,
	BlueprintV2Declaration,
} from '@wp-playground/client';
import {
	BlueprintReflection,
	isBlueprintBundle,
	resolveRemoteBlueprint,
} from '@wp-playground/client';
import { parseBlueprint, isMcpServerEnabled } from './router';
import { OverlayFilesystem, InMemoryFilesystem } from '@wp-playground/storage';
import { logger } from '@php-wasm/logger';
import { seemsLikeGitRepoUrl } from '@php-wasm/util';
import { decodeBlueprintHash } from './decode-blueprint-hash';
import { getDefaultPhpVersionForWordPress } from '../../wordpress-version-compatibility';
import { GENERATED_GUTENBERG_INSTALLER_MARKER } from '../../gutenberg-preview';

export { decodeBlueprintHash };

export type BlueprintSource =
	| {
			type: 'remote-url';
			url: string;
	  }
	| {
			type: 'inline-string';
	  }
	| {
			type: 'none';
	  }
	| {
			type: 'opfs-site';
	  };

export type ResolvedBlueprint = {
	blueprint: BlueprintV1 | BlueprintV2Declaration | BlueprintBundle;
	source: BlueprintSource;
};

const githubBlobOrRawPathPattern = /^\/([^/]+)\/([^/]+)\/(?:blob|raw)\//;

function normalizeBlueprintUrl(remoteUrl: string): string {
	try {
		const parsedUrl = new URL(remoteUrl);
		if (parsedUrl.hostname !== 'github.com') {
			return remoteUrl;
		}
		const rewrittenPath = parsedUrl.pathname.replace(
			githubBlobOrRawPathPattern,
			'/$1/$2/'
		);
		if (rewrittenPath === parsedUrl.pathname) {
			return remoteUrl;
		}
		parsedUrl.pathname = rewrittenPath;
		parsedUrl.hostname = 'raw.githubusercontent.com';
		return parsedUrl.toString();
	} catch {
		return remoteUrl;
	}
}

export async function resolveBlueprintFromURL(
	url: URL,
	defaultBlueprint?: string
): Promise<ResolvedBlueprint> {
	const query = url.searchParams;
	const fragment = decodeBlueprintHash(url.hash || '#');

	/**
	 * If the URL has no parameters or fragment, and a default blueprint is provided,
	 * use the default blueprint.
	 */
	if (
		window.self === window.top &&
		!query.size &&
		!fragment.length &&
		defaultBlueprint
	) {
		return {
			blueprint: await resolveRemoteBlueprint(defaultBlueprint),
			source: {
				type: 'remote-url',
				url: defaultBlueprint,
			},
		};
	} else if (query.has('blueprint-url')) {
		if (isMcpServerEnabled()) {
			throw new Error(
				`Starting a new Playground from a Blueprint is disabled when the MCP server
				is active to prevent potential prompt injection vulnerabilities.
				Please remove the "blueprint-url" query parameter to proceed or
				disable the MCP server by removing the "mcp-port" query parameter.`
			);
		}
		/*
		 * Support passing blueprints via query parameter, e.g.:
		 * ?blueprint-url=https://example.com/blueprint.json
		 */
		const blueprintUrl = normalizeBlueprintUrl(query.get('blueprint-url')!);
		return {
			blueprint: await resolveRemoteBlueprint(blueprintUrl),
			source: {
				type: 'remote-url',
				url: blueprintUrl,
			},
		};
	} else if (fragment.length) {
		if (isMcpServerEnabled()) {
			throw new Error(
				`Starting a new Playground from a Blueprint is disabled when the MCP server
				is active to prevent potential prompt injection vulnerabilities.
				Please remove the Blueprint hash from your URL or
				disable the MCP server by removing the "mcp-port" query parameter.`
			);
		}
		/*
		 * Support passing blueprints in the URI fragment, e.g.:
		 * /#{"landingPage": "/?p=4"}
		 */
		return {
			blueprint: parseBlueprint(fragment),
			source: {
				type: 'inline-string',
			},
		};
	} else {
		const importWxrQueryArg =
			query.get('import-wxr') || query.get('import-content');

		// This Blueprint is intentionally missing most query args (like login).
		// They are added below to ensure they're also applied to Blueprints passed
		// via the hash fragment (#{...}) or via the `blueprint-url` query param.
		return {
			blueprint: {
				steps: [
					...createQueryPluginInstallSteps(query.getAll('plugin')),
					importWxrQueryArg &&
						/^(http(s?)):\/\//i.test(importWxrQueryArg) &&
						({
							step: 'importWxr',
							file: {
								resource: 'url',
								url: importWxrQueryArg,
							},
						} as StepDefinition),
					query.get('import-site') &&
						/^(http(s?)):\/\//i.test(query.get('import-site')!) &&
						({
							step: 'importWordPressFiles',
							wordPressFilesZip: {
								resource: 'url',
								url: query.get('import-site')!,
							},
						} as StepDefinition),
					...query.getAll('theme').map(
						(theme, index, themes) =>
							({
								step: 'installTheme',
								themeData: {
									resource: 'wordpress.org/themes',
									slug: theme,
								},
								options: {
									// Activate only the last theme in the list.
									activate: index === themes.length - 1,
									onError: 'skip-theme',
								},
								progress: { weight: 2 },
							}) as StepDefinition
					),
				].filter(Boolean),
			},
			source: {
				type: 'none',
			},
		};
	}
}

function createQueryPluginInstallSteps(plugins: string[]): StepDefinition[] {
	return plugins.map(
		(plugin) =>
			({
				step: 'installPlugin',
				pluginData: createPluginDataReference(plugin),
				options: {
					activate: true,
					onError: 'skip-plugin',
				},
			}) as StepDefinition
	);
}

function createPluginDataReference(plugin: string) {
	const normalizedPlugin = plugin.trim().replace(/\/+$/, '');
	if (seemsLikeGitRepoUrl(normalizedPlugin)) {
		return {
			resource: 'zip',
			inner: {
				resource: 'git:directory',
				url: normalizedPlugin,
				ref: 'HEAD',
			},
		};
	}
	if (normalizedPlugin.startsWith('https://')) {
		return {
			resource: 'url',
			url: normalizedPlugin,
		};
	}
	return {
		resource: 'wordpress.org/plugins',
		slug: plugin,
	};
}

export async function applyQueryOverrides(
	blueprint: BlueprintDeclaration | BlueprintBundle,
	query: URLSearchParams
): Promise<BlueprintDeclaration | BlueprintBundle> {
	/**
	 * Allow overriding PHP and WordPress versions defined in a Blueprint
	 * via query params.
	 */
	if (isBlueprintBundle(blueprint)) {
		const reflection = await BlueprintReflection.create(blueprint);
		let blueprintObject =
			reflection.getDeclaration() as BlueprintDeclaration;
		blueprintObject = applyQueryOverridesToDeclaration(
			blueprintObject,
			query
		);
		return new OverlayFilesystem([
			new InMemoryFilesystem({
				'blueprint.json': JSON.stringify(blueprintObject),
			}),
			blueprint,
		]);
	} else {
		return applyQueryOverridesToDeclaration(blueprint, query);
	}
}

function applyQueryOverridesToDeclaration(
	blueprint: BlueprintDeclaration,
	query: URLSearchParams
): BlueprintDeclaration {
	if ((blueprint as BlueprintV2Declaration).version === 2) {
		return applyQueryOverridesToV2Declaration(
			blueprint as BlueprintV2Declaration,
			query
		);
	}
	return applyQueryOverridesToV1Declaration(
		blueprint as BlueprintV1Declaration,
		query
	);
}

function applyQueryOverridesToV1Declaration(
	blueprint: BlueprintV1Declaration,
	query: URLSearchParams
): BlueprintV1Declaration {
	// PHP-only blueprints opt out of WordPress entirely. Skip the WP-bound
	// query overrides — adding `login`, `enableMultisite`, etc. would
	// trip the compile-time guard that rejects WP-only features when
	// `preferredVersions.wp: false` is set.
	if (blueprint.preferredVersions?.wp === false) {
		return blueprint;
	}
	/**
	 * Allow overriding PHP and WordPress versions defined in a Blueprint
	 * via query params.
	 */
	if (!blueprint.preferredVersions) {
		blueprint.preferredVersions = {} as any;
	}
	blueprint.preferredVersions!.wp =
		query.get('wp') || blueprint.preferredVersions!.wp || 'latest';
	blueprint.preferredVersions!.php =
		(query.get('php') as any) ||
		blueprint.preferredVersions!.php ||
		getDefaultPhpVersionForWordPress(blueprint.preferredVersions!.wp);

	// Features
	if (!blueprint.features) {
		blueprint.features = {};
	}

	/**
	 * Networking is enabled by default, so we only need to disable it
	 * if the query param is explicitly set to something other than "yes".
	 */
	if (query.get('networking') && query.get('networking') !== 'yes') {
		blueprint.features['networking'] = false;
	}

	// Language
	if (query.get('language')) {
		if (
			!blueprint?.steps?.find(
				(step) => step && (step as any).step === 'setSiteLanguage'
			)
		) {
			blueprint.steps?.push({
				step: 'setSiteLanguage',
				language: query.get('language')!,
			});
		}
	}

	// Multisite
	if (query.get('multisite') === 'yes') {
		if (
			!blueprint?.steps?.find(
				(step) => step && (step as any).step === 'enableMultisite'
			)
		) {
			blueprint.steps?.push({
				step: 'enableMultisite',
			});
		}
	}

	// Login
	if (query.get('login') !== 'no') {
		blueprint.login = true;
	}

	// Landing page
	if (query.get('url')) {
		blueprint.landingPage = query.get('url')!;
	}

	/*
	 * The 6.3 release includes a caching bug where
	 * registered styles aren't enqueued when they
	 * should be. This isn't present in all environments
	 * but it does here in the Playground. For now,
	 * the fix is to define `WP_DEVELOPMENT_MODE = all`
	 * to bypass the style cache.
	 *
	 * @see https://core.trac.wordpress.org/ticket/59056
	 */
	if (blueprint.preferredVersions?.wp === '6.3') {
		blueprint.steps?.unshift({
			step: 'defineWpConfigConsts',
			consts: {
				WP_DEVELOPMENT_MODE: 'all',
			},
		});
	}

	// Handle WordPress core PR preview
	const coreRef = query.get('core-pr');
	if (coreRef) {
		blueprint.preferredVersions!.wp =
			createCorePrWordPressBuildUrl(coreRef);
	}

	// Handle Gutenberg PR or branch preview
	const gutenbergArtifact = getGutenbergArtifactDetails(query);
	if (gutenbergArtifact) {
		blueprint.steps = blueprint.steps || [];
		blueprint.steps.unshift(
			{
				step: 'mkdir',
				path: '/tmp/gutenberg',
			},
			{
				step: 'writeFile',
				path: '/tmp/gutenberg/artifact.zip',
				data: {
					resource: 'url',
					url: gutenbergArtifact.proxyPath,
					caption: `Downloading Gutenberg ${gutenbergArtifact.refLabel} ${gutenbergArtifact.ref}`,
				},
			},
			/**
			 * GitHub CI artifacts are doubly zipped:
			 *
			 * artifact.zip
			 *    gutenberg.zip
			 *       gutenberg.php
			 *       ... other files ...
			 *
			 * This step extracts the inner zip file so that we get
			 * access directly to gutenberg.zip and can use it to
			 * install the plugin.
			 */
			{
				step: 'unzip',
				zipPath: '/tmp/gutenberg/artifact.zip',
				extractToPath: '/tmp/gutenberg',
			},
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'vfs',
					path: '/tmp/gutenberg/gutenberg.zip',
				},
			}
		);
	}

	return blueprint;
}

function applyQueryOverridesToV2Declaration(
	blueprint: BlueprintV2Declaration,
	query: URLSearchParams
): BlueprintV2Declaration {
	const next = {
		...blueprint,
		applicationOptions: blueprint.applicationOptions
			? { ...blueprint.applicationOptions }
			: undefined,
		additionalStepsAfterExecution: [
			...(blueprint.additionalStepsAfterExecution || []),
		],
	} as BlueprintV2Declaration;
	const playgroundOptions = ensureV2PlaygroundApplicationOptions(next);

	if (query.get('wp')) {
		next.wordpressVersion = query.get('wp') as any;
	} else if (next.wordpressVersion === undefined) {
		next.wordpressVersion = 'latest';
	}
	if (query.get('php')) {
		next.phpVersion = query.get('php') as any;
	} else if (next.phpVersion === undefined) {
		next.phpVersion = getDefaultPhpVersionForWordPress(
			typeof next.wordpressVersion === 'string'
				? next.wordpressVersion
				: undefined
		);
	}
	if (query.has('networking')) {
		playgroundOptions.networkAccess = query.get('networking') === 'yes';
	} else if (playgroundOptions.networkAccess === undefined) {
		playgroundOptions.networkAccess = true;
	}
	if (query.get('language')) {
		appendV2StepIfMissing(next, 'setSiteLanguage', {
			step: 'setSiteLanguage',
			language: query.get('language')!,
		});
	}
	if (query.get('multisite') === 'yes') {
		appendV2StepIfMissing(next, 'enableMultisite', {
			step: 'enableMultisite',
		});
	}
	if (query.has('login') || playgroundOptions.login === undefined) {
		playgroundOptions.login = query.get('login') !== 'no';
	}
	if (query.get('url')) {
		playgroundOptions.landingPage = query.get('url')!;
	}
	appendV2QueryPluginSteps(next, query.getAll('plugin'));
	appendV2QueryThemeSteps(next, query.getAll('theme'));
	appendV2QueryWxrImportStep(
		next,
		query.get('import-wxr') || query.get('import-content')
	);
	if (query.get('import-site')) {
		throw new Error(
			'The import-site Query API parameter is not supported with Blueprint v2 declarations yet.'
		);
	}
	if (next.wordpressVersion === '6.3') {
		prependV2StepIfMissing(next, 'defineConstants', {
			step: 'defineConstants',
			constants: {
				WP_DEVELOPMENT_MODE: 'all',
			},
		});
	}

	const coreRef = query.get('core-pr');
	if (coreRef) {
		next.wordpressVersion = createCorePrWordPressBuildUrl(coreRef) as any;
	}

	const gutenbergArtifact = getGutenbergArtifactDetails(query);
	if (gutenbergArtifact) {
		if (!query.has('networking')) {
			playgroundOptions.networkAccess = true;
		}
		prependV2StepsIfMissing(
			next,
			(step) =>
				step?.step === 'runPHP' &&
				step?.env?.[GENERATED_GUTENBERG_INSTALLER_MARKER] === '1',
			[
				{
					step: 'runPHP',
					code: {
						filename: 'install-gutenberg.php',
						content: createGutenbergInstallerPHP(gutenbergArtifact),
					},
					env: {
						[GENERATED_GUTENBERG_INSTALLER_MARKER]: '1',
					},
				},
			]
		);
	}

	return next;
}

function appendV2QueryPluginSteps(
	blueprint: BlueprintV2Declaration,
	plugins: string[]
) {
	for (const plugin of plugins) {
		blueprint.additionalStepsAfterExecution?.push({
			step: 'installPlugin',
			source: createV2PluginDataReference(plugin),
			active: true,
			onError: 'skip-plugin',
		} as any);
	}
}

function createV2PluginDataReference(plugin: string) {
	const normalizedPlugin = plugin.trim().replace(/\/+$/, '');
	if (seemsLikeGitRepoUrl(normalizedPlugin)) {
		return {
			gitRepository: normalizedPlugin,
			ref: 'HEAD',
		};
	}
	return normalizedPlugin;
}

function appendV2QueryThemeSteps(
	blueprint: BlueprintV2Declaration,
	themes: string[]
) {
	for (const [index, theme] of themes.entries()) {
		blueprint.additionalStepsAfterExecution?.push({
			step: 'installTheme',
			source: theme,
			active: index === themes.length - 1,
			onError: 'skip-theme',
		} as any);
	}
}

function appendV2QueryWxrImportStep(
	blueprint: BlueprintV2Declaration,
	importWxrQueryArg: string | null
) {
	if (importWxrQueryArg && /^(http(s?)):\/\//i.test(importWxrQueryArg)) {
		blueprint.additionalStepsAfterExecution?.push({
			step: 'importContent',
			content: [
				{
					type: 'wxr',
					source: importWxrQueryArg,
					authorsMode: 'default-author',
					defaultAuthorUsername: 'admin',
					importComments: true,
				},
			],
		} as any);
	}
}

type GutenbergArtifactDetails = {
	ref: string;
	refType: 'pr' | 'branch';
	refLabel: 'PR' | 'branch';
	proxyPath: string;
	proxyUrl: string;
};

function getGutenbergArtifactDetails(
	query: URLSearchParams
): GutenbergArtifactDetails | undefined {
	const ref = query.get('gutenberg-pr') || query.get('gutenberg-branch');
	if (!ref) {
		return undefined;
	}
	const refType = query.has('gutenberg-pr') ? 'pr' : 'branch';
	const refLabel = query.has('gutenberg-pr') ? 'PR' : 'branch';
	const proxyPath =
		'/plugin-proxy.php?org=WordPress&repo=gutenberg&workflow=Build%20Gutenberg%20Plugin%20Zip&artifact=gutenberg-plugin' +
		`&${refType}=${encodeURIComponent(ref)}`;
	return {
		ref,
		refType,
		refLabel,
		proxyPath,
		proxyUrl: resolveAgainstPlaygroundOrigin(proxyPath),
	};
}

function createCorePrWordPressBuildUrl(coreRef: string) {
	if (!/^\d+$/.test(coreRef)) {
		throw new Error(
			'The core-pr Query API parameter must be a WordPress pull request number.'
		);
	}
	const params = new URLSearchParams({
		org: 'WordPress',
		repo: 'wordpress-develop',
		workflow: 'Test Build Processes',
		artifact: `wordpress-build-${coreRef}`,
		pr: coreRef,
	});
	return resolveAgainstPlaygroundOrigin(
		`/plugin-proxy.php?${params.toString().replace(/\+/g, '%20')}`
	);
}

function resolveAgainstPlaygroundOrigin(path: string) {
	const origin =
		typeof globalThis.location !== 'undefined'
			? globalThis.location.origin
			: 'https://playground.wordpress.net';
	return new URL(path, origin).toString();
}

function createGutenbergInstallerPHP({
	ref,
	refLabel,
	proxyUrl,
}: GutenbergArtifactDetails) {
	return `<?php
require_once '/wordpress/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

WP_Filesystem();

$artifact_url = ${JSON.stringify(proxyUrl)};
$artifact_label = ${JSON.stringify(`Gutenberg ${refLabel} ${ref}`)};
$artifact_zip = null;
$workdir = null;

if (!function_exists('blueprint_delete_directory')) {
	function blueprint_delete_directory(string $directory): void {
		if (!is_dir($directory)) {
			return;
		}
		$iterator = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS),
			RecursiveIteratorIterator::CHILD_FIRST
		);
		foreach ($iterator as $file) {
			if ($file->isDir()) {
				@rmdir($file->getPathname());
			} else {
				@unlink($file->getPathname());
			}
		}
		@rmdir($directory);
	}
}

try {
	$artifact_zip = download_url($artifact_url);
	if (is_wp_error($artifact_zip)) {
		throw new Exception('Could not download ' . $artifact_label . ': ' . $artifact_zip->get_error_message());
	}

	$workdir = trailingslashit(get_temp_dir()) . 'playground-gutenberg-' . wp_generate_uuid4();
	if (!wp_mkdir_p($workdir)) {
		throw new Exception('Could not create a temporary directory for ' . $artifact_label . '.');
	}

	$unzipped = unzip_file($artifact_zip, $workdir);
	@unlink($artifact_zip);
	$artifact_zip = null;
	if (is_wp_error($unzipped)) {
		throw new Exception('Could not extract ' . $artifact_label . ': ' . $unzipped->get_error_message());
	}

	$plugin_zip = $workdir . '/gutenberg.zip';
	if (!file_exists($plugin_zip)) {
		$iterator = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator($workdir, FilesystemIterator::SKIP_DOTS)
		);
		foreach ($iterator as $file) {
			if ($file->getFilename() === 'gutenberg.zip') {
				$plugin_zip = $file->getPathname();
				break;
			}
		}
	}
	if (!file_exists($plugin_zip)) {
		throw new Exception('Could not find gutenberg.zip inside the ' . $artifact_label . ' artifact.');
	}

	$skin = new Automatic_Upgrader_Skin();
	$upgrader = new Plugin_Upgrader($skin);
	$installed = $upgrader->install($plugin_zip);
	if (is_wp_error($installed)) {
		throw new Exception('Could not install ' . $artifact_label . ': ' . $installed->get_error_message());
	}
	if ($installed === false) {
		$errors = $skin->get_errors();
		$message = is_wp_error($errors) && $errors->has_errors() ? $errors->get_error_message() : 'unknown installer error';
		throw new Exception('Could not install ' . $artifact_label . ': ' . $message);
	}

	$activated = activate_plugin('gutenberg/gutenberg.php');
	if (is_wp_error($activated)) {
		throw new Exception('Could not activate ' . $artifact_label . ': ' . $activated->get_error_message());
	}
} finally {
	if (is_string($artifact_zip) && file_exists($artifact_zip)) {
		@unlink($artifact_zip);
	}
	if (is_string($workdir) && is_dir($workdir)) {
		blueprint_delete_directory($workdir);
	}
}
`;
}

function ensureV2PlaygroundApplicationOptions(
	blueprint: BlueprintV2Declaration
) {
	const applicationOptions = {
		...(blueprint.applicationOptions || {}),
	} as NonNullable<BlueprintV2Declaration['applicationOptions']>;
	const playgroundOptions = {
		...(applicationOptions['wordpress-playground'] || {}),
	};
	applicationOptions['wordpress-playground'] = playgroundOptions;
	blueprint.applicationOptions = applicationOptions;
	return playgroundOptions;
}

function appendV2StepIfMissing(
	blueprint: BlueprintV2Declaration,
	stepName: string,
	step: Record<string, unknown>
) {
	if (
		!blueprint.additionalStepsAfterExecution?.some(
			(existingStep: any) => existingStep?.step === stepName
		)
	) {
		blueprint.additionalStepsAfterExecution = [
			...(blueprint.additionalStepsAfterExecution || []),
			step as any,
		];
	}
}

function prependV2StepIfMissing(
	blueprint: BlueprintV2Declaration,
	stepName: string,
	step: Record<string, unknown>
) {
	prependV2StepsIfMissing(
		blueprint,
		(existingStep) => existingStep?.step === stepName,
		[step]
	);
}

function prependV2StepsIfMissing(
	blueprint: BlueprintV2Declaration,
	matchesExistingStep: (step: any) => boolean,
	steps: Record<string, unknown>[]
) {
	if (!blueprint.additionalStepsAfterExecution?.some(matchesExistingStep)) {
		blueprint.additionalStepsAfterExecution = [
			...(steps as any[]),
			...(blueprint.additionalStepsAfterExecution || []),
		];
	}
}
