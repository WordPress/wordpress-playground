import { describe, expect, it, vi } from 'vitest';
import {
	createSpawnHandler,
	phpEventStdinTransfer,
	type PHPEventWithStdinTransfer,
} from '@php-wasm/util';
import { __private__dont__use, MountStillActiveError, PHP } from './php';

type RuntimeInitializedWithStdin = PHPEventWithStdinTransfer & {
	type: 'runtime.initialized';
};

describe('PHP events', () => {
	it('gives every matching listener its own branded stdin stream', async () => {
		const php = new PHP();
		const streamContents: Promise<number[]>[] = [];
		const collectStdin = (event: RuntimeInitializedWithStdin) => {
			// Lock each stream immediately, before dispatch advances to the next listener.
			streamContents.push(readStream(event.stdin));
		};
		php.addEventListener('runtime.initialized', (event) => {
			if (event.type === 'runtime.initialized') {
				collectStdin(event as RuntimeInitializedWithStdin);
			}
		});
		php.addEventListener('runtime.initialized', (event) => {
			if (event.type === 'runtime.initialized') {
				collectStdin(event as RuntimeInitializedWithStdin);
			}
		});
		php.addEventListener('*', (event) => {
			if (event.type === 'runtime.initialized') {
				collectStdin(event as RuntimeInitializedWithStdin);
			}
		});

		php.dispatchEvent({
			type: 'runtime.initialized',
			stdin: new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new Uint8Array([1, 2, 3]));
					controller.close();
				},
			}),
			[phpEventStdinTransfer]: true,
		} satisfies RuntimeInitializedWithStdin);

		expect(streamContents).toHaveLength(3);
		expect(await Promise.all(streamContents)).toEqual([
			[1, 2, 3],
			[1, 2, 3],
			[1, 2, 3],
		]);
	});
});

async function readStream(stream: ReadableStream<Uint8Array>) {
	const bytes: number[] = [];
	const reader = stream.getReader();
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			return bytes;
		}
		bytes.push(...value);
	}
}

describe('PHP mounts', () => {
	it('forgets mount tracking even when the unmount callback fails', async () => {
		// `PHP#mount` stores each mount in the private `#mounts` map and
		// returns a thin wrapper that:
		//
		// 1. Invokes the underlying unmount callback returned by the
		//    mount handler.
		// 2. Deletes the entry from `#mounts` after ordinary failures so the
		//    JS-side bookkeeping stays authoritative when the underlying
		//    filesystem did not explicitly report that it remains mounted.
		//
		// `#mounts` is not observable from outside the class, so we
		// verify the cleanup transitively through `hotSwapPHPRuntime`,
		// which iterates `#mounts` and awaits `mount.unmount()` on each
		// entry before initializing the new runtime. Two assertions
		// together prove the entry was removed:
		//
		// - `hotSwapPHPRuntime(0)` must reject with the downstream
		//   `'Runtime with id 0 not found'` error (raised by
		//   `initializeRuntime` via `popLoadedRuntime`). If `#mounts`
		//   still held the failed entry, the iteration would re-invoke
		//   `unmountCallback` and the rejection would be `unmountError`
		//   instead, never reaching `initializeRuntime`.
		//
		// - `unmountCallback` must have been called exactly once across
		//   both the explicit `unmount()` call and the subsequent
		//   `hotSwapPHPRuntime` attempt. Any stale ordinary-failure entry would
		//   bump the count to 2.
		const php = new PHP();
		(php as any)[__private__dont__use] = {
			FS: {
				chdir: vi.fn(),
				cwd: vi.fn(() => '/'),
				lookupPath: vi.fn(() => ({})),
				readdir: vi.fn(() => ['.', '..']),
			},
		};
		const unmountError = new Error('unmount failed');
		const unmountCallback = vi.fn(async () => {
			throw unmountError;
		});
		const unmount = await php.mount('/mounted', async () => {
			return unmountCallback;
		});

		await expect(unmount()).rejects.toBe(unmountError);
		expect(unmountCallback).toHaveBeenCalledTimes(1);

		await expect(php.hotSwapPHPRuntime(0 as any)).rejects.toThrow(
			'Runtime with id 0 not found'
		);
		expect(unmountCallback).toHaveBeenCalledTimes(1);
	});

	it('retains mount tracking when the unmount reports it is still active', async () => {
		const php = new PHP();
		(php as any)[__private__dont__use] = {
			FS: {
				chdir: vi.fn(),
				cwd: vi.fn(() => '/'),
				lookupPath: vi.fn(() => ({})),
				readdir: vi.fn(() => ['.', '..']),
			},
			spawnProcess: undefined,
		};
		const flushError = new Error('flush failed');
		const activeError = new MountStillActiveError(flushError);
		const unmountCallback = vi
			.fn()
			.mockRejectedValueOnce(activeError)
			.mockResolvedValueOnce(undefined);
		const unmount = await php.mount('/mounted', async () => {
			return unmountCallback;
		});

		await expect(unmount()).rejects.toBe(activeError);
		await expect(php.hotSwapPHPRuntime(0 as any)).rejects.toThrow(
			'Runtime with id 0 not found'
		);

		expect(unmountCallback).toHaveBeenCalledTimes(2);
	});
});

describe('PHP spawn handlers', () => {
	it('routes commands to command-specific or generic handlers', async () => {
		const php = new PHP();
		(php as any)[__private__dont__use] = {
			FS: {
				cwd: vi.fn(() => '/'),
			},
		};
		await expect(php.cli(['pwd'])).rejects.toMatchObject({
			code: 'SPAWN_UNSUPPORTED',
		});

		await php.setSpawnHandler(() => {
			throw new Error('generic handler');
		});
		php.setCommandSpawnHandler('sendmail', () => {
			throw new Error('sendmail handler');
		});

		await expect(php.cli(['/usr/sbin/sendmail', '-t'])).rejects.toThrow(
			'sendmail handler'
		);

		await expect(php.cli(['pwd', '-P'])).rejects.toThrow('generic handler');
	});

	it('keeps command-specific handlers after replacing the generic handler', async () => {
		const php = new PHP();
		(php as any)[__private__dont__use] = {
			FS: {
				cwd: vi.fn(() => '/'),
			},
		};

		php.setCommandSpawnHandler('sendmail', () => {
			throw new Error('sendmail handler');
		});
		await php.setSpawnHandler(() => {
			throw new Error('generic handler');
		});

		await expect(php.cli(['/usr/sbin/sendmail', '-t'])).rejects.toThrow(
			'sendmail handler'
		);
	});

	it('routes PHP code execution to command-specific handlers', async () => {
		const php = new PHP();
		const runtime = createRuntimeThatExecutes(php, ['sendmail', '-t']);
		(php as any)[__private__dont__use] = runtime;

		php.setCommandSpawnHandler(
			'sendmail',
			createSpawnHandler(async (command: string[], processApi: any) => {
				expect(command).toEqual(['sendmail', '-t']);
				processApi.stdout('sent mail');
				await new Promise((resolve) => setTimeout(resolve, 1));
				processApi.exit(0);
			})
		);
		await php.setSpawnHandler(() => {
			throw new Error('generic handler');
		});

		const response = await php.run({
			code: `<?php echo exec("sendmail -t");`,
		});

		expect(runtime.FS.writeFile).toHaveBeenCalledWith(
			'/internal/eval.php',
			`<?php echo exec("sendmail -t");`
		);
		expect(response.text).toBe('sent mail');
	});
});

function createRuntimeThatExecutes(php: PHP, command: string[]) {
	const runtime: any = {
		FS: {
			cwd: vi.fn(() => '/'),
			writeFile: vi.fn(),
		},
		ccall: vi.fn(async (name: string) => {
			if (name !== 'wasm_sapi_handle_request') {
				return 0;
			}

			const response = await php.cli(command);
			runtime.onStdout(await response.stdoutBytes);
			runtime.onStderr(
				new TextEncoder().encode(await response.stderrText)
			);
			return await response.exitCode;
		}),
	};
	return runtime;
}
