export * from '@wp-playground/blueprints';

export {
	LatestSupportedPHPVersion,
	setPhpIniEntries,
	SupportedPHPVersions,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';
export type {
	ErrnoError,
	HTTPMethod,
	PHPOutput,
	PHPRequest,
	PHPRequestHandler,
	PHPRequestHandlerConfiguration,
	PHPRequestHeaders,
	PHPResponse,
	PHPResponseData,
	PHPRunOptions,
	RmDirOptions,
	RuntimeType,
	SupportedPHPVersion,
	UniversalPHP,
} from '@php-wasm/universal';
export { phpVar, phpVars } from '@php-wasm/util';
export type { MountDescriptor, PlaygroundClient };

import { collectPhpLogs, logger } from '@php-wasm/logger';
import { ProgressTracker } from '@php-wasm/progress';
import { consumeAPI } from '@php-wasm/web';
import type { Blueprint, OnStepCompleted } from '@wp-playground/blueprints';
import {
	BlueprintReflection,
	compileBlueprintV1,
	runBlueprintV1Steps,
} from '@wp-playground/blueprints';
import type { MountDescriptor, PlaygroundClient } from '@wp-playground/remote';
import { additionalRemoteOrigins } from './additional-remote-origins';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { remoteDevServerHost, remoteDevServerPort } from '../../build-config';

export interface StartPlaygroundOptions {
	iframe: HTMLIFrameElement;
	remoteUrl: string;
	progressTracker?: ProgressTracker;
	disableProgressBar?: boolean;
	blueprint?: Blueprint;
	/**
	 * Prefer experimental Blueprints v2 PHP runner instead of TypeScript steps
	 */
	experimentalBlueprintsV2Runner?: boolean;
	onBlueprintStepCompleted?: OnStepCompleted;
	/**
	 * Called when the playground client is connected, but before the blueprint
	 * steps are run.
	 *
	 * @param playground
	 * @returns
	 */
	onClientConnected?: (playground: PlaygroundClient) => void;
	/**
	 * The SAPI name PHP will use.
	 * @internal
	 * @private
	 */
	sapiName?: string;
	mounts?: Array<MountDescriptor>;
	shouldInstallWordPress?: boolean;
	/**
	 * The string prefix used in the site URL served by the currently
	 * running remote.html. E.g. for a prefix like `/scope:playground/`,
	 * the scope would be `playground`. See the `@php-wasm/scopes` package
	 * for more details.
	 */
	scope?: string;
	/**
	 * Proxy URL to use for cross-origin requests.
	 *
	 * For example, if corsProxy is set to "https://cors.wordpress.net/proxy.php",
	 * then the CORS requests to https://github.com/WordPress/wordpress-playground.git would actually
	 * be made to https://cors.wordpress.net/proxy.php?https://github.com/WordPress/wordpress-playground.git.
	 *
	 * The Blueprints library will arbitrarily choose which requests to proxy. If you need
	 * to proxy every single request, do not use this option. Instead, you should preprocess
	 * your Blueprint to replace all cross-origin URLs with the proxy URL.
	 */
	corsProxy?: string;
	/**
	 * The version of the SQLite driver to use.
	 * Defaults to the latest development version.
	 */
	sqliteDriverVersion?: string;
}

/**
 * Loads playground in iframe and returns a PlaygroundClient instance.
 *
 * @param iframe Any iframe with Playground's remote.html loaded.
 * @param options Options for loading the playground.
 * @returns A PlaygroundClient instance.
 */
export async function startPlaygroundWeb({
	iframe,
	blueprint,
	remoteUrl,
	progressTracker = new ProgressTracker(),
	disableProgressBar,
	onBlueprintStepCompleted,
	onClientConnected = () => {},
	sapiName,
	mounts,
	scope,
	corsProxy,
	shouldInstallWordPress,
	sqliteDriverVersion,
	experimentalBlueprintsV2Runner,
}: StartPlaygroundOptions): Promise<PlaygroundClient> {
	assertLikelyCompatibleRemoteOrigin(remoteUrl);
	allowStorageAccessByUserActivation(iframe);

	remoteUrl = setQueryParams(remoteUrl, {
		progressbar: !disableProgressBar,
	});
	progressTracker.setCaption('Preparing WordPress');

	// Set a default blueprint if none is provided.
	if (!blueprint) {
		blueprint = {};
	}

	await new Promise((resolve) => {
		iframe.src = remoteUrl;
		iframe.addEventListener('load', resolve, false);
	});

	// @TODO: Make onBlueprintStepCompleted work with Blueprints v2.
	const reflection = await BlueprintReflection.create(blueprint as any);
	if (!experimentalBlueprintsV2Runner && reflection.getVersion() === 2) {
		throw new Error(
			'Cannot run Blueprint v2 when the experimentalBlueprintsV2Runner option is not enabled.'
		);
	}

	let blueprintProgress = progressTracker.stage(0.5);

	// Connect the Comlink API client to the remote worker,
	// boot the playground, and run the blueprint steps.
	const playground = consumeAPI<PlaygroundClient>(
		iframe.contentWindow!,
		iframe.ownerDocument!.defaultView!
	) as PlaygroundClient;
	await playground.isConnected();
	progressTracker.pipe(playground);
	const downloadPHPandWP = progressTracker.stage();
	await playground.onDownloadProgress(downloadPHPandWP.loadingListener);

	// Subscribe early to blueprint messages when v2 runner is enabled
	if (experimentalBlueprintsV2Runner && blueprint) {
		await playground.onBlueprintMessage(async (message: any) => {
			if (message?.type === 'blueprint.progress') {
				blueprintProgress.setCaption(message.caption);
				blueprintProgress.set(message.progress);
			}
			if (message?.type === 'blueprint.error') {
				console.log({ message });
				// @TODO: Error handling
				blueprintProgress.setCaption('Error');
				blueprintProgress.set(100);
			}
		});
	}

	await playground.boot({
		mounts,
		sapiName,
		scope: scope ?? Math.random().toFixed(16),
		shouldInstallWordPress,
		phpVersion: reflection.getPhpVersion(),
		// @TODO: What if it's a custom version? Why do we pass it in here?
		//        It sounds like duplicate info since that information is
		//        already in the Blueprint v1 or v2. Should we just pass the
		//        Blueprint and drop these
		wpVersion: reflection.getWpVersion(),
		withICU: reflection.getIntl(),
		withNetworking: reflection.getNetworking(),
		corsProxyUrl: corsProxy,
		sqliteDriverVersion,
		experimentalBlueprintsV2Runner,
		blueprint: blueprint as any,
	});
	await playground.isReady();
	downloadPHPandWP.finish();

	collectPhpLogs(logger, playground);
	onClientConnected(playground);

	if (experimentalBlueprintsV2Runner) {
		await playground.goTo(reflection.getLandingPage() ?? '/');
	} else if (blueprint) {
		// @TODO: Make onBlueprintStepCompleted work with Blueprints v2.
		// @TODO: Maybe reconcile the worker structure with how Playground CLI
		//        handles booting a site?
		const compiled = await compileBlueprintV1(blueprint as any, {
			progress: blueprintProgress,
			onStepCompleted: onBlueprintStepCompleted,
			corsProxy,
		});
		// Blueprints v1 runner.
		// @TODO: Should we run this in remote instead?
		await runBlueprintV1Steps(compiled, playground);
	}

	/**
	 * Pre-fetch WordPress update checks to speed up the initial wp-admin load.
	 *
	 * @see https://github.com/WordPress/wordpress-playground/pull/2295
	 */
	if (reflection.getNetworking()) {
		await playground.prefetchUpdateChecks();
	}
	progressTracker.finish();

	return playground;
}

/**
 * Chrome does not allow Service Workers to be registered from cross-origin
 * iframes when third-party cookies are disabled unless
 * `requestStorageAccess()` is called and the user grants storage access.
 *
 * However, sandboxed <iframe>s cannot be granted storage access by default for
 * security reasons. Therefore, we need to add the
 * `allow-storage-access-by-user-activation` flag to the iframe's sandbox
 * attribute if it is not already present.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/Storage_Access_API
 */
function allowStorageAccessByUserActivation(iframe: HTMLIFrameElement) {
	if (
		iframe.sandbox?.length &&
		!iframe.sandbox?.contains('allow-storage-access-by-user-activation')
	) {
		iframe.sandbox.add('allow-storage-access-by-user-activation');
	}
}

const officialRemoteOrigin = 'https://playground.wordpress.net';
const devRemoteOrigin = `http://${remoteDevServerHost}:${remoteDevServerPort}`;
const validRemoteOrigins = [
	officialRemoteOrigin,
	devRemoteOrigin,
	// An older origin that's still used by some plugins.
	'https://wasm.wordpress.net',
	// Allow hosting remote from same origin
	location.origin,
	'http://localhost',
	'https://localhost',
	'http://127.0.0.1',
	'https://127.0.0.1',
	...additionalRemoteOrigins,
];
const remoteOrigin =
	import.meta.env.MODE == 'development'
		? devRemoteOrigin
		: officialRemoteOrigin;
/**
 * Assert that the remote origin is likely compatible with this client library.
 *
 * Prior to this assertion, there were cases where folks used the client library
 * from playground.wordpress.net with other origins and eventually ran into
 * compatibility issues when the two sides went out of sync. This way,
 * we discourage that practice which is likely to lead to breakage for the
 * embedding app.
 *
 * @param remoteHtmlUrl The URL for remote.html
 */
function assertLikelyCompatibleRemoteOrigin(remoteHtmlUrl: string) {
	const url = new URL(remoteHtmlUrl, remoteOrigin);

	const validRemote =
		validRemoteOrigins.includes(url.origin) &&
		url.pathname === '/remote.html';

	if (!validRemote) {
		throw new Error(
			`Invalid remote URL: ${url}. ` +
				'Expected remote URL to have a path of "/remote.html" based ' +
				`on one of the following origins:\n ${validRemoteOrigins.join(
					'\n'
				)}`
		);
	}
}

function setQueryParams(url: string, params: Record<string, unknown>) {
	const urlObject = new URL(url, remoteOrigin);
	const qs = new URLSearchParams(urlObject.search);
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== false) {
			if (Array.isArray(value)) {
				for (const item of value) {
					qs.append(key, item.toString());
				}
			} else {
				qs.set(key, value.toString());
			}
		}
	}
	urlObject.search = qs.toString();
	return urlObject.toString();
}
