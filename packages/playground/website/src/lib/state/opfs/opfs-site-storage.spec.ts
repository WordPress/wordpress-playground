import type { SiteMetadata } from '../redux/slice-sites';
import type * as OpfsSiteStorageModule from './opfs-site-storage';
import type { opfsSiteStorage as exportedOpfsSiteStorage } from './opfs-site-storage';

describe('opfsSiteStorage', () => {
	let opfsRoot: MemoryDirectoryHandle;
	let opfsModule: typeof OpfsSiteStorageModule;
	let storage: NonNullable<typeof exportedOpfsSiteStorage>;

	beforeEach(async () => {
		vi.resetModules();
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
						await writeOpfsPath(
							opfsRoot,
							message.path,
							message.content
						);
						port?.postMessage('done');
					}, 0);
				}
				terminate() {}
			}
		);
		vi.doMock('./opfs-blueprint-bundle-storage', () => ({
			BUNDLE_DIR_NAME: 'blueprint-bundle',
			loadPersistedBlueprintBundle: vi.fn(),
			loadPersistedBlueprintBundleFromPath: vi.fn(),
		}));
		vi.doMock('@wp-playground/blueprints', () => ({
			getBlueprintDeclaration: vi.fn(async (blueprint) => blueprint),
		}));

		opfsModule = await import('./opfs-site-storage');
		storage = opfsModule.opfsSiteStorage!;
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
		expect(opfsModule.getDirectoryPathForSite(site!)).toBe(
			'/sites/site-a-b'
		);
	});

	it('does not create a duplicate when legacy site metadata exists', async () => {
		const sitesRoot = await getSitesRoot(opfsRoot);
		await sitesRoot.getDirectoryHandle('site-a%2Fb', { create: true });
		await writeSiteMetadata(sitesRoot, 'site-a-b', 'a/b');

		await expect(
			storage.create('a/b', createSiteMetadata())
		).rejects.toThrow("Site with slug 'a/b' already exists.");
	});

	it('clears an incomplete encoded directory before creating a site', async () => {
		const sitesRoot = await getSitesRoot(opfsRoot);
		const partialDirectory = await sitesRoot.getDirectoryHandle(
			'site-a%2Fb',
			{ create: true }
		);
		partialDirectory.setFile('stale-file.php', 'old');

		await storage.create('a/b', createSiteMetadata());

		const siteDirectory = await sitesRoot.getDirectoryHandle('site-a%2Fb');
		await expect(
			siteDirectory.getFileHandle('stale-file.php')
		).rejects.toMatchObject({ name: 'NotFoundError' });
		await expect(
			siteDirectory.getFileHandle('wp-runtime.json')
		).resolves.toBeDefined();
	});

	it('reads setup URL params stored alongside site metadata', async () => {
		const originalUrlParams = {
			searchParams: {
				language: 'pl_PL',
				plugin: ['akismet', 'gutenberg'],
			},
			hash: '#blueprint',
		};
		const sitesRoot = await getSitesRoot(opfsRoot);
		await writeSiteMetadata(
			sitesRoot,
			'site-stored-site',
			'stored-site',
			originalUrlParams
		);

		await expect(storage.read('stored-site')).resolves.toMatchObject({
			slug: 'stored-site',
			originalUrlParams,
		});
	});

	it('does not list temporary failed-save placeholders as saved sites', async () => {
		const sitesRoot = await getSitesRoot(opfsRoot);
		await writeSiteMetadata(
			sitesRoot,
			'site-failed-save',
			'failed-save',
			undefined,
			createSiteMetadata({ storage: 'none' })
		);
		await writeSiteMetadata(sitesRoot, 'site-stored-site', 'stored-site');

		const sites = await storage.list();

		expect(sites.map((site) => site.slug)).toEqual(['stored-site']);
	});

	it('resets site files while preserving metadata and the Blueprint bundle', async () => {
		const sitesRoot = await getSitesRoot(opfsRoot);
		const siteDirectory = await writeSiteMetadata(
			sitesRoot,
			'site-stored-site',
			'stored-site'
		);
		siteDirectory.setFile('wp-config.php', 'old WordPress file');
		const wpContentDirectory = await siteDirectory.getDirectoryHandle(
			'wp-content',
			{ create: true }
		);
		wpContentDirectory.setFile('index.php', '<?php');
		const bundleDirectory = await siteDirectory.getDirectoryHandle(
			'blueprint-bundle',
			{ create: true }
		);
		bundleDirectory.setFile('blueprint.json', '{}');

		await storage.resetSiteFiles('stored-site');

		await expect(
			siteDirectory.getFileHandle('wp-runtime.json')
		).resolves.toBeDefined();
		await expect(
			bundleDirectory.getFileHandle('blueprint.json')
		).resolves.toBeDefined();
		await expect(
			siteDirectory.getFileHandle('wp-config.php')
		).rejects.toMatchObject({ name: 'NotFoundError' });
		await expect(
			siteDirectory.getDirectoryHandle('wp-content')
		).rejects.toMatchObject({ name: 'NotFoundError' });
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

async function writeOpfsPath(
	root: MemoryDirectoryHandle,
	path: string,
	content: string
) {
	const parts = path.split('/').filter(Boolean);
	const filename = parts.pop();
	let directory = root;
	for (const part of parts) {
		directory = await directory.getDirectoryHandle(part, { create: true });
	}
	directory.setFile(filename!, content);
}

async function writeSiteMetadata(
	sitesRoot: MemoryDirectoryHandle,
	directoryName: string,
	slug: string,
	originalUrlParams?: {
		searchParams?: Record<string, string | string[]>;
		hash?: string;
	},
	metadata = createSiteMetadata()
) {
	const siteDirectory = await sitesRoot.getDirectoryHandle(directoryName, {
		create: true,
	});
	siteDirectory.setFile(
		'wp-runtime.json',
		JSON.stringify({
			slug,
			originalUrlParams,
			...metadata,
		})
	);
	return siteDirectory;
}

function createSiteMetadata(
	overrides: Partial<SiteMetadata> = {}
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
		...overrides,
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

	async removeEntry(name: string) {
		if (!this.children.delete(name)) {
			throw createDomException('NotFoundError');
		}
	}

	async *values() {
		yield* this.children.values();
	}

	async *entries() {
		yield* this.children.entries();
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
