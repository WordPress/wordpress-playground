import type { ProgressTracker } from '@php-wasm/progress';
import {
	type PlaygroundClient,
	type StartPlaygroundOptions,
	compileBlueprintV1,
	isBlueprintBundle,
	runBlueprintV1Steps,
	resolveRuntimeConfiguration,
	BlueprintReflection,
} from '.';
import { collectPhpLogs, logger } from '@php-wasm/logger';
import { consumeAPI } from '@php-wasm/universal';
import type { PHPWebExtension } from '@php-wasm/web';

export class BlueprintsV1Handler {
	private readonly options: StartPlaygroundOptions;

	constructor(options: StartPlaygroundOptions) {
		this.options = options;
	}

	async bootPlayground(
		iframe: HTMLIFrameElement,
		progressTracker: ProgressTracker
	) {
		const {
			onBlueprintValidated,
			onBlueprintStepCompleted,
			corsProxy,
			gitAdditionalHeadersCallback,
			mounts,
			sapiName,
			scope,
			shouldInstallWordPress,
			shouldBootWordPress,
			sqliteDriverVersion,
			wordpressInstallMode,
			onClientConnected,
			pathAliases,
		} = this.options;
		const executionProgress = progressTracker!.stage(0.5);
		const downloadProgress = progressTracker!.stage();

		// Set a default blueprint if none is provided.
		const blueprint = this.options.blueprint || {};

		// Connect the Comlink API client to the remote worker,
		// boot the playground, and run the blueprint steps.
		const playground = consumeAPI<PlaygroundClient>(
			iframe.contentWindow!,
			iframe.ownerDocument!.defaultView!
		) as PlaygroundClient;
		await playground.isConnected();
		progressTracker.pipe(playground);

		const runtimeConfiguration =
			await resolveRuntimeConfiguration(blueprint);
		const extensions: PHPWebExtension[] = runtimeConfiguration.intl
			? ['intl']
			: [];
		extensions.push(...(this.options.extensions || []));
		await playground.onDownloadProgress(downloadProgress.loadingListener);
		// Blueprint's `preferredVersions.wp: false` is the declarative way to
		// opt out of WordPress. Bundles carry their declaration inside a JSON
		// file we haven't read here, so we only honor the flag for inline
		// declarations. If the caller also requested WordPress explicitly and
		// the two disagree, refuse to silently pick a winner.
		const declarativeOptOut =
			!isBlueprintBundle(blueprint) &&
			blueprint.preferredVersions?.wp === false;
		const bootWordPress = shouldBootWordPress ?? !declarativeOptOut;
		const resolvedWordPressInstallMode = getWordPressInstallMode({
			bootWordPress,
			shouldInstallWordPress,
			wordpressInstallMode,
		});
		if (
			wordpressWasRequestedExplicitly({
				declarativeOptOut,
				resolvedWordPressInstallMode,
				shouldBootWordPress,
				shouldInstallWordPress,
			})
		) {
			throw new Error(
				'Conflicting options: WordPress install or boot was requested, ' +
					'but the Blueprint sets ' +
					'`preferredVersions.wp: false`. Pick one.'
			);
		}
		if (
			!bootWordPress &&
			resolvedWordPressInstallMode !== 'do-not-attempt-installing'
		) {
			throw new Error(
				'Conflicting options: WordPress installation was requested, ' +
					'but WordPress boot was disabled. Pick one.'
			);
		}
		await playground.boot({
			mounts,
			sapiName,
			scope: scope ?? Math.random().toFixed(16),
			shouldBootWordPress: bootWordPress,
			wordpressInstallMode: resolvedWordPressInstallMode,
			phpVersion: runtimeConfiguration.phpVersion,
			wpVersion: runtimeConfiguration.wpVersion,
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

		const reflection = await BlueprintReflection.create(blueprint);
		if (reflection.getVersion() === 1) {
			const compiled = await compileBlueprintV1(blueprint, {
				progress: executionProgress,
				onStepCompleted: onBlueprintStepCompleted,
				onBlueprintValidated,
				corsProxy,
				gitAdditionalHeadersCallback,
			});
			await runBlueprintV1Steps(compiled, playground);
		}

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
		const wpMajor = parseFloat(runtimeConfiguration.wpVersion);
		const isLegacyWpVersion = Number.isFinite(wpMajor) && wpMajor < 5.1;
		// Prefetch only makes sense when WordPress is actually installed.
		// In PHP-only mode (`preferredVersions.wp: false`), wp-load.php
		// doesn't exist and the prefetch crashes the runtime.
		if (
			runtimeConfiguration.networking &&
			!isLegacyWpVersion &&
			resolvedWordPressInstallMode === 'download-and-install'
		) {
			await playground.prefetchUpdateChecks();
		}

		return playground;
	}
}

type WordPressInstallMode = NonNullable<
	StartPlaygroundOptions['wordpressInstallMode']
>;

function getWordPressInstallMode({
	bootWordPress,
	shouldInstallWordPress,
	wordpressInstallMode,
}: {
	bootWordPress: boolean;
	shouldInstallWordPress?: boolean;
	wordpressInstallMode?: WordPressInstallMode;
}): WordPressInstallMode {
	if (wordpressInstallMode) {
		return wordpressInstallMode;
	}
	if (shouldInstallWordPress === true) {
		return 'download-and-install';
	}
	if (!bootWordPress) {
		return 'do-not-attempt-installing';
	}
	if (shouldInstallWordPress === false) {
		return 'install-from-existing-files-if-needed';
	}
	return 'download-and-install';
}

function wordpressWasRequestedExplicitly({
	declarativeOptOut,
	resolvedWordPressInstallMode,
	shouldBootWordPress,
	shouldInstallWordPress,
}: {
	declarativeOptOut: boolean;
	resolvedWordPressInstallMode: WordPressInstallMode;
	shouldBootWordPress?: boolean;
	shouldInstallWordPress?: boolean;
}) {
	return (
		declarativeOptOut &&
		(shouldBootWordPress === true ||
			shouldInstallWordPress === true ||
			resolvedWordPressInstallMode !== 'do-not-attempt-installing')
	);
}
