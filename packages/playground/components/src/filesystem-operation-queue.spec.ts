import { describe, expect, it } from 'vitest';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import {
	drainFilesystemOperations,
	serializeFilesystemOperation,
} from './filesystem-operation-queue';

describe('filesystem operation coordinator', () => {
	it('orders exclusive operations and drains work appended while waiting', async () => {
		const filesystem = {} as AsyncWritableFilesystem;
		const events: string[] = [];
		let markFirstStarted = () => {};
		const firstStarted = new Promise<void>((resolve) => {
			markFirstStarted = resolve;
		});
		let releaseFirst = () => {};
		const firstGate = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const first = serializeFilesystemOperation(filesystem, async () => {
			events.push('first started');
			markFirstStarted();
			await firstGate;
			events.push('first finished');
		});
		await firstStarted;
		const drained = drainFilesystemOperations(filesystem);
		const second = serializeFilesystemOperation(filesystem, async () => {
			events.push('second finished');
		});

		expect(events).toEqual(['first started']);
		releaseFirst();
		await Promise.all([first, second, drained]);
		expect(events).toEqual([
			'first started',
			'first finished',
			'second finished',
		]);
	});

	it('continues after a rejected operation', async () => {
		const filesystem = {} as AsyncWritableFilesystem;
		await expect(
			serializeFilesystemOperation(filesystem, async () => {
				throw new Error('synthetic failure');
			})
		).rejects.toThrow('synthetic failure');

		await expect(
			serializeFilesystemOperation(filesystem, async () => 'recovered')
		).resolves.toBe('recovered');
	});
});
