import {
	InMemoryFilesystemBackend,
	type ReadableFilesystemBackend,
} from '@wp-playground/storage';
import {
	loadPersistedBlueprintBundle,
	loadPersistedBlueprintBundleFromPath,
	persistBlueprintBundleAtSitePath,
	persistBlueprintBundle,
} from './opfs-blueprint-bundle-storage';

describe('opfs blueprint bundle storage', () => {
	let opfsRoot: MemoryDirectoryHandle;

	beforeEach(() => {
		opfsRoot = new MemoryDirectoryHandle('');
		vi.stubGlobal('navigator', {
			storage: {
				getDirectory: vi.fn(async () => opfsRoot),
			},
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('replaces existing bundle contents instead of keeping stale files', async () => {
		const initialBundle = new InMemoryFilesystemBackend();
		await initialBundle.writeFile('/blueprint.json', encode('first'));
		await initialBundle.writeFile('/stale.txt', encode('stale'));
		await persistBlueprintBundle('test-site', initialBundle);

		const updatedBundle = new InMemoryFilesystemBackend();
		await updatedBundle.writeFile('/blueprint.json', encode('second'));
		await updatedBundle.mkdir('/nested', true);
		await updatedBundle.writeFile('/nested/keep.txt', encode('keep'));
		await persistBlueprintBundle('test-site', updatedBundle);

		const persistedBundle = await loadPersistedBlueprintBundle('test-site');
		await expect(persistedBundle.fileExists('/stale.txt')).resolves.toBe(
			false
		);
		await expect(
			readText(persistedBundle, '/blueprint.json')
		).resolves.toBe('second');
		await expect(
			readText(persistedBundle, '/nested/keep.txt')
		).resolves.toBe('keep');
	});

	it('can persist a bundle at an already-resolved legacy site path', async () => {
		const bundle = new InMemoryFilesystemBackend();
		await bundle.writeFile('/blueprint.json', encode('legacy'));

		await persistBlueprintBundleAtSitePath('/sites/site-a-b', bundle);

		const persistedBundle =
			await loadPersistedBlueprintBundleFromPath('/sites/site-a-b');
		await expect(
			readText(persistedBundle, '/blueprint.json')
		).resolves.toBe('legacy');
	});
});

async function readText(
	filesystem: ReadableFilesystemBackend,
	path: string
): Promise<string> {
	return (await filesystem.read(path)).text();
}

function encode(content: string): Uint8Array {
	return new TextEncoder().encode(content);
}

class MemoryDirectoryHandle {
	kind = 'directory' as const;
	name: string;
	private children = new Map<
		string,
		MemoryDirectoryHandle | MemoryFileHandle
	>();

	constructor(name: string) {
		this.name = name;
	}

	async getDirectoryHandle(
		name: string,
		options?: { create?: boolean }
	): Promise<MemoryDirectoryHandle> {
		const entry = this.children.get(name);
		if (entry instanceof MemoryDirectoryHandle) {
			return entry;
		}
		if (entry) {
			throw createDomException('TypeMismatchError');
		}
		if (options?.create) {
			const directory = new MemoryDirectoryHandle(name);
			this.children.set(name, directory);
			return directory;
		}
		throw createDomException('NotFoundError');
	}

	async getFileHandle(
		name: string,
		options?: { create?: boolean }
	): Promise<MemoryFileHandle> {
		const entry = this.children.get(name);
		if (entry instanceof MemoryFileHandle) {
			return entry;
		}
		if (entry) {
			throw createDomException('TypeMismatchError');
		}
		if (options?.create) {
			const file = new MemoryFileHandle(name);
			this.children.set(name, file);
			return file;
		}
		throw createDomException('NotFoundError');
	}

	async removeEntry(name: string): Promise<void> {
		if (!this.children.delete(name)) {
			throw createDomException('NotFoundError');
		}
	}

	async *entries(): AsyncGenerator<
		[string, MemoryDirectoryHandle | MemoryFileHandle]
	> {
		for (const entry of this.children.entries()) {
			yield entry;
		}
	}
}

class MemoryFileHandle {
	kind = 'file' as const;
	name: string;
	private content = new Uint8Array();

	constructor(name: string) {
		this.name = name;
	}

	async getFile(): Promise<File> {
		return new File([this.content], this.name);
	}

	async createWritable(): Promise<MemoryWritableFileStream> {
		return new MemoryWritableFileStream((content) => {
			this.content = content;
		});
	}
}

class MemoryWritableFileStream {
	private content = new Uint8Array();
	private onClose: (content: Uint8Array) => void;

	constructor(onClose: (content: Uint8Array) => void) {
		this.onClose = onClose;
	}

	async write(content: Uint8Array): Promise<void> {
		this.content = content;
	}

	async close(): Promise<void> {
		this.onClose(this.content);
	}
}

function createDomException(name: string): DOMException {
	return new DOMException(name, name);
}
