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
		const resolvedWordPressInstallMode: WordPressInstallMode =
			wordpressInstallMode ??
			(declarativeOptOut
				? 'do-not-attempt-installing'
				: shouldInstallWordPress === false
					? 'install-from-existing-files-if-needed'
					: 'download-and-install');
		if (
			declarativeOptOut &&
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
		await playground.boot({
			mounts,
			sapiName,
			scope: scope ?? Math.random().toFixed(16),
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

		if (
			shouldPrefetchUpdateChecks(
				runtimeConfiguration,
				resolvedWordPressInstallMode
			)
		) {
			if (isWpAdminLandingPage(blueprint)) {
				await playground.prefetchUpdateChecks();
			} else {
				scheduleUpdateChecksPrefetch(playground);
			}
		}

		return playground;
	}
}

type WordPressInstallMode = NonNullable<
	StartPlaygroundOptions['wordpressInstallMode']
>;

function shouldPrefetchUpdateChecks(
	runtimeConfiguration: Awaited<
		ReturnType<typeof resolveRuntimeConfiguration>
	>,
	wordpressInstallMode: WordPressInstallMode
) {
	// WP <5.1 lacks or crashes inside functions used by prefetchUpdateChecks().
	const wpMajor = parseFloat(runtimeConfiguration.wpVersion);
	const isLegacyWpVersion = Number.isFinite(wpMajor) && wpMajor < 5.1;
	return (
		runtimeConfiguration.networking &&
		!isLegacyWpVersion &&
		wordpressInstallMode === 'download-and-install'
	);
}

function isWpAdminLandingPage(blueprint: StartPlaygroundOptions['blueprint']) {
	if (!blueprint || isBlueprintBundle(blueprint) || !blueprint.landingPage) {
		return false;
	}
	try {
		return new URL(
			blueprint.landingPage,
			'http://playground.local'
		).pathname.startsWith('/wp-admin');
	} catch {
		return blueprint.landingPage.startsWith('/wp-admin');
	}
}

function scheduleUpdateChecksPrefetch(playground: PlaygroundClient) {
	const prefetch = () => {
		playground.prefetchUpdateChecks().catch((error) => {
			logger.warn('Failed to prefetch WordPress update checks', error);
		});
	};
	const requestIdleCallback = (globalThis as any).requestIdleCallback as
		| ((callback: () => void, options?: { timeout: number }) => void)
		| undefined;
	if (requestIdleCallback) {
		requestIdleCallback(prefetch, { timeout: 5000 });
	} else {
		setTimeout(prefetch, 0);
	}
}
