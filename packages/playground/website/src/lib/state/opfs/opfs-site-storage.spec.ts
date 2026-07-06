import type { SiteMetadata } from '../redux/slice-sites';
import type { opfsSiteStorage as exportedOpfsSiteStorage } from './opfs-site-storage';

describe('opfsSiteStorage', () => {
	let opfsRoot: MemoryDirectoryHandle;
	let storage: NonNullable<typeof exportedOpfsSiteStorage>;

	beforeEach(async () => {
		vi.resetModules();
		opfsRoot = new MemoryDirectoryHandle('');
		vi.stubGlobal('navigator', {
			storage: {
				getDirectory: vi.fn(async () => opfsRoot),
			},
		});
		vi.doMock('./opfs-blueprint-bundle-storage', () => ({
			loadPersistedBlueprintBundle: vi.fn(),
			loadPersistedBlueprintBundleFromPath: vi.fn(),
		}));
		vi.doMock('@wp-playground/blueprints', () => ({
			getBlueprintDeclaration: vi.fn(async (blueprint) => blueprint),
		}));

		const module = await import('./opfs-site-storage');
		storage = module.opfsSiteStorage!;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('reads legacy site metadata when the encoded directory is incomplete', async () => {
		const sitesRoot = await getSitesRoot(opfsRoot);
		await sitesRoot.getDirectoryHandle('site-a%2Fb', { create: true });
		await writeSiteMetadata(sitesRoot, 'site-a-b', 'a/b');

		const site = await storage.read('a/b');

		expect(site).toMatchObject({
			slug: 'a/b',
			metadata: {
				name: 'Test Playground',
			},
		});
	});

	it('does not create a duplicate when legacy site metadata exists', async () => {
		const sitesRoot = await getSitesRoot(opfsRoot);
		await sitesRoot.getDirectoryHandle('site-a%2Fb', { create: true });
		await writeSiteMetadata(sitesRoot, 'site-a-b', 'a/b');

		await expect(
			storage.create('a/b', createSiteMetadata())
		).rejects.toThrow("Site with slug 'a/b' already exists.");
	});

	it('deletes the legacy site directory when the encoded directory is incomplete', async () => {
		const sitesRoot = await getSitesRoot(opfsRoot);
		await sitesRoot.getDirectoryHandle('site-a%2Fb', { create: true });
		await writeSiteMetadata(sitesRoot, 'site-a-b', 'a/b');

		await storage.delete('a/b');

		await expect(
			sitesRoot.getDirectoryHandle('site-a-b')
		).rejects.toMatchObject({ name: 'NotFoundError' });
		await expect(
			sitesRoot.getDirectoryHandle('site-a%2Fb')
		).resolves.toBeDefined();
	});
});

async function getSitesRoot(opfsRoot: MemoryDirectoryHandle) {
	return opfsRoot.getDirectoryHandle('sites');
}

async function writeSiteMetadata(
	sitesRoot: MemoryDirectoryHandle,
	directoryName: string,
	slug: string
) {
	const siteDirectory = await sitesRoot.getDirectoryHandle(directoryName, {
		create: true,
	});
	siteDirectory.setFile(
		'wp-runtime.json',
		JSON.stringify({
			slug,
			...createSiteMetadata(),
		})
	);
}

function createSiteMetadata(): SiteMetadata {
	return {
		storage: 'opfs',
		id: 'test-site-id',
		name: 'Test Playground',
		runtimeConfiguration: {
			phpVersion: '8.3',
			wpVersion: 'latest',
			intl: false,
			networking: true,
			extraLibraries: [],
			constants: {},
		},
		originalBlueprint: {},
		originalBlueprintSource: {
			type: 'none',
		},
	};
}

class MemoryDirectoryHandle {
	kind = 'directory' as const;
	name: string;
	private entries = new Map<
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
		const entry = this.entries.get(name);
		if (entry instanceof MemoryDirectoryHandle) {
			return entry;
		}
		if (entry) {
			throw createDomException('TypeMismatchError');
		}
		if (options?.create) {
			const directory = new MemoryDirectoryHandle(name);
			this.entries.set(name, directory);
			return directory;
		}
		throw createDomException('NotFoundError');
	}

	async getFileHandle(name: string): Promise<MemoryFileHandle> {
		const entry = this.entries.get(name);
		if (entry instanceof MemoryFileHandle) {
			return entry;
		}
		if (entry) {
			throw createDomException('TypeMismatchError');
		}
		throw createDomException('NotFoundError');
	}

	async removeEntry(name: string) {
		if (!this.entries.delete(name)) {
			throw createDomException('NotFoundError');
		}
	}

	async *values() {
		yield* this.entries.values();
	}

	setFile(name: string, content: string) {
		this.entries.set(name, new MemoryFileHandle(name, content));
	}
}

class MemoryFileHandle {
	kind = 'file' as const;
	name: string;
	private content: string;

	constructor(name: string, content: string) {
		this.name = name;
		this.content = content;
	}

	async getFile() {
		return {
			text: async () => this.content,
		};
	}
}

function createDomException(name: string) {
	const error = new Error(name);
	error.name = name;
	return error;
}
