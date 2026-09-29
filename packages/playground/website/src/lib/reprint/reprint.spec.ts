import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TransferProgress } from './reprint';
import type { PlaygroundClient } from '@wp-playground/client';
import {
	detectReprint,
	REPRINT_VERSION,
	getReprintAdminUrls,
	normalizeReprintUrl,
	transferSite,
} from './reprint';
import { fetchWithCorsProxy } from '@php-wasm/web-service-worker';
import { logger } from '@php-wasm/logger';

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

// These tests protect the command boundary: remote identity, token storage,
// and the order of import, persistence, and the new push baseline.
// A runner change can break these independently of the confirmation UI.
describe('Reprint transfers', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(
			Uint8Array.from(
				'8a28aa71483668a549b22932d021f3d98d7690f0e858406ddf99e91303a8e4c8'.match(
					/../g
				)!,
				(byte) => parseInt(byte, 16)
			).buffer
		);
	});

	it('replaces an older cached client before executing PHP', async () => {
		vi.mocked(crypto.subtle.digest).mockResolvedValueOnce(
			new Uint8Array(32).buffer
		);
		const bytes = new Uint8Array([1, 2, 3]);
		vi.mocked(fetchWithCorsProxy).mockResolvedValueOnce(
			new Response(bytes)
		);
		const { playground, runStream, writeFile } = createClient([
			{ status: 'complete' },
		]);
		await transferSite(
			playground,
			'push',
			'https://example.com',
			'token',
			vi.fn()
		);
		expect(fetchWithCorsProxy).toHaveBeenCalledWith(
			`https://github.com/WordPress/reprint/releases/download/${REPRINT_VERSION}/reprint.phar`,
			undefined,
			'',
			'https://playground.test/scope:site'
		);
		expect(writeFile).toHaveBeenCalledWith(
			'/tmp/playground-reprint.phar',
			bytes
		);
		expect(writeFile.mock.invocationCallOrder[0]).toBeLessThan(
			runStream.mock.invocationCallOrder[0]
		);
	});

	it('rejects an unverified replacement without overwriting the cached client', async () => {
		vi.mocked(crypto.subtle.digest).mockResolvedValue(
			new Uint8Array(32).buffer
		);
		vi.mocked(fetchWithCorsProxy).mockResolvedValueOnce(
			new Response('modified client')
		);
		const { playground, runStream, writeFile } = createClient([]);
		await expect(
			transferSite(
				playground,
				'push',
				'https://example.com',
				'token',
				vi.fn()
			)
		).rejects.toThrow('pinned release');
		expect(runStream).not.toHaveBeenCalled();
		expect(writeFile).not.toHaveBeenCalled();
	});

	it('does not run the outdated client when its replacement cannot be downloaded', async () => {
		vi.mocked(crypto.subtle.digest).mockResolvedValueOnce(
			new Uint8Array(32).buffer
		);
		vi.mocked(fetchWithCorsProxy).mockResolvedValueOnce(
			new Response('', { status: 503 })
		);
		const { playground, runStream, writeFile } = createClient([]);
		await expect(
			transferSite(
				playground,
				'push',
				'https://example.com',
				'token',
				vi.fn()
			)
		).rejects.toThrow('Could not download Reprint');
		expect(runStream).not.toHaveBeenCalled();
		expect(writeFile).not.toHaveBeenCalled();
	});

	it('reuses the verified pinned client without downloading it again', async () => {
		const { playground } = createClient([{ status: 'complete' }]);
		await transferSite(
			playground,
			'push',
			'https://example.com',
			'token',
			vi.fn()
		);
		expect(fetchWithCorsProxy).not.toHaveBeenCalled();
	});

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
	])('rejects unsafe or ambiguous URLs: %s', (url) => {
		expect(() => normalizeReprintUrl(url)).toThrow();
	});

	it('runs the stages in order without flushing to browser storage between them', async () => {
		const events: string[] = [];
		const { playground, runStream, writeFile } = createClient(
			[
				{ status: 'continue', stage: 'db-pull' },
				{
					status: 'install',
				},
				{ status: 'complete' },
			],
			events
		);
		await transferSite(
			playground,
			'pull',
			'https://example.com',
			'private-token',
			vi.fn()
		);
		expect(
			runStream.mock.calls.map(
				([options]) =>
					JSON.parse(options.env.PLAYGROUND_REPRINT).command
			)
		).toEqual(['pull', 'pull', 'finish-pull']);
		// Nothing is flushed to browser storage during a pull; the site is
		// temporary until it completes and autosaves afterwards.
		expect(events).toEqual(['pull', 'pull', 'finish-pull']);
		expect(JSON.stringify(writeFile.mock.calls)).not.toContain(
			'private-token'
		);
	});

	it('does not advance the baseline when writing directly into the site fails', async () => {
		const { playground, runStream } = createClient([{ status: 'install' }]);
		vi.mocked(playground.runStream).mockRejectedValueOnce(
			new Error('No storage space')
		);
		await expect(
			transferSite(
				playground,
				'pull',
				'https://example.com',
				'token',
				vi.fn()
			)
		).rejects.toThrow('No storage space');
		expect(runStream).toHaveBeenCalledTimes(1);
	});

	it('push never runs local WordPress setup or login', async () => {
		const { playground, runStream } = createClient([
			{ status: 'complete' },
		]);
		await transferSite(
			playground,
			'push',
			'https://example.com',
			'token',
			vi.fn()
		);
		expect(playground.request).not.toHaveBeenCalled();
		expect(
			JSON.parse(runStream.mock.calls[0][0].env.PLAYGROUND_REPRINT)
				.command
		).toBe('push');
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
		const transfer = transferSite(
			playground,
			'pull',
			'https://example.com',
			'private-token',
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
		const updates: TransferProgress[] = [];
		await transferSite(
			playground,
			'pull',
			'https://example.com',
			'token',
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
			transferSite(
				playground,
				'push',
				'https://example.com',
				'private-token',
				vi.fn()
			)
		).rejects.toThrow('failed with [redacted]');
	});

	it('keeps one monotonic bar through files, SQL, installation, login, and the final flush', async () => {
		const { playground, runStream } = createClient([
			{ status: 'complete' },
		]);
		runStream.mockResolvedValueOnce(
			response(
				[
					{
						playgroundProgress: {
							phase: 'files-pull',
							message: 'Files',
							bytesDone: 100,
							bytesTotal: 100,
						},
					},
					{
						playgroundProgress: {
							phase: 'db-pull',
							message: 'Downloading SQL',
							bytesDone: 50,
						},
					},
					{
						playgroundProgress: {
							phase: 'db-pull',
							message: 'Downloading SQL',
							bytesDone: 40,
						},
					},
					{ phase: 'db-apply', bytes_read: 25, bytes_total: 100 },
					{ message: 'Saving transfer checkpoint…' },
					{
						playgroundReprint: {
							status: 'install',
						},
					},
				]
					.map((record) => JSON.stringify(record))
					.join('\n') + '\n'
			)
		);
		const updates: TransferProgress[] = [];
		await transferSite(
			playground,
			'pull',
			'https://example.com',
			'token',
			(update) => updates.push(update)
		);
		const values = updates.map((update) => update.overallPercent!);
		expect(values[0]).toBe(0);
		expect(values.at(-1)).toBe(100);
		expect(values.slice(0, -1).every((value) => value < 100)).toBe(true);
		expect(
			values.every((value, i) => i === 0 || value >= values[i - 1])
		).toBe(true);
		expect(updates).toContainEqual(
			expect.objectContaining({
				phase: 'db-pull',
				overallPercent: 55,
			})
		);
		expect(updates).toContainEqual(
			expect.objectContaining({
				phase: 'db-apply',
				overallPercent: 76,
			})
		);
		expect(updates).toContainEqual(
			expect.objectContaining({ phase: 'login', overallPercent: 96 })
		);
		expect(playground.request).toHaveBeenNthCalledWith(1, {
			url: expect.stringMatching(
				/^\/\.playground-reprint-login-.+\.php$/
			),
			method: 'POST',
		});
		expect(playground.request).toHaveBeenNthCalledWith(2, {
			url: expect.any(String),
			method: 'GET',
		});
		expect(playground.unlink).toHaveBeenCalledWith(
			expect.stringMatching(
				/^\/wordpress\/\.playground-reprint-login-.+\.php$/
			)
		);
		expect(playground.defineConstant).toHaveBeenCalledWith(
			'PLAYGROUND_AUTO_LOGIN_AS_USER',
			'imported-admin'
		);
		expect(playground.goTo).toHaveBeenCalledWith('/wp-admin/');
	});

	it.each([1, 2])(
		'removes the temporary login script and preserves retry state when login request %s fails',
		async (failure) => {
			const { playground, runStream } = createClient([
				{ status: 'install' },
			]);
			const request = vi.mocked(playground.request);
			if (failure === 2)
				request.mockResolvedValueOnce({
					httpStatusCode: 200,
					text: '{"loggedIn":true,"username":"imported-admin"}',
					errors: '',
				} as never);
			request.mockResolvedValueOnce({
				httpStatusCode: 200,
				text: '{"loggedIn":false}',
				errors: '',
			} as never);
			const progress = vi.fn();
			await expect(
				transferSite(
					playground,
					'pull',
					'https://example.com',
					'token',
					progress
				)
			).rejects.toThrow('administrator login failed');
			expect(playground.defineConstant).not.toHaveBeenCalled();
			expect(playground.unlink).toHaveBeenCalled();
			expect(runStream).toHaveBeenCalledTimes(1);
			expect(
				progress.mock.calls.some(
					([update]) => update.overallPercent === 100
				)
			).toBe(false);
		}
	);

	it('shows a missing-theme warning even when the homepage returns nonempty HTML', async () => {
		const { playground } = createClient([
			{ status: 'install' },
			{ status: 'complete' },
		]);
		vi.mocked(playground.request).mockResolvedValueOnce({
			httpStatusCode: 200,
			text: JSON.stringify({
				loggedIn: true,
				username: 'imported-admin',
				warning: 'The theme directory "iotix" does not exist.',
			}),
			errors: '',
		} as never);
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
		const result = await transferSite(
			playground,
			'pull',
			'https://example.com',
			'token',
			vi.fn()
		);
		expect(result.warning).toContain('iotix');
		expect(error).toHaveBeenCalledWith(result.warning);
	});

	it.each([200, 500])(
		'reports a blank homepage with HTTP %s without undoing a successful import and login',
		async (status) => {
			const { playground } = createClient([
				{ status: 'install' },
				{ status: 'complete' },
			]);
			vi.mocked(playground.request).mockImplementation(
				async ({ url }) =>
					({
						httpStatusCode: url === '/' ? status : 200,
						text:
							url === '/'
								? ''
								: '{"loggedIn":true,"username":"imported-admin"}',
						errors: '',
					}) as never
			);
			const error = vi
				.spyOn(logger, 'error')
				.mockImplementation(() => {});
			const result = await transferSite(
				playground,
				'pull',
				'https://example.com',
				'token',
				vi.fn()
			);
			expect(result.warning).toContain(
				`homepage returned ${status} with an empty response`
			);
			expect(error).toHaveBeenCalledWith(result.warning);
			expect(playground.goTo).toHaveBeenCalledWith('/wp-admin/');
		}
	);
});

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
		request: vi.fn(async ({ url }: { url: string }) => ({
			httpStatusCode: 200,
			text:
				url === '/'
					? '<html>A working homepage</html>'
					: JSON.stringify({
							loggedIn: true,
							username: 'imported-admin',
						}),
			errors: '',
		})),
		defineConstant: vi.fn(),
		unlink: vi.fn(),
		goTo: vi.fn(),
		flushOpfs: vi.fn(async () => {
			events.push('flush');
		}),
		runStream,
	} as unknown as PlaygroundClient;
	return { playground, runStream, writeFile };
}

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
