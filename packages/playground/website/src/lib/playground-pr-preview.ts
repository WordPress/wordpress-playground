export const playgroundPrParam = 'playground-pr';
export const playgroundPrShaParam = 'playground-pr-sha';
export const playgroundPrPreviewServiceWorkerPath =
	'/playground-pr-preview-sw.js';

export interface PlaygroundPrPreview {
	pr: string;
	sha?: string;
}

interface PlaygroundPrPreviewCurrent {
	sha: string;
}

export function getPlaygroundPrPreview(
	url: string | URL = window.location.href
): PlaygroundPrPreview | undefined {
	const parsedUrl = new URL(url);
	const pr = parsedUrl.searchParams.get(playgroundPrParam);
	if (!pr || !isValidPlaygroundPrNumber(pr)) {
		return undefined;
	}

	const sha = parsedUrl.searchParams.get(playgroundPrShaParam) || undefined;
	if (sha && !isValidPlaygroundPrSha(sha)) {
		return undefined;
	}

	return { pr, sha };
}

export function getPlaygroundPrPreviewBasePath(pr: string, sha: string) {
	return `/pr-previews/${pr}/${sha}/`;
}

export async function activatePlaygroundPrPreview(
	url: string | URL = window.location.href
): Promise<boolean> {
	const preview = getPlaygroundPrPreview(url);
	if (!preview || preview.sha) {
		return false;
	}

	const response = await fetch(`/pr-previews/${preview.pr}/current.json`, {
		cache: 'no-store',
	});
	if (!response.ok) {
		throw new Error(`Preview build for PR ${preview.pr} was not found.`);
	}

	const responseText = await response.text();
	let current: PlaygroundPrPreviewCurrent;
	try {
		current = JSON.parse(responseText) as PlaygroundPrPreviewCurrent;
	} catch {
		throw new Error(`Preview build for PR ${preview.pr} was not found.`);
	}
	if (!isValidPlaygroundPrSha(current.sha)) {
		throw new Error(`Preview build for PR ${preview.pr} is invalid.`);
	}

	const serviceWorkerUrl = new URL(
		playgroundPrPreviewServiceWorkerPath,
		window.location.href
	);
	serviceWorkerUrl.searchParams.set(playgroundPrParam, preview.pr);
	serviceWorkerUrl.searchParams.set(playgroundPrShaParam, current.sha);

	const registration = await navigator.serviceWorker.register(
		serviceWorkerUrl.toString(),
		{
			scope: '/',
			updateViaCache: 'none',
		}
	);
	try {
		await registration.update();
	} catch {
		// The explicit register() call succeeded, so keep going even if the
		// browser cannot immediately revalidate the worker script.
	}
	await waitForPreviewServiceWorkerActivation(
		registration,
		serviceWorkerUrl.toString()
	);

	const reloadUrl = new URL(url);
	reloadUrl.searchParams.set(playgroundPrShaParam, current.sha);
	window.location.replace(reloadUrl.toString());
	return true;
}

function isValidPlaygroundPrNumber(pr: string) {
	return /^\d+$/.test(pr);
}

function isValidPlaygroundPrSha(sha: string) {
	return /^[a-f0-9]{7,40}$/i.test(sha);
}

function waitForPreviewServiceWorkerActivation(
	registration: ServiceWorkerRegistration,
	scriptUrl: string
) {
	const worker =
		[
			registration.installing,
			registration.waiting,
			registration.active,
		].find((candidate) => candidate?.scriptURL === scriptUrl) ||
		registration.installing ||
		registration.waiting;
	if (!worker || worker.state === 'activated') {
		return Promise.resolve();
	}

	return new Promise<void>((resolve) => {
		const resolveIfDone = () => {
			if (worker.state === 'activated' || worker.state === 'redundant') {
				resolve();
			}
		};
		worker.addEventListener('statechange', resolveIfDone);
		resolveIfDone();
	});
}
