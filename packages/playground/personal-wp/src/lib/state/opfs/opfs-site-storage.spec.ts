import type { SiteMetadata } from '../redux/slice-sites';
import type { opfsSiteStorage as exportedOpfsSiteStorage } from './opfs-site-storage';

describe('opfsSiteStorage', () => {
	let opfsRoot: MemoryDirectoryHandle;
	let storage: NonNullable<typeof exportedOpfsSiteStorage>;
	let legacyOpfsPathSymbol: symbol;
	let loadPersistedBlueprintBundle: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		vi.resetModules();
		loadPersistedBlueprintBundle = vi.fn();
		opfsRoot = new MemoryDirectoryHandle('');
		vi.stubGlobal('navigator', {
			storage: {
				getDirectory: vi.fn(async () => opfsRoot),
			},
		});
		vi.doMock('./opfs-blueprint-bundle-storage', () => ({
			loadPersistedBlueprintBundle,
		}));
		vi.doMock('@wp-playground/blueprints', () => ({
			getBlueprintDeclaration: vi.fn(async (blueprint) => blueprint),
		}));

		const module = await import('./opfs-site-storage');
		storage = module.opfsSiteStorage!;
		legacyOpfsPathSymbol = module.legacyOpfsPathSymbol;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('preserves the legacy OPFS mount path for legacy site directories', async () => {
		const sitesRoot = await getSitesRoot(opfsRoot);
		await sitesRoot.getDirectoryHandle('site-example.com', {
			create: true,
		});
		await writeSiteMetadata(sitesRoot, 'site-example-com', 'example.com');

		const site = await storage.read('example.com');

		expect(site).toMatchObject({
			slug: 'example.com',
			metadata: {
				name: 'Test Playground',
			},
		});
		expect((site!.metadata as any)[legacyOpfsPathSymbol]).toBe(
			'/sites/site-example-com'
		);
	});

	it('does not add a legacy OPFS mount path for canonical directories', async () => {
		const sitesRoot = await getSitesRoot(opfsRoot);
		await writeSiteMetadata(sitesRoot, 'site-example.com', 'example.com');

		const site = await storage.read('example.com');

		expect((site!.metadata as any)[legacyOpfsPathSymbol]).toBeUndefined();
	});

	it('loads persisted Blueprint bundles for stored bundle metadata', async () => {
		const bundle = { read: vi.fn(), listFiles: vi.fn(), isDir: vi.fn() };
		loadPersistedBlueprintBundle.mockResolvedValue(bundle);
		const sitesRoot = await getSitesRoot(opfsRoot);
		await writeSiteMetadata(sitesRoot, 'site-bundle', 'bundle', {
			originalBlueprintSource: {
				type: 'opfs-site',
			},
		});

		const site = await storage.read('bundle');

		expect(loadPersistedBlueprintBundle).toHaveBeenCalledWith('bundle');
		expect(site?.metadata.originalBlueprint).toBe(bundle);
	});
});

async function getSitesRoot(opfsRoot: MemoryDirectoryHandle) {
	return opfsRoot.getDirectoryHandle('sites');
}

async function writeSiteMetadata(
	sitesRoot: MemoryDirectoryHandle,
	directoryName: string,
	slug: string,
	metadata: Partial<SiteMetadata> = {}
) {
	const siteDirectory = await sitesRoot.getDirectoryHandle(directoryName, {
		create: true,
	});
	siteDirectory.setFile(
		'wp-runtime.json',
		JSON.stringify({
			slug,
			...createSiteMetadata(metadata),
		})
	);
}

function createSiteMetadata(
	metadata: Partial<SiteMetadata> = {}
): SiteMetadata {
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
		...metadata,
	};
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

	async getFileHandle(name: string): Promise<MemoryFileHandle> {
		const entry = this.children.get(name);
		if (entry instanceof MemoryFileHandle) {
			return entry;
		}
		if (entry) {
			throw createDomException('TypeMismatchError');
		}
		throw createDomException('NotFoundError');
	}

	async *values() {
		yield* this.children.values();
	}

	async removeEntry(name: string) {
		if (!this.children.delete(name)) {
			throw createDomException('NotFoundError');
		}
	}

	setFile(name: string, content: string) {
		this.children.set(name, new MemoryFileHandle(name, content));
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
