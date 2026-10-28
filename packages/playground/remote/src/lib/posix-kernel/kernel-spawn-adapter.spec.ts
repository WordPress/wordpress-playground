import { describe, expect, it } from 'vitest';

import { KernelSpawnAdapter } from './kernel-spawn-adapter';
import type { BrowserKernel } from './host-bridge';
import type { CaptureHandler } from './boot';

interface Outcome {
	exitCode: number;
	stdout?: string;
	stderr?: string;
}

type Program = (argv: string[]) => Outcome | Promise<Outcome>;

function createAdapter(program: Program) {
	const spawned: string[][] = [];
	const captures: Array<CaptureHandler | null> = [];
	let capture: CaptureHandler | null = null;
	const encoder = new TextEncoder();
	const kernel = {
		async spawn(_bytes: ArrayBuffer, argv: string[]) {
			spawned.push(argv);
			const emit = capture;
			const outcome = await program(argv);
			if (outcome.stdout) {
				emit?.(encoder.encode(outcome.stdout), 'stdout');
			}
			if (outcome.stderr) {
				emit?.(encoder.encode(outcome.stderr), 'stderr');
			}
			return outcome.exitCode;
		},
	} as unknown as BrowserKernel;
	const adapter = new KernelSpawnAdapter({
		kernel,
		coreutilsBytes: new ArrayBuffer(0),
		phpWasmBytes: new ArrayBuffer(0),
		setCapture: (handler) => {
			captures.push(handler);
			capture = handler;
		},
	});
	return { adapter, spawned, captures };
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

function decode(bytes: Uint8Array): string {
	return new TextDecoder().decode(bytes);
}

describe('KernelSpawnAdapter', () => {
	describe('spawnCapturing', () => {
		it('runs concurrent spawns one at a time', async () => {
			const first = deferred<Outcome>();
			const { adapter, spawned } = createAdapter((argv) =>
				argv[0] === 'foo' ? first.promise : { exitCode: 0 }
			);

			const foo = adapter.runPhpCli({ argv: ['foo'] });
			const bar = adapter.runPhpCli({ argv: ['bar'] });
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(spawned).toEqual([['foo']]);

			first.resolve({ exitCode: 0 });
			await Promise.all([foo, bar]);
			expect(spawned).toEqual([['foo'], ['bar']]);
		});

		it('attributes stdout and stderr to the spawn that emitted them', async () => {
			const { adapter } = createAdapter((argv) => ({
				exitCode: 0,
				stdout: `${argv[0]}-out`,
				stderr: `${argv[0]}-err`,
			}));

			const [foo, bar] = await Promise.all([
				adapter.runPhpCli({ argv: ['foo'] }),
				adapter.runPhpCli({ argv: ['bar'] }),
			]);

			expect(decode(foo.stdout)).toBe('foo-out');
			expect(decode(foo.stderr)).toBe('foo-err');
			expect(decode(bar.stdout)).toBe('bar-out');
			expect(decode(bar.stderr)).toBe('bar-err');
		});

		it('runs the next spawn and resets the capture after a rejected spawn', async () => {
			const { adapter, captures } = createAdapter((argv) => {
				if (argv[0] === 'foo') {
					throw new Error('kernel crashed');
				}
				return { exitCode: 0, stdout: 'bar' };
			});

			const foo = adapter.runPhpCli({ argv: ['foo'] });
			const bar = adapter.runPhpCli({ argv: ['bar'] });

			await expect(foo).rejects.toThrow('kernel crashed');
			expect(decode((await bar).stdout)).toBe('bar');
			expect(captures.map((handler) => handler === null)).toEqual([
				false,
				true,
				false,
				true,
			]);
		});

		it('runs the next spawn after a non-zero exit', async () => {
			const { adapter } = createAdapter((argv) =>
				argv[0] === 'cat'
					? { exitCode: 1, stderr: 'missing' }
					: { exitCode: 0, stdout: 'bar' }
			);

			const read = adapter.readFileAsText('/foo');
			const run = adapter.runPhpCli({ argv: ['php'] });

			await expect(read).rejects.toThrow('missing');
			expect(decode((await run).stdout)).toBe('bar');
		});
	});

	describe('mkdir', () => {
		it('creates every path with one spawn', async () => {
			const { adapter, spawned } = createAdapter(() => ({ exitCode: 0 }));

			await adapter.mkdir('/foo', '/bar/baz');

			expect(spawned).toEqual([['mkdir', '-p', '/foo', '/bar/baz']]);
		});
	});

	describe('mv', () => {
		it('renames onto the destination instead of into it', async () => {
			const { adapter, spawned } = createAdapter(() => ({ exitCode: 0 }));

			await adapter.mv('/foo', '/bar');

			expect(spawned).toEqual([['mv', '-T', '/foo', '/bar']]);
		});

		it('completes a half-done directory move from the source remainder', async () => {
			const tree = { source: new Set(['qux']), target: new Set(['baz']) };
			const { adapter } = createAdapter((argv) => {
				const command = argv.join(' ');
				if (command === 'mv -T /foo /bar') {
					return { exitCode: 1, stderr: 'Directory not empty' };
				}
				if (command === 'test -d /foo') {
					return { exitCode: 0 };
				}
				if (command === 'cp -R /foo/. /bar') {
					tree.source.forEach((entry) => tree.target.add(entry));
					return { exitCode: 0 };
				}
				if (command === 'rm -rf /foo') {
					tree.source.clear();
					return { exitCode: 0 };
				}
				return { exitCode: 127 };
			});

			await adapter.mv('/foo', '/bar');

			expect([...tree.source]).toEqual([]);
			expect([...tree.target].sort()).toEqual(['baz', 'qux']);
		});

		it('copies a single file without the directory merge suffix', async () => {
			const { adapter, spawned } = createAdapter((argv) => ({
				exitCode: argv[0] === 'mv' || argv[0] === 'test' ? 1 : 0,
			}));

			await adapter.mv('/foo', '/bar');

			expect(spawned.slice(2)).toEqual([
				['cp', '/foo', '/bar'],
				['rm', '-rf', '/foo'],
			]);
		});

		it('keeps the source and surfaces the error when the recovery copy fails', async () => {
			const { adapter, spawned } = createAdapter((argv) => {
				if (argv[0] === 'mv') {
					return { exitCode: 1, stderr: 'mv broke' };
				}
				if (argv[0] === 'cp') {
					return { exitCode: 1, stderr: 'cp broke' };
				}
				return { exitCode: 0 };
			});

			await expect(adapter.mv('/foo', '/bar')).rejects.toThrow(
				/failed at cp .*cp broke.*mv broke/
			);
			expect(spawned.some((argv) => argv[0] === 'rm')).toBe(false);
		});

		it('surfaces the error when the recovery removal fails', async () => {
			const { adapter } = createAdapter((argv) => {
				if (argv[0] === 'mv') {
					return { exitCode: 1 };
				}
				if (argv[0] === 'rm') {
					return { exitCode: 1, stderr: 'rm broke' };
				}
				return { exitCode: 0 };
			});

			await expect(adapter.mv('/foo', '/bar')).rejects.toThrow(
				/failed at rm .*rm broke/
			);
		});
	});

	it.each([
		[0, true],
		[1, false],
	])('reports isFile from test -f exit %s', async (exitCode, expected) => {
		const { adapter, spawned } = createAdapter(() => ({ exitCode }));

		expect(await adapter.isFile('/foo')).toBe(expected);
		expect(spawned).toEqual([['test', '-f', '/foo']]);
	});

	it('deletes the tree only when recursive', async () => {
		const { adapter, spawned } = createAdapter(() => ({ exitCode: 0 }));

		await adapter.rmdir('/foo', false);
		await adapter.rmdir('/bar', true);

		expect(spawned).toEqual([
			['rmdir', '/foo'],
			['rm', '-rf', '/bar'],
		]);
	});

	it('lists an empty directory as no entries', async () => {
		const { adapter } = createAdapter(() => ({ exitCode: 0, stdout: '' }));

		expect(await adapter.listFiles('/foo')).toEqual([]);
	});
});
