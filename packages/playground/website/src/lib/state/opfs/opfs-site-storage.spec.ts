import type { SiteMetadata } from '../redux/slice-sites';
import type { opfsSiteStorage as exportedOpfsSiteStorage } from './opfs-site-storage';

describe('opfsSiteStorage', () => {
	let opfsRoot: MemoryDirectoryHandle;
	let storage: NonNullable<typeof exportedOpfsSiteStorage>;
	let loadPersistedBlueprintBundle: ReturnType<typeof vi.fn>;
	let loadPersistedBlueprintBundleFromPath: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		vi.resetModules();
		loadPersistedBlueprintBundle = vi.fn();
		loadPersistedBlueprintBundleFromPath = vi.fn();
		opfsRoot = new MemoryDirectoryHandle('');
		vi.stubGlobal('navigator', {
			storage: {
				getDirectory: vi.fn(async () => opfsRoot),
			},
		});
		vi.stubGlobal(
			'Worker',
			class {
				postMessage(
					message: { path: string; content: string },
					options?: { transfer?: MessagePort[] }
				) {
					const port = options?.transfer?.[0];
					setTimeout(async () => {
						try {
							await writeOpfsPath(
								opfsRoot,
								message.path,
								message.content
							);
							port?.postMessage('done');
						} catch (error) {
							port?.postMessage(
								error instanceof Error
									? error.message
									: String(error)
							);
						}
					}, 0);
				}
				terminate() {}
			}
		);
		vi.doMock('./opfs-blueprint-bundle-storage', () => ({
			BUNDLE_DIR_NAME: 'blueprint-bundle',
			loadPersistedBlueprintBundle,
			loadPersistedBlueprintBundleFromPath,
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

	it('stores setup URL params alongside site metadata', async () => {
		const originalUrlParams = {
			searchParams: {
				language: 'pl_PL',
				plugin: ['akismet', 'gutenberg'],
			},
			hash: '#blueprint',
		};

		await storage.create(
			'stored-site',
			createSiteMetadata(),
			originalUrlParams
		);

		await expect(storage.read('stored-site')).resolves.toMatchObject({
			slug: 'stored-site',
			originalUrlParams,
		});
	});

	it('updates setup URL params alongside site metadata', async () => {
		await storage.create('stored-site', createSiteMetadata(), {
			searchParams: { language: 'en_US' },
		});
		const originalUrlParams = {
			searchParams: {
				language: 'pl_PL',
				multisite: 'yes',
			},
		};

		await storage.update(
			'stored-site',
			createSiteMetadata({ name: 'Renamed Playground' }),
			originalUrlParams
		);

		await expect(storage.read('stored-site')).resolves.toMatchObject({
			metadata: {
				name: 'Renamed Playground',
			},
			originalUrlParams,
		});
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

async function writeOpfsPath(
	opfsRoot: MemoryDirectoryHandle,
	path: string,
	content: string
) {
	const pathParts = path.split('/').filter(Boolean);
	const fileName = pathParts.pop();
	if (!fileName) {
		throw new Error(`Cannot write OPFS file without a file name: ${path}`);
	}
	let directory = opfsRoot;
	for (const pathPart of pathParts) {
		directory = await directory.getDirectoryHandle(pathPart, {
			create: true,
		});
	}
	directory.setFile(fileName, content);
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
