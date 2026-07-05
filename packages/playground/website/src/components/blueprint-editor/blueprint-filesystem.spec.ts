import { describe, expect, it } from 'vitest';
import { writeBlueprintJsonToFilesystemBackend } from './blueprint-filesystem';

function createFilesystemBackend(
	writeFile: (path: string, data: Uint8Array) => void
) {
	return {
		listFiles: async () => [],
		isDir: async () => false,
		read: async () => new Blob(),
		fileExists: async () => false,
		writeFile: async (path: string, data: Uint8Array) =>
			writeFile(path, data),
		mkdir: async () => undefined,
		rmdir: async () => undefined,
		mv: async () => undefined,
		unlink: async () => undefined,
		clear: async () => undefined,
	};
}

describe('writeBlueprintJsonToFilesystemBackend', () => {
	it('updates blueprint.json in an existing bundle filesystem', async () => {
		const writes: Array<{ path: string; data: string }> = [];
		const didWrite = await writeBlueprintJsonToFilesystemBackend(
			createFilesystemBackend((path, data) =>
				writes.push({
					path,
					data: new TextDecoder().decode(data),
				})
			) as any,
			'{"steps":[]}'
		);

		expect(didWrite).toBe(true);
		expect(writes).toEqual([
			{ path: '/blueprint.json', data: '{"steps":[]}' },
		]);
	});

	it('leaves declaration-only Blueprints for metadata replacement', async () => {
		const didWrite = await writeBlueprintJsonToFilesystemBackend(
			{ steps: [] } as any,
			'{"steps":[]}'
		);

		expect(didWrite).toBe(false);
	});
});
