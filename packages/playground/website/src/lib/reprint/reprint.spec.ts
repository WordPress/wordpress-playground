import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { TransferProgressUpdate } from './reprint';
import type { PlaygroundClient } from '@wp-playground/client';
import {
	detectReprint,
	getReprintAdminUrls,
	normalizeReprintUrl,
	installReprint,
	runBridge,
} from './reprint';
import { fetchWithCorsProxy } from '@php-wasm/web-service-worker';
import release from './release.json';

vi.mock('@php-wasm/web-service-worker', () => ({
	fetchWithCorsProxy: vi.fn(),
}));
vi.mock('virtual:cors-proxy-url', () => ({ corsProxyUrl: '' }));

// Detection must use Reprint's reply, not a generic host error. These fixtures
// come from v0.10.8's unauthenticated preflight, before any site data is read.
describe('Reprint setup', () => {
	beforeEach(() => vi.clearAllMocks());
	it.each([
		[
			403,
			{ code: 403, error: 'Missing X-Auth-Signature header' },
			'configured',
		],
		[
			503,
			{
				code: 503,
				error: 'Export not configured. Please configure the connection token in WordPress admin under Tools > Reprint Server.',
			},
			'needs-key',
		],
		[403, { code: 403, error: 'Forbidden' }, 'not-detected'],
		[503, { error: 'Service unavailable' }, 'not-detected'],
		[
			200,
			{ code: 403, error: 'Missing X-Auth-Signature header' },
			'not-detected',
		],
	])(
		'classifies HTTP %s with its response body',
		async (status, body, expected) => {
			vi.mocked(fetchWithCorsProxy).mockResolvedValueOnce(
				new Response(JSON.stringify(body), { status: status as number })
			);
			expect(
				await detectReprint(
					'https://example.com',
					new AbortController().signal
				)
			).toBe(expected);
			expect(fetchWithCorsProxy).toHaveBeenCalledWith(
				expect.stringMatching(
					/^https:\/\/example.com\/\?reprint-api=&endpoint=preflight&_cache_bust=.+$/
				),
				expect.objectContaining({
					credentials: 'omit',
					cache: 'no-store',
					signal: expect.any(AbortSignal),
				}),
				''
			);
		}
	);
	it('does not mistake a login page for a Reprint response', async () => {
		vi.mocked(fetchWithCorsProxy).mockResolvedValueOnce(
			new Response('<html>Log in</html>')
		);
		expect(
			await detectReprint(
				'https://example.com',
				new AbortController().signal
			)
		).toBe('not-detected');
	});
	it('does not treat a blocked request as proof that Reprint is absent', async () => {
		vi.mocked(fetchWithCorsProxy).mockRejectedValueOnce(
			new TypeError('Failed to fetch')
		);
		expect(
			await detectReprint(
				'https://example.com',
				new AbortController().signal
			)
		).toBe('unreachable');
	});
	it('ends a stalled check instead of leaving setup waiting forever', async () => {
		vi.useFakeTimers();
		try {
			vi.mocked(fetchWithCorsProxy).mockImplementationOnce(
				(_url, init) =>
					new Promise((_resolve, reject) => {
						init!.signal!.addEventListener('abort', () =>
							reject(new DOMException('Timed out', 'AbortError'))
						);
					})
			);
			const result = detectReprint(
				'https://example.com',
				new AbortController().signal
			);
			await vi.advanceTimersByTimeAsync(15000);
			expect(await result).toBe('unreachable');
		} finally {
			vi.useRealTimers();
		}
	});
	// The deadline must also cover transports and response bodies that do not
	// settle when aborted. Otherwise setup remains stuck after the timer fires.
	it.each(['request', 'body'])(
		'bounds a stalled %s that ignores abort',
		async (stage) => {
			vi.useFakeTimers();
			try {
				const pending = new Promise<Response>(() => {});
				vi.mocked(fetchWithCorsProxy).mockReturnValueOnce(
					stage === 'request'
						? pending
						: Promise.resolve(new Response(new ReadableStream()))
				);
				const settled = vi.fn();
				void detectReprint(
					'https://example.com',
					new AbortController().signal
				).then(settled);
				await vi.advanceTimersByTimeAsync(15000);
				expect(settled).toHaveBeenCalledWith('unreachable');
				expect(
					vi.mocked(fetchWithCorsProxy).mock.calls[0][1]!.signal!
						.aborted
				).toBe(true);
				expect(vi.getTimerCount()).toBe(0);
			} finally {
				vi.useRealTimers();
			}
		}
	);
	it.each([
		'https://example.com/blog',
		'https://example.com/blog/?reprint-api',
	])('keeps the WordPress path in admin links for %s', (url) => {
		expect(getReprintAdminUrls(url)).toEqual({
			site: 'https://example.com/blog/',
			install:
				'https://example.com/blog/wp-admin/plugin-install.php?tab=upload',
			settings:
				'https://example.com/blog/wp-admin/tools.php?page=reprint-server',
		});
	});
});

describe('Bundled Reprint client', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		vi.stubGlobal('fetch', vi.fn());
		vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(
			Uint8Array.from(release.sha256.match(/../g)!, (byte) =>
				parseInt(byte, 16)
			).buffer
		);
	});
	afterEach(() => vi.unstubAllGlobals());
	it('reuses a verified cached client', async () => {
		const { playground, writeFile } = createClient([]);
		await installReprint(playground, vi.fn());
		expect(fetch).not.toHaveBeenCalled();
		expect(fetchWithCorsProxy).not.toHaveBeenCalled();
		expect(writeFile).toHaveBeenCalledWith(
			'/tmp/playground-reprint.phar',
			expect.any(Uint8Array)
		);
	});
	it('replaces an older client only after checking the downloaded bytes', async () => {
		vi.mocked(crypto.subtle.digest).mockResolvedValueOnce(
			new Uint8Array(32).buffer
		);
		const bytes = new Uint8Array([1, 2, 3]);
		vi.mocked(fetch).mockResolvedValueOnce(new Response(bytes));
		const { playground, writeFile } = createClient([]);
		await installReprint(playground, vi.fn());
		expect(fetch).toHaveBeenCalledWith(
			`${import.meta.env.BASE_URL}assets/optional/reprint/reprint-${release.sha256}.phar`
		);
		expect(fetchWithCorsProxy).not.toHaveBeenCalled();
		expect(writeFile).toHaveBeenCalledWith(
			'/tmp/playground-reprint.phar',
			bytes
		);
		expect(
			vi.mocked(crypto.subtle.digest).mock.invocationCallOrder[1]
		).toBeLessThan(writeFile.mock.invocationCallOrder[0]);
	});
	it.each(['bad digest', 'failed download'])(
		'preserves the old client after a %s',
		async (failure) => {
			vi.mocked(crypto.subtle.digest).mockResolvedValue(
				new Uint8Array(32).buffer
			);
			vi.mocked(fetch).mockResolvedValueOnce(
				new Response('modified client', {
					status: failure === 'failed download' ? 503 : 200,
				})
			);
			const { playground, writeFile } = createClient([]);
			await expect(installReprint(playground, vi.fn())).rejects.toThrow(
				failure === 'failed download'
					? 'Could not download Reprint'
					: 'pinned release'
			);
			expect(writeFile).not.toHaveBeenCalled();
		}
	);
});

describe('Reprint command replies', () => {
	beforeEach(() => vi.clearAllMocks());
	it('allows plain HTTP only for local development', () => {
		expect(normalizeReprintUrl('http://127.0.0.1:9417')).toBe(
			'http://127.0.0.1:9417/?reprint-api'
		);
	});

	it('uses one remote identity for the site URL and API URL', () => {
		expect(normalizeReprintUrl(' https://EXAMPLE.com ')).toBe(
			'https://example.com/?reprint-api'
		);
		expect(normalizeReprintUrl('https://example.com/?reprint-api=1')).toBe(
			'https://example.com/?reprint-api'
		);
		expect(
			normalizeReprintUrl('https://example.com/blog/?reprint-api')
		).toBe('https://example.com/blog/?reprint-api');
	});

	it.each([
		'http://example.com',
		'https://user:pass@example.com',
		'https://example.com/#secret',
		'https://example.com/?SECRET_KEY=token',
		'https://example.com/?other=1',
	])('rejects unsafe or ambiguous source URLs: %s', (url) => {
		expect(() => normalizeReprintUrl(url)).toThrow();
	});

	it('streams byte progress before the PHP request finishes and ignores text-only file updates', async () => {
		const { playground } = createClient([]);
		let output!: ReadableStreamDefaultController<Uint8Array>;
		let finish!: (code: number) => void;
		vi.mocked(playground.runStream).mockResolvedValueOnce({
			stdout: new ReadableStream({
				start(controller) {
					output = controller;
				},
			}),
			stderrText: Promise.resolve(''),
			exitCode: new Promise<number>((resolve) => {
				finish = resolve;
			}),
		} as never);
		const progress = vi.fn();
		const transfer = runBridge(
			playground,
			{
				command: 'pull',
				url: 'https://example.com/?reprint-api',
				secret: 'private-token',
				documentRoot: '/wordpress',
				siteUrl: 'https://playground.test/scope:site',
			},
			progress
		);
		await vi.waitFor(() => expect(output).toBeDefined());
		const line =
			JSON.stringify({
				playgroundProgress: {
					phase: 'files-pull',
					message: 'Downloading site files',
					bytesDone: 1024,
					bytesTotal: 4096,
					filesDone: 0,
					filesTotal: 1,
					path: 'private-token',
				},
			}) + '\n';
		output.enqueue(new TextEncoder().encode(line.slice(0, 30)));
		output.enqueue(new TextEncoder().encode(line.slice(30)));
		await vi.waitFor(() =>
			expect(progress).toHaveBeenLastCalledWith(
				expect.objectContaining({
					message: 'Downloading site files',
					bytesDone: 1024,
					bytesTotal: 4096,
					filesDone: 0,
					filesTotal: 1,
				})
			)
		);
		output.enqueue(
			new TextEncoder().encode(
				JSON.stringify({
					message: 'Downloading — 0 / 1 files',
					files_done: 0,
					files_total: 1,
				}) + '\n'
			)
		);
		output.enqueue(
			new TextEncoder().encode(
				JSON.stringify({ playgroundReprint: { status: 'complete' } }) +
					'\n'
			)
		);
		output.close();
		finish(0);
		await transfer;
		expect(JSON.stringify(progress.mock.calls)).not.toContain(
			'private-token'
		);
		expect(JSON.stringify(progress.mock.calls)).not.toContain(
			'Downloading —'
		);
	});

	it('describes the table being downloaded and the statements applied', async () => {
		const { playground, runStream } = createClient([
			{ status: 'complete' },
		]);
		runStream.mockResolvedValueOnce(
			response(
				[
					{
						playgroundProgress: {
							phase: 'db-pull',
							message: 'Downloading SQL',
							bytesDone: 10,
							tablesDone: 2,
							tablesTotal: 9,
							tableName: 'wp_posts',
							rowsDone: 1200,
							rowsTotal: 5000,
						},
					},
					{
						playgroundProgress: {
							phase: 'db-apply',
							message: 'Importing SQL',
							bytesDone: 25,
							bytesTotal: 100,
							statementsDone: 340,
						},
					},
					{ playgroundReprint: { status: 'complete' } },
				]
					.map((record) => JSON.stringify(record))
					.join('\n') + '\n'
			)
		);
		const updates: TransferProgressUpdate[] = [];
		await runBridge(
			playground,
			{
				command: 'pull',
				url: 'https://example.com/?reprint-api',
				secret: 'token',
				documentRoot: '/wordpress',
				siteUrl: 'https://playground.test/scope:site',
			},
			(update) => updates.push(update)
		);
		// Thousands separators depend on the runtime's locale data.
		expect(updates.map((update) => update.detail)).toContainEqual(
			expect.stringMatching(
				/^Table 3 of 9 · wp_posts · 1,?200 of ~5,?000 rows$/
			)
		);
		expect(updates.map((update) => update.detail)).toContain(
			'340 statements applied'
		);
	});

	it('redacts the connection token from an error', async () => {
		const { playground } = createClient([]);
		vi.mocked(playground.runStream).mockResolvedValueOnce(
			response('', 'failed with private-token', 1) as never
		);
		await expect(
			runBridge(
				playground,
				{
					command: 'pull',
					url: 'https://example.com/?reprint-api',
					secret: 'private-token',
					documentRoot: '/wordpress',
					siteUrl: 'https://playground.test/scope:site',
				},
				vi.fn()
			)
		).rejects.toThrow('failed with [redacted]');
	});
});

/** Supply streamed PHP replies without booting WordPress. */
function createClient(results: unknown[], events: string[] = []) {
	const runStream = vi.fn(
		async (options: { env: { PLAYGROUND_REPRINT: string } }) => {
			events.push(JSON.parse(options.env.PLAYGROUND_REPRINT).command);
			return response(
				JSON.stringify({ playgroundReprint: results.shift() }) + '\n'
			);
		}
	);
	const writeFile = vi.fn();
	const playground = {
		documentRoot: Promise.resolve('/wordpress'),
		absoluteUrl: Promise.resolve('https://playground.test/scope:site'),
		fileExists: vi.fn().mockResolvedValue(true),
		mkdir: vi.fn(),
		writeFile,
		readFileAsBuffer: vi.fn().mockResolvedValue(new Uint8Array()),
		runStream,
	} as unknown as PlaygroundClient;
	return { playground, runStream, writeFile };
}

/** Encode one PHP response, including its exit status and stderr. */
function response(stdout: string, stderr = '', exitCode = 0) {
	return {
		stdout: new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(stdout));
				controller.close();
			},
		}),
		stderrText: Promise.resolve(stderr),
		exitCode: Promise.resolve(exitCode),
	};
}
