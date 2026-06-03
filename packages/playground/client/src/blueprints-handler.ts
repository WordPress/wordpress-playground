import type { ProgressTracker } from '@php-wasm/progress';
import { collectPhpLogs, logger } from '@php-wasm/logger';
import { consumeAPI } from '@php-wasm/universal';
import type { PHPWebExtension } from '@php-wasm/web';
import {
	BlueprintReflection,
	compileBlueprintForExecution,
	hasBlueprintV2WordPressZipReference,
	resolveBlueprintV2WordPressSource,
	resolveRuntimeConfiguration,
} from '@wp-playground/blueprints';
import type {
	Blueprint,
	BlueprintV1Declaration,
	CompiledBlueprintForExecution,
} from '@wp-playground/blueprints';
import type { PlaygroundClient, StartPlaygroundOptions } from '.';

type WordPressInstallMode = NonNullable<
	StartPlaygroundOptions['wordpressInstallMode']
>;

/**
 * Boots Playground and runs Blueprint declarations on the standard worker.
 *
 * Blueprint format differences are handled by the Blueprints package. This
 * class owns the browser-specific lifecycle: iframe connection, runtime boot,
 * log forwarding, and update prefetching for the legacy v1 path.
 */
export class BlueprintsHandler {
	private readonly options: StartPlaygroundOptions;

	constructor(options: StartPlaygroundOptions) {
		this.options = options;
	}

	/**
	 * Connects to the remote iframe, boots PHP/WordPress, and runs compiled steps.
	 *
	 * Blueprint compilation happens before boot because v2 declarations can
	 * change the PHP version, WordPress version, and WordPress source that the
	 * remote worker must start with.
	 */
	async bootPlayground(
		iframe: HTMLIFrameElement,
		progressTracker: ProgressTracker
	) {
		const {
			onBlueprintValidated,
			onBlueprintStepCompleted,
			onClientConnected,
			corsProxy,
			gitAdditionalHeadersCallback,
			mounts,
			sapiName,
			scope,
			shouldInstallWordPress,
			sqliteDriverVersion,
			wordpressInstallMode,
			pathAliases,
		} = this.options;
		const executionProgress = progressTracker.stage(0.5);
		const downloadProgress = progressTracker.stage();
		const executionPath = this.options.experimentalBlueprintsV2Runner
			? 'v2'
			: undefined;
		const blueprint =
			this.options.blueprint ||
			(executionPath === 'v2' ? { version: 2 } : {});

		const playground = consumeAPI<PlaygroundClient>(
			iframe.contentWindow!,
			iframe.ownerDocument!.defaultView!
		) as PlaygroundClient;
		await playground.isConnected();
		progressTracker.pipe(playground);

		const compiled = await compileBlueprintForExecution(blueprint, {
			executionPath,
			progress: executionProgress,
			onStepCompleted: onBlueprintStepCompleted,
			onBlueprintValidated,
			corsProxy,
			gitAdditionalHeadersCallback,
		});
		const runtimeConfiguration = await resolveRuntimeConfiguration(
			compiled.version === 2 ? compiled.declaration : blueprint
		);
		const v1PhpOnlyMode = await compiledBlueprintRequestsPhpOnlyMode(
			blueprint,
			compiled
		);
		const resolvedWordPressInstallMode =
			resolveWordPressInstallModeOrThrow({
				v1PhpOnlyMode,
				shouldInstallWordPress,
				wordpressInstallMode,
			});

		let wpVersion = runtimeConfiguration.wpVersion;
		let wordPressZip: ArrayBuffer | undefined;
		if (compiled.version === 2) {
			if (
				(await hasBlueprintV2WordPressZipReference(
					compiled.declaration
				)) &&
				resolvedWordPressInstallMode !== 'download-and-install'
			) {
				throw new Error(
					'Blueprint v2 wordpressVersion ZIP references can only be used when creating a new site.'
				);
			}
			const wordpressSource = await resolveBlueprintV2WordPressSource(
				blueprint,
				{
					corsProxy,
					gitAdditionalHeadersCallback,
				}
			);
			wpVersion = wordpressSource.wpVersion;
			wordPressZip = await wordpressSource.wordPressZip?.arrayBuffer();
		}

		const extensions: PHPWebExtension[] = runtimeConfiguration.intl
			? ['intl']
			: [];
		extensions.push(...(this.options.extensions || []));

		await playground.onDownloadProgress(downloadProgress.loadingListener);
		await playground.boot({
			mounts,
			sapiName,
			scope: scope ?? Math.random().toFixed(16),
			wordpressInstallMode: resolvedWordPressInstallMode,
			phpVersion: runtimeConfiguration.phpVersion,
			wpVersion,
			wordPressZip,
			extensions,
			withNetworking: runtimeConfiguration.networking,
			corsProxyUrl: corsProxy,
			sqliteDriverVersion,
			pathAliases,
		});
		await playground.isReady();
		downloadProgress.finish();

		collectPhpLogs(logger, playground);
		onClientConnected?.(playground);

		await compiled.run(playground);

		if (
			compiled.version === 1 &&
			shouldPrefetchUpdateChecks(
				runtimeConfiguration.wpVersion,
				runtimeConfiguration.networking,
				resolvedWordPressInstallMode
			)
		) {
			await playground.prefetchUpdateChecks();
		}

		return playground;
	}
}

/**
 * Detects the v1 PHP-only mode before the browser worker decides how to boot.
 *
 * Use the compiled v1 declaration when available so bundles are handled the
 * same way as plain JSON. When callers force v1 declarations through v2
 * lowering, inspect the original input before the private v1 compatibility
 * marker is dropped.
 */
async function compiledBlueprintRequestsPhpOnlyMode(
	blueprint: Blueprint,
	compiled: CompiledBlueprintForExecution
) {
	if (compiled.version === 1) {
		return compiled.declaration.preferredVersions?.wp === false;
	}

	if (compiled.version === 2) {
		const reflection = await BlueprintReflection.create(blueprint);
		return (
			reflection.getVersion() === 1 &&
			(reflection.getDeclaration() as BlueprintV1Declaration)
				.preferredVersions?.wp === false
		);
	}

	return false;
}

function resolveWordPressInstallModeOrThrow({
	v1PhpOnlyMode,
	shouldInstallWordPress,
	wordpressInstallMode,
}: {
	v1PhpOnlyMode: boolean;
	shouldInstallWordPress: StartPlaygroundOptions['shouldInstallWordPress'];
	wordpressInstallMode: StartPlaygroundOptions['wordpressInstallMode'];
}): WordPressInstallMode {
	const resolvedWordPressInstallMode: WordPressInstallMode =
		wordpressInstallMode ??
		(v1PhpOnlyMode
			? 'do-not-attempt-installing'
			: shouldInstallWordPress === false
				? 'install-from-existing-files-if-needed'
				: 'download-and-install');
	if (
		v1PhpOnlyMode &&
		(shouldInstallWordPress === true ||
			(wordpressInstallMode !== undefined &&
				wordpressInstallMode !== 'do-not-attempt-installing'))
	) {
		throw new Error(
			'Conflicting options: WordPress was requested, ' +
				'but the Blueprint sets ' +
				'`preferredVersions.wp: false`. Pick one.'
		);
	}
	return resolvedWordPressInstallMode;
}

function shouldPrefetchUpdateChecks(
	wpVersion: string,
	networking: boolean,
	wordpressInstallMode: WordPressInstallMode
) {
	/**
	 * Pre-fetch WordPress update checks to speed up the initial wp-admin load.
	 * Skip for old WordPress versions — the functions called by prefetch
	 * (wp_check_php_version, wp_update_plugins, etc.) don't exist or crash
	 * on legacy WP, and the resulting PHP errors create noise. WP 5.0
	 * (Gutenberg 1.0) also crashes the runtime with exit code 255 inside
	 * prefetchUpdateChecks when using the modern SQLite driver, so extend
	 * the skip range up to (but not including) WP 5.1.
	 *
	 * parseFloat extracts the major version from strings like "6.8",
	 * "4.9.26", etc. Non-numeric values like "nightly" or "trunk"
	 * produce NaN, which Number.isFinite rejects — those fall
	 * through to enabling prefetch (correct for dev builds).
	 *
	 * @see https://github.com/WordPress/wordpress-playground/pull/2295
	 */
	const wpMajor = parseFloat(wpVersion);
	const isLegacyWpVersion = Number.isFinite(wpMajor) && wpMajor < 5.1;
	return (
		networking &&
		!isLegacyWpVersion &&
		wordpressInstallMode === 'download-and-install'
	);
}
