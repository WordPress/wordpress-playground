/**
 * Tests for the `PHP.cli(argv, { stdin })` option.
 *
 * Verifies the feature added to close the gap documented in
 * https://github.com/WordPress/wordpress-playground/issues/3519 —
 * consumers that host the PHP-WASM runtime in a process other than the
 * one holding the user's stdin pipe (IPC bridges, worker threads, etc.)
 * can now forward bytes explicitly instead of relying on Emscripten's
 * implicit `process.stdin.fd` inheritance.
 */
import {
	PHP,
	PHPRequestHandler,
	PHPWorker,
	ProcessIdAllocator,
} from '@php-wasm/universal';
import { describe, it, expect } from 'vitest';
import { loadNodeRuntime } from '..';

const allocator = new ProcessIdAllocator();

async function makePhp(options: Parameters<typeof loadNodeRuntime>[1] = {}) {
	const id = await loadNodeRuntime('8.3', {
		...options,
		emscriptenOptions: {
			...options.emscriptenOptions,
			processId: allocator.claim(),
		},
	});
	const php = new PHP(id);
	await php.setSapiName('cli');
	return php;
}

async function readText(stream: ReadableStream<Uint8Array>): Promise<string> {
	const chunks: string[] = [];
	const decoder = new TextDecoder();
	await stream.pipeTo(
		new WritableStream({
			write(chunk) {
				chunks.push(decoder.decode(chunk, { stream: true }));
			},
		})
	);
	// Flush any pending multi-byte sequence left in the decoder's
	// internal buffer. Without this, a final chunk that ends mid-
	// sequence would be silently dropped.
	chunks.push(decoder.decode());
	return chunks.join('');
}

const STDIN_ECHO_SCRIPT =
	'$s = file_get_contents("php://stdin"); echo "len=" . strlen($s) . ";body=" . $s;';

describe('PHP.cli() stdin option', () => {
	it('preserves omitted stdin behavior', async () => {
		let hasRead = false;
		const php = await makePhp({
			emscriptenOptions: {
				stdin: () => {
					if (hasRead) {
						return null;
					}
					hasRead = true;
					return 'd'.charCodeAt(0);
				},
			},
		});
		const response = await php.cli(['php', '-r', STDIN_ECHO_SCRIPT]);
		const out = await readText(response.stdout);
		expect(out).toBe('len=1;body=d');
		expect(await response.exitCode).toBe(0);
	});

	it('preserves a caller-provided Module.stdin over explicit input', async () => {
		const bytes = new TextEncoder().encode('custom stdin');
		let cursor = 0;
		const php = await makePhp({
			emscriptenOptions: {
				stdin: () => bytes[cursor++] ?? null,
			},
		});
		const response = await php.cli(['php', '-r', STDIN_ECHO_SCRIPT], {
			stdin: 'ignored explicit input',
		});
		const out = await readText(response.stdout);
		expect(out).toBe('len=12;body=custom stdin');
		expect(await response.exitCode).toBe(0);
	});

	it('accepts a string', async () => {
		const php = await makePhp();
		const response = await php.cli(['php', '-r', STDIN_ECHO_SCRIPT], {
			stdin: 'hello-string',
		});
		const out = await readText(response.stdout);
		expect(out).toBe('len=12;body=hello-string');
		expect(await response.exitCode).toBe(0);
	});

	it('accepts a Uint8Array', async () => {
		const php = await makePhp();
		const bytes = new TextEncoder().encode('hello-bytes');
		const response = await php.cli(['php', '-r', STDIN_ECHO_SCRIPT], {
			stdin: bytes,
		});
		const out = await readText(response.stdout);
		expect(out).toBe('len=11;body=hello-bytes');
		expect(await response.exitCode).toBe(0);
	});

	it('accepts a Node Buffer (subclass of Uint8Array)', async () => {
		const php = await makePhp();
		const response = await php.cli(['php', '-r', STDIN_ECHO_SCRIPT], {
			stdin: Buffer.from('hello-buffer'),
		});
		const out = await readText(response.stdout);
		expect(out).toBe('len=12;body=hello-buffer');
		expect(await response.exitCode).toBe(0);
	});

	it('accepts a ReadableStream', async () => {
		const php = await makePhp();
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode('hello-'));
				controller.enqueue(encoder.encode('stream'));
				controller.close();
			},
		});
		const response = await php.cli(['php', '-r', STDIN_ECHO_SCRIPT], {
			stdin: stream,
		});
		const out = await readText(response.stdout);
		expect(out).toBe('len=12;body=hello-stream');
		expect(await response.exitCode).toBe(0);
	});

	it('accepts an empty string (stdin produces no bytes)', async () => {
		const php = await makePhp();
		const response = await php.cli(['php', '-r', STDIN_ECHO_SCRIPT], {
			stdin: '',
		});
		const out = await readText(response.stdout);
		expect(out).toBe('len=0;body=');
		expect(await response.exitCode).toBe(0);
	});

	it('preserves binary bytes round-trip (no UTF-8 mangling)', async () => {
		const php = await makePhp();
		// Arbitrary binary payload including null, high-bit, and control bytes.
		const payload = new Uint8Array([0, 1, 2, 127, 128, 200, 255, 13, 10]);
		const response = await php.cli(
			[
				'php',
				'-r',
				'$s = file_get_contents("php://stdin"); ' +
					'foreach (str_split($s) as $c) echo ord($c) . ",";',
			],
			{ stdin: payload }
		);
		const out = await readText(response.stdout);
		expect(out).toBe('0,1,2,127,128,200,255,13,10,');
		expect(await response.exitCode).toBe(0);
	});

	it('fread(STDIN, …) observes the provided bytes', async () => {
		const php = await makePhp();
		const response = await php.cli(
			['php', '-r', 'echo "[" . fread(STDIN, 100) . "]";'],
			{ stdin: 'via-fread' }
		);
		const out = await readText(response.stdout);
		expect(out).toBe('[via-fread]');
		expect(await response.exitCode).toBe(0);
	});

	it('forwards stdin through PHPWorker.cli()', async () => {
		const handler = new PHPRequestHandler({
			documentRoot: '/wordpress',
			absoluteUrl: 'http://127.0.0.1:2398',
			phpFactory: async () => await makePhp(),
		});
		const worker = new PHPWorker(handler);
		await worker.setPrimaryPHP(await handler.getPrimaryPhp());
		try {
			const response = await worker.cli(
				['php', '-r', STDIN_ECHO_SCRIPT],
				{
					stdin: 'worker stdin',
				}
			);
			expect(await readText(response.stdout)).toBe(
				'len=12;body=worker stdin'
			);
			expect(await response.exitCode).toBe(0);
		} finally {
			await worker[Symbol.asyncDispose]();
			await handler[Symbol.asyncDispose]();
		}
	});
});
