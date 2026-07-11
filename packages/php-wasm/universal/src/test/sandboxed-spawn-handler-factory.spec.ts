import { describe, expect, it, vi } from 'vitest';
import { sandboxedSpawnHandlerFactory } from '../lib/sandboxed-spawn-handler-factory';

describe('sandboxedSpawnHandlerFactory()', () => {
	it('interrupts a pending PHP call when the spawned runtime exits', async () => {
		let rejectExit!: (error: Error) => void;
		const exited = new Promise<never>((_resolve, reject) => {
			rejectExit = reject;
		});
		let resolveCliStarted!: () => void;
		const cliStarted = new Promise<void>((resolve) => {
			resolveCliStarted = resolve;
		});
		let stdoutController!: ReadableStreamDefaultController<Uint8Array>;
		let stderrController!: ReadableStreamDefaultController<Uint8Array>;
		const reap = vi.fn();
		const php = {
			cwd: vi.fn(() => '/wordpress'),
			cli: vi.fn(async () => {
				resolveCliStarted();
				return {
					stdout: new ReadableStream<Uint8Array>({
						start(controller) {
							stdoutController = controller;
						},
					}),
					stderr: new ReadableStream<Uint8Array>({
						start(controller) {
							stderrController = controller;
						},
					}),
					exitCode: new Promise<number>(() => undefined),
				};
			}),
		};
		const spawn = sandboxedSpawnHandlerFactory(async () => ({
			php: php as any,
			reap,
			exited,
		}));
		const child = spawn('/internal/shared/bin/php', [
			'/wordpress/child.php',
		]);
		const stderr: string[] = [];
		child.stderr.on('data', (chunk: unknown) => stderr.push(String(chunk)));
		const childExitCode = new Promise<number>((resolve) => {
			child.on('exit', resolve);
		});

		await cliStarted;
		rejectExit(new Error('Spawned runtime exited unexpectedly.'));
		await expect(childExitCode).resolves.toBe(1);
		stdoutController.close();
		stderrController.close();

		expect(stderr.join('')).toContain('[spawn error]');
		expect(reap).toHaveBeenCalledTimes(1);
	});
});
