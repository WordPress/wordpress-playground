import {
	Blueprint,
	compileBlueprint,
	runBlueprintSteps,
} from '@wp-playground/blueprints';
import { consumeAPI } from '@php-wasm/web';
import { ProgressTracker } from '@php-wasm/progress';
import { PlaygroundClient } from '@wp-playground/remote';

export * from '@wp-playground/blueprints';

export type {
	HTTPMethod,
	PHPRunOptions,
	PHPRequest,
	PHPResponse,
} from '@php-wasm/universal';

export type { PlaygroundClient };
export interface StartPlaygroundOptions {
	iframe: HTMLIFrameElement;
	remoteUrl: string;
	progressTracker?: ProgressTracker;
	disableProgressBar?: boolean;
	blueprint?: Blueprint;
}

const officialRemoteOrigin = 'https://playground.wordpress.net';

/**
 * Loads playground in iframe and returns a PlaygroundClient instance.
 * Optionally
 *
 * @param iframe Any iframe with Playground's remote.html loaded.
 * @param options Options for loading the playground.
 * @returns A PlaygroundClient instance.
 */
export async function startPlayground(
	options: StartPlaygroundOptions
): Promise<PlaygroundClient> {
	const blueprint: Blueprint = {
		...(options.blueprint || {}),
		preferredVersions: {
			php: '8.0',
			wp: 'latest',
			...(options.blueprint?.preferredVersions || {}),
		},
	};
	const tracker = options.progressTracker || new ProgressTracker();
	tracker.setCaption('Preparing WordPress');

	const compiled = compileBlueprint(blueprint, {
		progress: tracker.stage(0.5),
	});

	// Load playground in an iframe
	await new Promise((resolve) => {
		options.iframe.src = remoteURL(
			options.remoteUrl,
			compiled?.versions.php,
			compiled?.versions.wp,
			options.disableProgressBar
		);
		options.iframe.addEventListener('load', resolve, false);
	});

	// Connect the Comlink client
	const playground = createClient(options.iframe);
	await playground.connected;

	// Wait for playground to be ready and display the progress
	tracker.pipe(playground);
	const downloadTracker = compiled.steps.length
		? tracker.stage(0.5)
		: tracker;
	await playground.onDownloadProgress(downloadTracker.loadingListener);
	await playground.isReady();

	await runBlueprintSteps(compiled, playground);
	await playground.goTo(compiled.landingPage);

	return playground;
}

function remoteURL(
	remoteHtmlUrl: string,
	php: string,
	wp: string,
	disableProgressBar = false
) {
	const url = new URL(remoteHtmlUrl);
	if (
		(url.origin === officialRemoteOrigin || url.hostname === 'localhost') &&
		url.pathname !== '/remote.html'
	) {
		throw new Error(
			`Invalid remote URL: ${url}. ` +
				`Expected origin to be ${officialRemoteOrigin}/remote.html.`
		);
	}

	const qs = new URLSearchParams({
		php,
		wp,
	});
	if (!disableProgressBar) {
		qs.set('progressbar', '1');
	}
	url.search = qs.toString();
	return url.toString();
}

/**
 * @deprecated Use `loadPlayground` instead.
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
	if (options?.loadRemote) {
		return startPlayground({
			iframe,
			remoteUrl: options.loadRemote,
		});
	}
	const client = createClient(iframe);
	await client.connected;
	return client;
}

export function createClient(iframe: HTMLIFrameElement): PlaygroundClient {
	const client = consumeAPI<PlaygroundClient>(iframe.contentWindow!);

	/*
	 * consumeAPI returns Remote<PlaygroundClient>. However,
	 * PlaygroundClient is has a better DX while still being
	 * compatible with Remote<PlaygroundClient>. Let's typecast:
	 */
	return client as PlaygroundClient;
}
