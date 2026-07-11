import type { WritableFilesystemBackend } from '@wp-playground/storage';
import { describe, expect, it, vi } from 'vitest';
import { getBlueprintEditorFilesystem } from './blueprint-editor-filesystem';

describe('getBlueprintEditorFilesystem', () => {
	it('makes a remounted editor wait for a write started by its predecessor', async () => {
		let finishWrite = () => {};
		const pendingWrite = new Promise<void>((resolve) => {
			finishWrite = resolve;
		});
		const backend = {
			writeFile: vi.fn(() => pendingWrite),
			read: vi.fn(async () => ({ path: '/blueprint.json' })),
		} as unknown as WritableFilesystemBackend;

		const firstEditor = getBlueprintEditorFilesystem(backend);
		const remountedEditor = getBlueprintEditorFilesystem(backend);
		expect(remountedEditor).toBe(firstEditor);

		const write = firstEditor.writeFile('/blueprint.json', 'edited');
		const read = remountedEditor.read('/blueprint.json');
		await Promise.resolve();
		expect(backend.read).not.toHaveBeenCalled();

		finishWrite();
		await write;
		await read;
		expect(backend.read).toHaveBeenCalledWith('/blueprint.json');
	});

	it('serializes writes requested before and after a remount', async () => {
		let finishFirstWrite = () => {};
		const firstWritePending = new Promise<void>((resolve) => {
			finishFirstWrite = resolve;
		});
		const observedWrites: Array<{ path: string; data: Uint8Array }> = [];
		const backend = {
			writeFile: async (path: string, data: Uint8Array) => {
				observedWrites.push({ path, data });
				if (observedWrites.length === 1) {
					await firstWritePending;
				}
			},
		} as unknown as WritableFilesystemBackend;
		const firstEditor = getBlueprintEditorFilesystem(backend);
		const remountedEditor = getBlueprintEditorFilesystem(backend);

		const firstWrite = firstEditor.writeFile('/first.json', 'first');
		const secondWrite = remountedEditor.writeFile('/second.json', 'second');
		await Promise.resolve();
		expect(observedWrites).toHaveLength(1);

		finishFirstWrite();
		await Promise.all([firstWrite, secondWrite]);
		expect(
			observedWrites.map(({ path, data }) => [
				path,
				new TextDecoder().decode(data),
			])
		).toEqual([
			['/first.json', 'first'],
			['/second.json', 'second'],
		]);
	});

	it('continues with later operations after a write fails', async () => {
		const writeError = new Error('OPFS write failed');
		const writeFile = vi
			.fn<WritableFilesystemBackend['writeFile']>()
			.mockRejectedValueOnce(writeError)
			.mockResolvedValueOnce(undefined);
		const backend = {
			writeFile,
			read: vi.fn(async () => ({ path: '/blueprint.json' })),
		} as unknown as WritableFilesystemBackend;
		const filesystem = getBlueprintEditorFilesystem(backend);

		await expect(
			filesystem.writeFile('/blueprint.json', 'first')
		).rejects.toBe(writeError);
		await expect(
			filesystem.writeFile('/blueprint.json', 'second')
		).resolves.toBeUndefined();
		await filesystem.read('/blueprint.json');

		expect(writeFile).toHaveBeenCalledTimes(2);
		expect(backend.read).toHaveBeenCalledWith('/blueprint.json');
	});
});
