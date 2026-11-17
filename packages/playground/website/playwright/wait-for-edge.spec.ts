import { waitForEdge } from './wait-for-edge';

const appOrigin = 'https://app.test';
const wordPressOrigin = 'https://wordpress.test';
const fetch = vi.fn();

beforeEach(() => {
	vi.useFakeTimers();
	fetch.mockReset();
	vi.stubGlobal('fetch', fetch);
	vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

// Contract: readiness requires a real manifest result and both successful workers.
// Error pages also lack release imports, so status handling can independently
// regress from body matching and incorrectly finish a rollback rehearsal.
it.each([429, 500, 503])(
	'retries HTTP %s instead of declaring the baseline ready',
	async (status) => {
		queuePoll(
			new Response('error', { status }),
			new Response('error', { status }),
			new Response('error', { status })
		);
		queuePoll(new Response('', { status: 404 }));
		let finished = false;
		const ready = waitForEdge(appOrigin, wordPressOrigin, 'trunk').then(
			() => {
				finished = true;
			}
		);
		await vi.advanceTimersByTimeAsync(0);
		expect(finished).toBe(false);
		expect(
			fetch.mock.calls.slice(0, 3).map(([url]) => String(url))
		).toEqual([
			appOrigin + '/release.json',
			appOrigin + '/sw.js',
			wordPressOrigin + '/sw.js',
		]);
		await vi.advanceTimersByTimeAsync(2000);
		await ready;
	}
);

it.each(['app', 'WordPress'])(
	'waits for HTTP 200 from the %s worker',
	async (host) => {
		queuePoll(
			new Response('', { status: 404 }),
			host === 'app' ? new Response('error', { status: 503 }) : undefined,
			host === 'WordPress'
				? new Response('error', { status: 503 })
				: undefined
		);
		queuePoll(new Response('', { status: 404 }));
		let finished = false;
		const ready = waitForEdge(appOrigin, wordPressOrigin, 'trunk').then(
			() => {
				finished = true;
			}
		);
		await vi.advanceTimersByTimeAsync(0);
		expect(finished).toBe(false);
		await vi.advanceTimersByTimeAsync(2000);
		await ready;
	}
);

it('waits until both worker loaders and the manifest name the new release', async () => {
	queuePoll(
		Response.json({ release: 'B' }),
		new Response('import "/releases/A/sw.js";'),
		new Response('import "/releases/B/sw.js";')
	);
	queuePoll(
		Response.json({ release: 'B' }),
		new Response('import "/releases/B/sw.js";'),
		new Response('import "/releases/B/sw.js";')
	);
	let finished = false;
	const ready = waitForEdge(appOrigin, wordPressOrigin, 'B').then(() => {
		finished = true;
	});
	await vi.advanceTimersByTimeAsync(0);
	expect(finished).toBe(false);
	await vi.advanceTimersByTimeAsync(2000);
	await ready;
});

it('retries a network failure and malformed manifest before reporting readiness', async () => {
	queuePoll(new Error('connection reset'));
	queuePoll(new Response('{invalid'));
	queuePoll(new Response('', { status: 404 }));
	const ready = waitForEdge(appOrigin, wordPressOrigin, 'trunk');
	await vi.advanceTimersByTimeAsync(4000);
	await ready;
	expect(fetch).toHaveBeenCalledTimes(9);
});

it('reports the last HTTP failure when the readiness deadline expires', async () => {
	fetch.mockImplementation(
		async () => new Response('unavailable', { status: 503 })
	);
	const rejected = expect(
		waitForEdge(appOrigin, wordPressOrigin, 'trunk')
	).rejects.toThrow(
		'HTTP statuses: manifest 503, app worker 503, WordPress worker 503'
	);
	await vi.advanceTimersByTimeAsync(300000);
	await rejected;
});

function queuePoll(
	manifest: Response | Error,
	appWorker = new Response('self.addEventListener("fetch", () => {});'),
	wordPressWorker = new Response('self.addEventListener("fetch", () => {});')
) {
	for (const response of [manifest, appWorker, wordPressWorker]) {
		if (response instanceof Error) fetch.mockRejectedValueOnce(response);
		else fetch.mockResolvedValueOnce(response);
	}
}
