import { serializeFilesystemOperation } from '@wp-playground/components';
import {
	EventedFilesystem,
	InMemoryFilesystemBackend,
} from '@wp-playground/storage';
import { describe, expect, it, vi } from 'vitest';
import {
	BlueprintFilesystemFlushError,
	registerBlueprintFilesystemFlusher,
	runWithBlueprintFilesystemSnapshot,
} from './blueprint-filesystem-write-coordinator';

/** Reads UTF-8 text from a traversable test backend. */
async function readText(
	backend: Pick<InMemoryFilesystemBackend, 'read'>,
	path: string
) {
	return new TextDecoder().decode(
		await (await backend.read(path)).arrayBuffer()
	);
}

describe('Blueprint filesystem write coordination', () => {
	it('finds an editor registration through its raw backend', async () => {
		const backend = new InMemoryFilesystemBackend({
			'blueprint.json': new TextEncoder().encode('old'),
		});
		const filesystem = new EventedFilesystem(backend);
		const flush = vi.fn(async () => {
			await filesystem.writeFile('/blueprint.json', 'new');
			return true;
		});
		const unregister = registerBlueprintFilesystemFlusher(
			filesystem,
			flush
		);

		const snapshot = await runWithBlueprintFilesystemSnapshot(
			backend,
			(source) => readText(source, '/blueprint.json')
		);

		expect(snapshot).toBe('new');
		expect(flush).toHaveBeenCalledOnce();
		unregister();
	});

	it('holds later editor writes behind the complete snapshot traversal', async () => {
		const backend = new InMemoryFilesystemBackend({
			'blueprint.json': new TextEncoder().encode('selected'),
		});
		const filesystem = new EventedFilesystem(backend);
		const unregister = registerBlueprintFilesystemFlusher(
			filesystem,
			async () => true
		);
		let releaseSnapshot = () => {};
		const snapshotBlocked = new Promise<void>((resolve) => {
			releaseSnapshot = resolve;
		});
		let markSnapshotStarted = () => {};
		const snapshotStarted = new Promise<void>((resolve) => {
			markSnapshotStarted = resolve;
		});

		const snapshot = runWithBlueprintFilesystemSnapshot(
			backend,
			async (source) => {
				const content = await readText(source, '/blueprint.json');
				markSnapshotStarted();
				await snapshotBlocked;
				return content;
			}
		);
		await snapshotStarted;
		const laterWrite = serializeFilesystemOperation(filesystem, () =>
			filesystem.writeFile('/blueprint.json', 'later')
		);
		await Promise.resolve();
		expect(await readText(backend, '/blueprint.json')).toBe('selected');

		releaseSnapshot();
		expect(await snapshot).toBe('selected');
		await laterWrite;
		expect(await readText(backend, '/blueprint.json')).toBe('later');
		unregister();
	});

	it('rejects a snapshot when the active buffer cannot be flushed', async () => {
		const backend = new InMemoryFilesystemBackend({
			'blueprint.json': new TextEncoder().encode('old'),
		});
		const filesystem = new EventedFilesystem(backend);
		const unregister = registerBlueprintFilesystemFlusher(
			filesystem,
			async () => false
		);

		await expect(
			runWithBlueprintFilesystemSnapshot(backend, async () => undefined)
		).rejects.toBeInstanceOf(BlueprintFilesystemFlushError);
		unregister();
	});
});
