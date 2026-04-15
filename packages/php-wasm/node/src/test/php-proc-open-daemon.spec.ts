/**
 * Tests proc_open behavior across different execution contexts.
 *
 * proc_open works with php.run() but fails through the daemon/CLI path.
 * These tests isolate where the spawn handler gets lost:
 *
 * 1. php.run() — direct PHP execution (known working)
 * 2. php.cli() — WP-CLI-style execution on same instance
 * 3. Runtime rotation — does enableRuntimeRotation preserve the handler?
 * 4. Worker thread — does the worker thread path preserve the handler?
 */
import { spawn } from 'child_process';
import { PHP, ProcessIdAllocator } from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';

const isWindows = process.platform === 'win32';
const describeUnix = isWindows ? describe.skip : describe;

const processIdAllocator = new ProcessIdAllocator();

const PROC_OPEN_TEST_CODE = `<?php
	$desc = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
	$proc = proc_open('/bin/echo proc_open_works', $desc, $pipes);
	if (is_resource($proc)) {
		$stdout = stream_get_contents($pipes[1]);
		fclose($pipes[0]);
		fclose($pipes[1]);
		fclose($pipes[2]);
		proc_close($proc);
		echo trim($stdout);
	} else {
		echo 'PROC_OPEN_FAILED';
	}
`;

describeUnix('proc_open spawn handler propagation', () => {
	let php: PHP;

	afterEach(() => {
		try {
			php.exit();
		} catch {
			// ignore
		}
	});

	it('works with php.run() — baseline', async () => {
		php = new PHP(
			await loadNodeRuntime('8.3', {
				emscriptenOptions: {
					processId: processIdAllocator.claim(),
				},
			})
		);
		await php.setSpawnHandler(spawn as any);

		const result = await php.run({ code: PROC_OPEN_TEST_CODE });
		expect(result.text).toBe('proc_open_works');
	});

	it('works with php.cli() — CLI execution path', async () => {
		php = new PHP(
			await loadNodeRuntime('8.3', {
				emscriptenOptions: {
					processId: processIdAllocator.claim(),
				},
			})
		);
		await php.setSpawnHandler(spawn as any);
		await php.setSapiName('cli');

		php.writeFile('/tmp/test-proc-open.php', PROC_OPEN_TEST_CODE);

		const result = await php.cli(['php', '/tmp/test-proc-open.php']);
		const stdout = await result.stdoutText;
		expect(stdout.trim()).toBe('proc_open_works');
	});

	it('survives runtime rotation', async () => {
		php = new PHP(
			await loadNodeRuntime('8.3', {
				emscriptenOptions: {
					processId: processIdAllocator.claim(),
				},
			})
		);
		await php.setSpawnHandler(spawn as any);

		// Enable runtime rotation (this is what bootRequestHandler does)
		php.enableRuntimeRotation({
			maxRequests: 400,
			recreateRuntime: () =>
				loadNodeRuntime('8.3', {
					emscriptenOptions: {
						processId: processIdAllocator.claim(),
					},
				}),
		});

		const result = await php.run({ code: PROC_OPEN_TEST_CODE });
		expect(result.text).toBe('proc_open_works');
	});

	it('survives runtime rotation + cli()', async () => {
		php = new PHP(
			await loadNodeRuntime('8.3', {
				emscriptenOptions: {
					processId: processIdAllocator.claim(),
				},
			})
		);
		await php.setSpawnHandler(spawn as any);
		await php.setSapiName('cli');

		php.enableRuntimeRotation({
			maxRequests: 400,
			recreateRuntime: () =>
				loadNodeRuntime('8.3', {
					emscriptenOptions: {
						processId: processIdAllocator.claim(),
					},
				}),
		});

		php.writeFile('/tmp/test-proc-open.php', PROC_OPEN_TEST_CODE);

		const result = await php.cli(['php', '/tmp/test-proc-open.php']);
		const stdout = await result.stdoutText;
		expect(stdout.trim()).toBe('proc_open_works');
	});

	it('works after runtime has been rotated', async () => {
		php = new PHP(
			await loadNodeRuntime('8.3', {
				emscriptenOptions: {
					processId: processIdAllocator.claim(),
				},
			})
		);
		await php.setSpawnHandler(spawn as any);

		php.enableRuntimeRotation({
			maxRequests: 1, // Force rotation after every request
			recreateRuntime: () =>
				loadNodeRuntime('8.3', {
					emscriptenOptions: {
						processId: processIdAllocator.claim(),
					},
				}),
		});

		// First request — uses original runtime
		const result1 = await php.run({
			code: '<?php echo "first";',
		});
		expect(result1.text).toBe('first');

		// Second request — runtime has been rotated
		const result2 = await php.run({ code: PROC_OPEN_TEST_CODE });
		expect(result2.text).toBe('proc_open_works');
	});

	it('works after runtime rotation via cli()', async () => {
		php = new PHP(
			await loadNodeRuntime('8.3', {
				emscriptenOptions: {
					processId: processIdAllocator.claim(),
				},
			})
		);
		await php.setSpawnHandler(spawn as any);
		await php.setSapiName('cli');

		php.enableRuntimeRotation({
			maxRequests: 1, // Force rotation after every request
			recreateRuntime: () =>
				loadNodeRuntime('8.3', {
					emscriptenOptions: {
						processId: processIdAllocator.claim(),
					},
				}),
		});

		// First request triggers rotation
		await php.run({ code: '<?php echo "warmup";' });

		// Second request on rotated runtime, via cli()
		php.writeFile('/tmp/test-proc-open.php', PROC_OPEN_TEST_CODE);
		const result = await php.cli(['php', '/tmp/test-proc-open.php']);
		const stdout = await result.stdoutText;
		expect(stdout.trim()).toBe('proc_open_works');
	});
});
