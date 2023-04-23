import { PlaygroundClient } from '@wp-playground/remote';
import { Blueprint, runBlueprint } from '@wp-playground/blueprints';
import { consumeAPI } from '@php-wasm/web';
import { ProgressTracker } from '@php-wasm/progress';

export * from '@wp-playground/blueprints';

export type {
	HTTPMethod,
	PHPRunOptions,
	PHPRequest,
	PHPResponse,
} from '@php-wasm/universal';

export type { PlaygroundClient };
export interface ConnectPlaygroundOptions {
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
	options: ConnectPlaygroundOptions
): Promise<PlaygroundClient> {
	/*
	 * Load a fresh playground remote and wait until
	 * the iframe is ready for communication:
	 */
	await new Promise((resolve) => {
		const remoteUrl = new URL(options.remoteUrl);
		if (
			remoteUrl.origin === officialRemoteOrigin &&
			remoteUrl.pathname !== '/remote.html'
		) {
			throw new Error(
				`Invalid remote URL: ${remoteUrl}. ` +
					`Expected origin to be ${officialRemoteOrigin}/remote.html.`
			);
		}

		const qs = new URLSearchParams({
			php: options.blueprint?.preferredVersions?.php || 'latest',
			wp: options.blueprint?.preferredVersions?.wp || 'latest',
		});
		if (!options.disableProgressBar) {
			qs.set('progressbar', '1');
		}
		remoteUrl.search = qs.toString();

		options.iframe.src = remoteUrl.toString();
		options.iframe.addEventListener('load', resolve, false);
	});

	const playground = createClient(options.iframe);
	await playground.connected;

	const tracker = options.progressTracker || new ProgressTracker();
	tracker.addProgressReceiver(playground);
	const downloadWeight = options.blueprint ? 0.5 : 1;
	await playground.onDownloadProgress(
		tracker.stage(downloadWeight, 'Preparing WordPress').loadingListener
	);

	/**
	 * Wait until WordPress and PHP are loaded.
	 */
	await playground.isReady();

	if (options.blueprint) {
		await runBlueprint(
			playground,
			options.blueprint,
			tracker.stage(1 - downloadWeight)
		);
	}

	return playground;
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
