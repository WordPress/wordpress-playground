import { describe, expect, it } from 'vitest';
import {
	directoryHandleHasEntries,
	probeDirectoryHandle,
} from './local-directory-handle';

function fakeHandle(overrides: Record<string, unknown>) {
	return overrides as unknown as FileSystemDirectoryHandle;
}

function keysOf(...names: string[]) {
	return () => {
		const remaining = [...names];
		return {
			next: async () =>
				remaining.length > 0
					? { done: false, value: remaining.shift() }
					: { done: true, value: undefined },
		};
	};
}

describe('probeDirectoryHandle', () => {
	it('reports a readable granted handle as ready', async () => {
		const handle = fakeHandle({
			queryPermission: async () => 'granted',
			keys: keysOf('index.php'),
		});
		expect(await probeDirectoryHandle(handle)).toBe('ready');
	});

	it('reports an empty readable folder as ready', async () => {
		const handle = fakeHandle({
			queryPermission: async () => 'granted',
			keys: keysOf(),
		});
		expect(await probeDirectoryHandle(handle)).toBe('ready');
	});

	it('requires permission when the grant lapsed', async () => {
		const handle = fakeHandle({
			queryPermission: async () => 'prompt',
			keys: keysOf('index.php'),
		});
		expect(await probeDirectoryHandle(handle)).toBe('needs-permission');
	});

	it('detects a folder that no longer exists despite a live grant', async () => {
		const handle = fakeHandle({
			queryPermission: async () => 'granted',
			keys: () => ({
				next: async () => {
					throw new DOMException('Gone.', 'NotFoundError');
				},
			}),
		});
		expect(await probeDirectoryHandle(handle)).toBe('missing-directory');
	});

	it('maps other read failures to a permission problem', async () => {
		const handle = fakeHandle({
			queryPermission: async () => 'granted',
			keys: () => ({
				next: async () => {
					throw new DOMException('Nope.', 'NotAllowedError');
				},
			}),
		});
		expect(await probeDirectoryHandle(handle)).toBe('needs-permission');
	});

	it('treats handles without permission APIs as ready', async () => {
		expect(await probeDirectoryHandle(fakeHandle({}))).toBe('ready');
	});
});

describe('directoryHandleHasEntries', () => {
	it('reports a folder with entries', async () => {
		expect(
			await directoryHandleHasEntries(
				fakeHandle({ keys: keysOf('todo.txt') })
			)
		).toBe(true);
	});

	it('reports an empty folder', async () => {
		expect(
			await directoryHandleHasEntries(fakeHandle({ keys: keysOf() }))
		).toBe(false);
	});

	it('reports handles without iteration support as empty', async () => {
		expect(await directoryHandleHasEntries(fakeHandle({}))).toBe(false);
	});
});
