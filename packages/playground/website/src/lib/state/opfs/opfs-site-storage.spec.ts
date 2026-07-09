import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
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

	it('exports complete saved OPFS site files as a ZIP', async () => {
		const sitesRoot = await getSitesRoot(opfsRoot);
		const siteDirectory = await writeSiteMetadata(
			sitesRoot,
			'site-files',
			'files'
		);
		const wpContent = await siteDirectory.getDirectoryHandle('wp-content', {
			create: true,
		});
		wpContent.setFile('hello.txt', 'Hello from OPFS');
		await wpContent.getDirectoryHandle('empty-cache', { create: true });

		const zipFile = await storage.exportSavedSiteAsZip('files');

		expect(zipFile?.type).toBe('application/zip');
		const archive = await readZipEntries(zipFile!);

		expect(archive.files.get('wp-content/hello.txt')).toBe(
			'Hello from OPFS'
		);
		expect(archive.files.has('wp-runtime.json')).toBe(true);
		expect(archive.directories.has('wp-content/empty-cache/')).toBe(true);
	});

	it('does not export directories without saved Playground metadata', async () => {
		const sitesRoot = await getSitesRoot(opfsRoot);
		const siteDirectory = await sitesRoot.getDirectoryHandle(
			'site-incomplete',
			{ create: true }
		);
		siteDirectory.setFile('wp-config.php', 'not enough to count as saved');

		await expect(
			storage.exportSavedSiteAsZip('incomplete')
		).resolves.toBeUndefined();
	});

	it('does not export saved sites whose initial OPFS sync never finished', async () => {
		const sitesRoot = await getSitesRoot(opfsRoot);
		await writeSiteMetadata(
			sitesRoot,
			'site-pending-sync',
			'pending-sync',
			{
				initialOpfsSyncPending: true,
			}
		);

		await expect(
			storage.exportSavedSiteAsZip('pending-sync')
		).resolves.toBeUndefined();
	});

	it('does not export saved sites while old OPFS files are being reset', async () => {
		const sitesRoot = await getSitesRoot(opfsRoot);
		await writeSiteMetadata(
			sitesRoot,
			'site-pending-reset',
			'pending-reset',
			{
				opfsSiteRemovalPending: true,
			}
		);

		await expect(
			storage.exportSavedSiteAsZip('pending-reset')
		).resolves.toBeUndefined();
	});

	it('returns undefined when a saved site is deleted after metadata lookup', async () => {
		const sitesRoot = await getSitesRoot(opfsRoot);
		await writeSiteMetadata(sitesRoot, 'site-deleted', 'deleted');
		const getDirectoryHandle = sitesRoot.getDirectoryHandle.bind(sitesRoot);
		let siteDirectoryWasFoundByMetadataLookup = false;
		vi.spyOn(sitesRoot, 'getDirectoryHandle').mockImplementation(
			async (name, options) => {
				if (name !== 'site-deleted' || options?.create) {
					return await getDirectoryHandle(name, options);
				}
				if (siteDirectoryWasFoundByMetadataLookup) {
					throw createDomException('NotFoundError');
				}
				siteDirectoryWasFoundByMetadataLookup = true;
				return await getDirectoryHandle(name, options);
			}
		);

		await expect(
			storage.exportSavedSiteAsZip('deleted')
		).resolves.toBeUndefined();
	});

	it('returns undefined when saved Playground metadata disappears before export starts', async () => {
		const sitesRoot = await getSitesRoot(opfsRoot);
		const siteDirectory = await writeSiteMetadata(
			sitesRoot,
			'site-missing-metadata',
			'missing-metadata'
		);
		const getFileHandle = siteDirectory.getFileHandle.bind(siteDirectory);
		let metadataWasFoundByDirectoryLookup = false;
		vi.spyOn(siteDirectory, 'getFileHandle').mockImplementation(
			async (name) => {
				if (name !== 'wp-runtime.json') {
					return await getFileHandle(name);
				}
				if (metadataWasFoundByDirectoryLookup) {
					throw createDomException('NotFoundError');
				}
				metadataWasFoundByDirectoryLookup = true;
				return await getFileHandle(name);
			}
		);

		await expect(
			storage.exportSavedSiteAsZip('missing-metadata')
		).resolves.toBeUndefined();
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

async function readZipEntries(zipFile: Blob) {
	const reader = new ZipReader(new BlobReader(zipFile));
	try {
		const entries = await reader.getEntries();
		const files = new Map<string, string>();
		const directories = new Set<string>();
		for (const entry of entries) {
			if (entry.directory) {
				directories.add(entry.filename);
			} else {
				files.set(
					entry.filename,
					await entry.getData!(new TextWriter())
				);
			}
		}
		return { files, directories };
	} finally {
		await reader.close();
	}
}

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
	return siteDirectory;
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

	async *entries() {
		yield* this.children.entries();
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
		return new Blob([this.content]);
	}
}

function createDomException(name: string) {
	const error = new Error(name);
	error.name = name;
	return error;
}
