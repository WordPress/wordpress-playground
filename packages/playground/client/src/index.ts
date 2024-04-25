export * from '@wp-playground/blueprints';

export type {
	HTTPMethod,
	PHPRunOptions,
	PHPRequest,
	PHPResponse,
	UniversalPHP,
	IsomorphicRemotePHP,
	PHPOutput,
	PHPResponseData,
	ErrnoError,
	PHPRequestHandler,
	PHPRequestHandlerConfiguration,
	PHPRequestHeaders,
	SupportedPHPVersion,
	RmDirOptions,
	RuntimeType,
} from '@php-wasm/universal';
export {
	SupportedPHPVersions,
	SupportedPHPVersionsList,
	LatestSupportedPHPVersion,
} from '@php-wasm/universal';
export type { PlaygroundClient } from '@wp-playground/remote';

export { phpVar, phpVars } from '@php-wasm/util';

import {
	Blueprint,
	compileBlueprint,
	OnStepCompleted,
	runBlueprintSteps,
} from '@wp-playground/blueprints';
import { consumeAPI } from '@php-wasm/web';
import { ProgressTracker } from '@php-wasm/progress';
import { PlaygroundClient } from '@wp-playground/remote';
import { collectPhpLogs, logger } from '@php-wasm/logger';
export interface StartPlaygroundOptions {
	iframe: HTMLIFrameElement;
	remoteUrl: string;
	progressTracker?: ProgressTracker;
	disableProgressBar?: boolean;
	blueprint?: Blueprint;
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
}: StartPlaygroundOptions): Promise<PlaygroundClient> {
	assertValidRemote(remoteUrl);
	allowStorageAccessByUserActivation(iframe);

	remoteUrl = setQueryParams(remoteUrl, {
		progressbar: !disableProgressBar,
	});
	progressTracker.setCaption('Preparing WordPress');
	if (!blueprint) {
		const playground = await doStartPlaygroundWeb(
			iframe,
			setQueryParams(remoteUrl, {
				['php-extension']: 'kitchen-sink',
			}),
			progressTracker
		);
		onClientConnected(playground);
		return playground;
	}
	const compiled = compileBlueprint(blueprint, {
		progress: progressTracker.stage(0.5),
		onStepCompleted: onBlueprintStepCompleted,
	});
	const playground = await doStartPlaygroundWeb(
		iframe,
		setQueryParams(remoteUrl, {
			php: compiled.versions.php,
			wp: compiled.versions.wp,
			['sapi-name']: sapiName,
			['php-extension']: compiled.phpExtensions,
			['networking']: compiled.features.networking ? 'yes' : 'no',
		}),
		progressTracker
	);
	collectPhpLogs(logger, playground);
	onClientConnected(playground);
	await runBlueprintSteps(compiled, playground);
	progressTracker.finish();

	return playground;
}

/**
 * Chrome does not allow Service Workers to be registered from cross-origin iframes
 * when third-party cookies are disabled unless `requestStorageAccess()` is called
 * and the user grants storage access.
 *
 * However, sandboxed <iframe>s cannot be granted storage access by default for
 * security reasons. Therefore, we need to add the `allow-storage-access-by-user-activation`
 * flag to the iframe's sandbox attribute if it is not already present.
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

/**
 * Internal function to connect an iframe to the playground remote.
 *
 * @param iframe
 * @param remoteUrl
 * @param progressTracker
 * @returns
 */
async function doStartPlaygroundWeb(
	iframe: HTMLIFrameElement,
	remoteUrl: string,
	progressTracker: ProgressTracker
) {
	await new Promise((resolve) => {
		iframe.src = remoteUrl;
		iframe.addEventListener('load', resolve, false);
	});

	// Connect the Comlink client and wait until the
	// playground is ready.
	const playground = consumeAPI<PlaygroundClient>(
		iframe.contentWindow!,
		iframe.ownerDocument!.defaultView!
	) as PlaygroundClient;
	await playground.isConnected();
	progressTracker.pipe(playground);
	const downloadPHPandWP = progressTracker.stage();
	await playground.onDownloadProgress(downloadPHPandWP.loadingListener);
	await playground.isReady();
	downloadPHPandWP.finish();
	return playground;
}

const officialRemoteOrigin = 'https://playground.wordpress.net';
function assertValidRemote(remoteHtmlUrl: string) {
	const url = new URL(remoteHtmlUrl, officialRemoteOrigin);
	if (
		(url.origin === officialRemoteOrigin || url.hostname === 'localhost') &&
		url.pathname !== '/remote.html'
	) {
		throw new Error(
			`Invalid remote URL: ${url}. ` +
				`Expected origin to be ${officialRemoteOrigin}/remote.html.`
		);
	}
}

function setQueryParams(url: string, params: Record<string, unknown>) {
	const urlObject = new URL(url, officialRemoteOrigin);
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

/**
 * @deprecated Use `startPlayground` instead.
 *
 * @param iframe Any iframe with Playground's remote.html loaded.
 * @param options Optional. If `loadRemote` is set, the iframe's `src` will be set to that URL.
 *                In other words, use this option if your iframe doesn't have remote.html already
 * 				  loaded.
 */
export async function connectPlayground(
	iframe: HTMLIFrameElement,
	options?: { loadRemote?: string }
): Promise<PlaygroundClient> {
	logger.warn(
		'`connectPlayground` is deprecated and will be removed. Use `startPlayground` instead.'
	);
	if (options?.loadRemote) {
		return startPlaygroundWeb({
			iframe,
			remoteUrl: options.loadRemote,
		});
	}
	const client = consumeAPI<PlaygroundClient>(
		iframe.contentWindow!,
		iframe.ownerDocument!.defaultView!
	) as PlaygroundClient;
	await client.isConnected();
	return client;
}
