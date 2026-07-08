// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
	shouldRequireSodiumCompatForWordPressVersion,
	storedDirectoryHasPlaygroundFiles,
	storedDirectoryHasWordPressCoreFiles,
} from './wordpress-core-file-check';

describe('storedDirectoryHasPlaygroundFiles', () => {
	it('detects a stored Playground directory', async () => {
		const directory = createStoredPlaygroundDirectory();

		await expect(
			storedDirectoryHasPlaygroundFiles(asDirectoryHandle(directory))
		).resolves.toBe(true);
	});

	it('returns false when Playground marker files are missing', async () => {
		const directory = createStoredPlaygroundDirectory();
		directory.deleteFile('wp-config.php');

		await expect(
			storedDirectoryHasPlaygroundFiles(asDirectoryHandle(directory))
		).resolves.toBe(false);
	});

	it('does not classify permission errors as missing Playground files', async () => {
		const directory = createStoredPlaygroundDirectory();
		directory.failFileReadWith('NotAllowedError');

		await expect(
			storedDirectoryHasPlaygroundFiles(asDirectoryHandle(directory))
		).rejects.toMatchObject({ name: 'NotAllowedError' });
	});
});

describe('storedDirectoryHasWordPressCoreFiles', () => {
	it('does not require sodium_compat for WordPress versions before 5.2', async () => {
		const directory = createWordPressDirectory({ hasSodiumCompat: false });

		await expect(
			storedDirectoryHasWordPressCoreFiles(directory, '5.1')
		).resolves.toBe(true);
	});

	it('requires sodium_compat for WordPress versions that ship it', async () => {
		const incompleteDirectory = createWordPressDirectory({
			hasSodiumCompat: false,
		});
		const completeDirectory = createWordPressDirectory({
			hasSodiumCompat: true,
		});

		await expect(
			storedDirectoryHasWordPressCoreFiles(incompleteDirectory, '6.8')
		).resolves.toBe(false);
		await expect(
			storedDirectoryHasWordPressCoreFiles(completeDirectory, '6.8')
		).resolves.toBe(true);
	});

	it('does not classify permission errors as missing core files', async () => {
		const directory = {
			async getDirectoryHandle() {
				throw createDomException('NotAllowedError');
			},
		} as unknown as FileSystemDirectoryHandle;

		await expect(
			storedDirectoryHasWordPressCoreFiles(directory, '6.8')
		).rejects.toMatchObject({ name: 'NotAllowedError' });
	});
});

describe('shouldRequireSodiumCompatForWordPressVersion', () => {
	it.each([
		['5.1', false],
		['5.2', true],
		['6.0', true],
		['latest', true],
		['trunk', true],
		[undefined, true],
		[false, false],
	] as const)('handles WordPress %s', (wpVersion, expected) => {
		expect(shouldRequireSodiumCompatForWordPressVersion(wpVersion)).toBe(
			expected
		);
	});
});

function asDirectoryHandle(
	directory: MemoryDirectoryHandle
): FileSystemDirectoryHandle {
	return directory as unknown as FileSystemDirectoryHandle;
}

function createStoredPlaygroundDirectory(): MemoryDirectoryHandle {
	const root = new MemoryDirectoryHandle();
	root.setFile('wp-config.php');
	root.setDirectory('wp-content')
		.setDirectory('database')
		.setFile('.ht.sqlite');
	return root;
}

function createWordPressDirectory({
	hasSodiumCompat,
}: {
	hasSodiumCompat: boolean;
}): FileSystemDirectoryHandle {
	const root = new MemoryDirectoryHandle();
	root.setFile('wp-settings.php');
	const wpIncludes = root.setDirectory('wp-includes');
	wpIncludes.setFile('version.php');
	if (hasSodiumCompat) {
		wpIncludes.setDirectory('sodium_compat').setFile('autoload.php');
	}
	return root as unknown as FileSystemDirectoryHandle;
}

class MemoryDirectoryHandle {
	private readonly directories = new Map<string, MemoryDirectoryHandle>();
	private readonly files = new Set<string>();
	private fileReadErrorName: string | undefined;

	setDirectory(name: string): MemoryDirectoryHandle {
		const directory = new MemoryDirectoryHandle();
		this.directories.set(name, directory);
		return directory;
	}

	setFile(name: string) {
		this.files.add(name);
	}

	deleteFile(name: string) {
		this.files.delete(name);
	}

	failFileReadWith(name: string) {
		this.fileReadErrorName = name;
	}

	async getDirectoryHandle(name: string): Promise<MemoryDirectoryHandle> {
		const directory = this.directories.get(name);
		if (!directory) {
			throw createDomException('NotFoundError');
		}
		return directory;
	}

	async *keys() {
		yield* [...this.directories.keys(), ...this.files.keys()];
	}

	async getFileHandle(name: string): Promise<object> {
		if (this.fileReadErrorName) {
			throw createDomException(this.fileReadErrorName);
		}
		if (!this.files.has(name)) {
			throw createDomException('NotFoundError');
		}
		return {};
	}
}

function createDomException(name: string) {
	const error = new Error(name);
	error.name = name;
	return error;
}
