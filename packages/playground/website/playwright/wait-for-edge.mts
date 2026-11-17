/* eslint-disable no-console */
/**
 * Wait until the manifest and both root workers name the deployed release.
 * Edge purges take time, so HTTP errors and stale responses keep polling. The
 * archived baseline has no manifest and serves a worker directly, not a loader.
 */
export async function waitForEdge(
	appOrigin: string,
	wordPressOrigin: string,
	release: string,
	baselineWorkers?: readonly [string, string]
) {
	if (release === 'trunk' && !baselineWorkers) {
		throw new Error(
			'Baseline worker bodies are required to verify rollback to trunk.'
		);
	}
	const started = Date.now();
	const deadline = started + 300000;
	let lastFailure = 'The edge still serves another release.';
	while (Date.now() < deadline) {
		try {
			const signal = AbortSignal.timeout(
				Math.min(15000, Math.max(1, deadline - Date.now()))
			);
			const [manifest, appWorker, wordPressWorker] = await Promise.all(
				[
					new URL('/release.json', appOrigin),
					new URL('/sw.js', appOrigin),
					new URL('/sw.js', wordPressOrigin),
				].map(async (url) => {
					const response = await fetch(url, { signal });
					return {
						status: response.status,
						body: await response.text(),
					};
				})
			);
			lastFailure = `HTTP statuses: manifest ${manifest.status}, app worker ${appWorker.status}, WordPress worker ${wordPressWorker.status}.`;
			if (
				appWorker.status === 200 &&
				wordPressWorker.status === 200 &&
				(manifest.status === 200 || manifest.status === 404)
			) {
				const active =
					manifest.status === 404
						? 'trunk'
						: JSON.parse(manifest.body).release;
				const workers = [appWorker.body, wordPressWorker.body];
				if (
					active === release &&
					workers.every((text, index) =>
						servesRelease(text, release, baselineWorkers?.[index])
					)
				) {
					console.log(
						`INFO  the edge served ${release} after ${Math.round((Date.now() - started) / 1000)}s`
					);
					return;
				}
				lastFailure = `The manifest or workers still name another release than ${release}.`;
			}
		} catch (error) {
			lastFailure =
				error instanceof Error ? error.message : String(error);
		}
		await new Promise((resolve) =>
			setTimeout(resolve, Math.min(2000, deadline - Date.now()))
		);
	}
	throw new Error(
		`The edge did not serve ${release} after 300s. ${lastFailure}`
	);
}

function servesRelease(text: string, release: string, baseline?: string) {
	return release === 'trunk'
		? text === baseline
		: text.includes(`import "/releases/${release}/sw.js";`);
}
