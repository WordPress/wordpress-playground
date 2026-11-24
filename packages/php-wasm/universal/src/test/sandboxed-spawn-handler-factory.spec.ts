import { describe, expect, it, vi } from 'vitest';
import { sandboxedSpawnHandlerFactory } from '../lib/sandboxed-spawn-handler-factory';

describe('sandboxedSpawnHandlerFactory()', () => {
	it('interrupts a pending PHP call when the spawned runtime exits', async () => {
		let signalRuntimeExited!: () => void;
		const runtimeExited = new Promise<void>((resolve) => {
			signalRuntimeExited = resolve;
		});
		let resolveCliStarted!: () => void;
		const cliStarted = new Promise<void>((resolve) => {
			resolveCliStarted = resolve;
		});
		let stdoutController!: ReadableStreamDefaultController<Uint8Array>;
		let stderrController!: ReadableStreamDefaultController<Uint8Array>;
		// The remote CLI call cannot finish on its own. Only the runtime-exit
		// signal can unblock the sandboxed spawn handler.
		const cliExitCodeThatNeverSettles = new Promise<number>(
			() => undefined
		);
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
					exitCode: cliExitCodeThatNeverSettles,
				};
			}),
		};
		const spawn = sandboxedSpawnHandlerFactory(async () => ({
			php: php as any,
			reap,
			runtimeExited,
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
		signalRuntimeExited();
		await expect(childExitCode).resolves.toBe(1);
		stdoutController.close();
		stderrController.close();

		expect(stderr.join('')).toContain('[spawn error]');
		expect(reap).toHaveBeenCalledTimes(1);
	});
});
