import { assetBaseUrl, playgroundOrigin, wordPressSiteUrl } from './config';
import { getReleaseRoot } from '@wp-playground/common';

export function assertDocumentOrigin(role: 'app' | 'sandbox') {
	const expected = role === 'app' ? playgroundOrigin : wordPressSiteUrl;
	if (
		location.origin !== expected ||
		(role === 'sandbox' && wordPressSiteUrl === playgroundOrigin)
	)
		throw new Error(`Incorrect Playground ${role} hostname.`);
}

export async function getDeployment(): Promise<PlaygroundRelease | undefined> {
	if (!getReleaseRoot(assetBaseUrl)) return undefined;
	const response = await fetch(new URL('release.json', assetBaseUrl));
	if (!response.ok)
		throw new Error('Playground release metadata is unavailable.');
	const release = validateRelease(await response.json());
	if (
		release.appOrigin !== playgroundOrigin ||
		release.wordPressOrigin !== wordPressSiteUrl
	) {
		throw new Error('Playground release origins do not match the build.');
	}
	return release;
}

export async function verifyWorker(
	worker: ServiceWorker,
	role: 'app' | 'sandbox',
	release?: string
) {
	const result = await workerMessage(worker, {
		type: 'playground-worker-status',
	});
	if (
		result.protocol !== 1 ||
		result.role !== role ||
		(release && result.release !== release)
	) {
		throw new Error(
			'The Playground service worker does not match this startup.'
		);
	}
}

export async function pinDocumentRelease(worker: ServiceWorker) {
	if (!getReleaseRoot(assetBaseUrl)) return;
	const result = await workerMessage(worker, {
		type: 'playground-pin-release',
		root: assetBaseUrl.pathname,
	});
	if (result.protocol !== 1 || result.root !== assetBaseUrl.pathname) {
		throw new Error(
			'The Playground service worker could not select this release.'
		);
	}
}

function workerMessage(worker: ServiceWorker, data: unknown): Promise<any> {
	return new Promise((resolve, reject) => {
		const channel = new MessageChannel();
		const timeout = setTimeout(() => {
			channel.port1.close();
			reject(new Error('The Playground service worker did not respond.'));
		}, 10000);
		channel.port1.onmessage = (event) => {
			clearTimeout(timeout);
			channel.port1.close();
			resolve(event.data);
		};
		worker.postMessage(data, [channel.port2]);
	});
}

interface PlaygroundRelease {
	protocol: 1;
	release: string;
	appOrigin: string;
	wordPressOrigin: string;
}

export function getReleaseWorkerUrl(
	release: PlaygroundRelease,
	role: 'app' | 'sandbox',
	origin: string
): URL {
	return new URL(`/${role}-sw-${release.release}.js`, origin);
}

/** Both the selector and retained release metadata must name a local immutable directory. */
function validateRelease(value: unknown): PlaygroundRelease {
	const release = value as PlaygroundRelease;
	if (
		release?.protocol !== 1 ||
		typeof release.release !== 'string' ||
		!/^release\.[a-zA-Z0-9]+$/.test(release.release) ||
		new URL(release.appOrigin).origin !== release.appOrigin ||
		new URL(release.wordPressOrigin).origin !== release.wordPressOrigin ||
		release.appOrigin === release.wordPressOrigin
	) {
		throw new Error('Invalid Playground release selector.');
	}
	return release;
}
