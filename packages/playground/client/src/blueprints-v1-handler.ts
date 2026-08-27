import type { ProgressTracker } from '@php-wasm/progress';
import {
	type BlueprintV1,
	type BlueprintV1Declaration,
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
import { formatBytes } from '@php-wasm/util';
import type { BootProgressEvent } from '@wp-playground/remote';

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
			disableProgressBar,
			detailedProgressCaptions,
		} = this.options;
		const setProgressCaption = detailedProgressCaptions
			? (caption: string) => progressTracker.setCaption(caption)
			: () => {};
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
		setProgressCaption('Waiting for remote Playground runtime');
		await playground.isConnected();
		setProgressCaption('Resolving Playground runtime versions');
		if (!disableProgressBar) {
			progressTracker.pipe(playground);
		}

		const runtimeConfiguration =
			await resolveRuntimeConfiguration(blueprint);
		const extensions: PHPWebExtension[] = runtimeConfiguration.intl
			? ['intl']
			: [];
		extensions.push(...(this.options.extensions || []));
		let runtimeDownload: RuntimeDownloadProgress | undefined;
		let runtimeDownloadHeartbeat:
			| ReturnType<typeof setInterval>
			| undefined;
		const stopRuntimeDownloadHeartbeat = () => {
			if (runtimeDownloadHeartbeat) {
				clearInterval(runtimeDownloadHeartbeat);
				runtimeDownloadHeartbeat = undefined;
			}
		};
		const ensureRuntimeDownloadHeartbeat = () => {
			if (runtimeDownloadHeartbeat || !detailedProgressCaptions) {
				return;
			}
			runtimeDownloadHeartbeat = setInterval(() => {
				if (
					!runtimeDownload ||
					runtimeDownload.loaded >= runtimeDownload.total
				) {
					return;
				}
				const stalledForMs = Date.now() - runtimeDownload.updatedAt;
				if (stalledForMs < 5000) {
					return;
				}
				setProgressCaption(
					formatRuntimeDownloadCaption(
						runtimeDownload.label,
						runtimeDownload.loaded,
						runtimeDownload.total,
						stalledForMs
					)
				);
			}, 1000);
		};
		await playground.onDownloadProgress((event: any) => {
			downloadProgress.loadingListener(event);
			const {
				loaded,
				total,
				fileName,
				fileLoaded = loaded,
				fileTotal = total,
			} = event.detail || {};
			if (
				typeof loaded !== 'number' ||
				typeof total !== 'number' ||
				total <= 0
			) {
				setProgressCaption(getDownloadLabel(fileName));
				return;
			}
			runtimeDownload = {
				label: getDownloadLabel(fileName),
				loaded: fileLoaded,
				total: fileTotal,
				updatedAt: Date.now(),
			};
			if (loaded >= total) {
				stopRuntimeDownloadHeartbeat();
				setProgressCaption(
					getCompletedDownloadCaption(runtimeDownload.label, total)
				);
				return;
			}
			ensureRuntimeDownloadHeartbeat();
			setProgressCaption(
				formatRuntimeDownloadCaption(
					runtimeDownload.label,
					runtimeDownload.loaded,
					runtimeDownload.total,
					0
				)
			);
		});
		if (detailedProgressCaptions) {
			await playground.addEventListener('boot.progress', (event) => {
				setProgressCaption((event as BootProgressEvent).caption);
			});
		}
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
		try {
			setProgressCaption('Booting PHP and WordPress');
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
			setProgressCaption('Waiting for WordPress to be ready');
			await playground.isReady();
			downloadProgress.finish();
		} finally {
			stopRuntimeDownloadHeartbeat();
		}

		setProgressCaption('Connecting Playground client');
		collectPhpLogs(logger, playground);
		onClientConnected?.(playground);

		setProgressCaption('Preparing blueprint steps');
		const reflection = await BlueprintReflection.create(blueprint);
		if (reflection.getVersion() === 1) {
			const compiled = await compileBlueprintV1(blueprint, {
				progress: executionProgress,
				onStepCompleted: onBlueprintStepCompleted,
				onBlueprintValidated,
				corsProxy,
				gitAdditionalHeadersCallback,
			});
			setProgressCaption('Running blueprint steps');
			await runBlueprintV1Steps(compiled, playground);
		}

		/**
		 * Pre-fetch WordPress update checks to speed up the initial wp-admin load.
		 *
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
		 * Prefetch only makes sense when WordPress is actually installed because
		 * prefetchUpdateChecks() executes PHP that requires wp-load.php and calls
		 * WordPress update-check APIs. In PHP-only mode
		 * (`preferredVersions.wp: false`), wp-load.php doesn't exist and the
		 * prefetch crashes the runtime.
		 *
		 * @see https://github.com/WordPress/wordpress-playground/pull/2295
		 */
		const wpMajor = parseFloat(runtimeConfiguration.wpVersion);
		const isLegacyWpVersion = Number.isFinite(wpMajor) && wpMajor < 5.1;
		const shouldPrefetchUpdateChecks =
			runtimeConfiguration.networking &&
			!isLegacyWpVersion &&
			resolvedWordPressInstallMode === 'download-and-install';

		if (shouldPrefetchUpdateChecks) {
			/**
			 * Only wait for the prefetch results if the initial landingPage is wp-admin.
			 * In all other cases, schedule the pre-fetch in idle time as awaiting it
			 * would slow down the initial page load.
			 */
			if (await isWpAdminLandingPage(blueprint)) {
				await playground.prefetchUpdateChecks();
			} else {
				/**
				 * Keeps the prefetch outside the frontend boot critical path.
				 */
				const prefetch = () => playground.prefetchUpdateChecks();
				if (globalThis.requestIdleCallback) {
					globalThis.requestIdleCallback(prefetch, { timeout: 5000 });
				} else {
					setTimeout(prefetch, 0);
				}
			}
		}

		return playground;
	}
}

/**
 * Checks if the landing page defined in the blueprint or bundle is
 * inside wp-admin.
 */
async function isWpAdminLandingPage(blueprint: BlueprintV1): Promise<boolean> {
	if (!blueprint) {
		return false;
	}
	let blueprintDeclaration: BlueprintV1Declaration | undefined = undefined;
	if (isBlueprintBundle(blueprint)) {
		const blueprintResult = await blueprint.read('/blueprint.json');
		const blueprintJson = await blueprintResult.text();
		blueprint = JSON.parse(blueprintJson) as any;
		blueprintDeclaration = blueprint as BlueprintV1Declaration;
	} else {
		blueprintDeclaration = blueprint;
	}

	const landingPage = blueprintDeclaration.landingPage;
	if (!landingPage) {
		return false;
	}

	let landingPathname: string;
	try {
		landingPathname = new URL(landingPage, 'http://playground.local')
			.pathname;
	} catch {
		return false;
	}
	return (
		landingPathname === '/wp-admin' ||
		landingPathname.startsWith('/wp-admin/')
	);
}

type WordPressInstallMode = NonNullable<
	StartPlaygroundOptions['wordpressInstallMode']
>;

interface RuntimeDownloadProgress {
	label: string;
	loaded: number;
	total: number;
	updatedAt: number;
}

/**
 * Keep these short: the Personal WP progress card is ~400px wide and the
 * percentage is rendered next to the caption, so it is not repeated here.
 */
function formatRuntimeDownloadCaption(
	label: string,
	loaded: number,
	total: number,
	stalledForMs: number
): string {
	const stalledSuffix =
		stalledForMs >= 5000
			? ` – stalled ${Math.floor(stalledForMs / 1000)}s, retrying`
			: '';
	return `${label} (${formatBytes(loaded)} of ${formatBytes(total)})${stalledSuffix}`;
}

function getDownloadLabel(fileName?: string): string {
	if (!fileName) {
		return 'Downloading files';
	}
	if (fileName.endsWith('.wasm') || fileName.startsWith('php_')) {
		return 'Downloading PHP runtime';
	}
	if (fileName.includes('wordpress')) {
		return 'Downloading WordPress';
	}
	if (fileName.includes('sqlite')) {
		return 'Downloading SQLite integration';
	}
	return `Downloading ${fileName}`;
}

function getCompletedDownloadCaption(label: string, total: number): string {
	if (label === 'Downloading PHP runtime') {
		return `Compiling PHP runtime (${formatBytes(total)})`;
	}
	return `Preparing downloaded files (${formatBytes(total)})`;
}
