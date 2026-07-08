import { TextWriter, Uint8ArrayReader, ZipReader } from '@zip.js/zip.js';
import { zipSite } from './boot-opfs-bridge';

describe('zipSite', () => {
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

	it('zips the entire saved OPFS site directory', async () => {
		const site = await createSiteDirectory('demo-site');
		site.setFile('wp-runtime.json', '{"slug":"demo-site"}');
		const wpContent = await site.getDirectoryHandle('wp-content', {
			create: true,
		});
		const plugins = await wpContent.getDirectoryHandle('plugins', {
			create: true,
		});
		plugins.setFile('hello.php', '<?php echo "Hello";');

		const zipBytes = await zipSite('demo-site');
		const archive = await readZipEntries(zipBytes);

		expect(archive.files.get('wp-runtime.json')).toBe(
			'{"slug":"demo-site"}'
		);
		expect(archive.files.get('wp-content/plugins/hello.php')).toBe(
			'<?php echo "Hello";'
		);
	});

	it('uses the legacy slug directory when the canonical directory is incomplete', async () => {
		const sitesRoot = await getSitesRoot();
		await sitesRoot.getDirectoryHandle('site-a%2Fb', { create: true });
		const legacySite = await sitesRoot.getDirectoryHandle('site-a-b', {
			create: true,
		});
		legacySite.setFile('wp-runtime.json', '{"slug":"a/b"}');
		legacySite.setFile('index.php', 'legacy');

		const zipBytes = await zipSite('a/b');
		const archive = await readZipEntries(zipBytes);

		expect(archive.files.get('index.php')).toBe('legacy');
	});

	it('applies glob-style exclusions to zip paths', async () => {
		const site = await createSiteDirectory('excluded-site');
		site.setFile('wp-runtime.json', '{}');
		site.setFile('wp-config.php', 'secret');
		site.setFile('debug.log', 'root log');
		const bundle = await site.getDirectoryHandle('blueprint-bundle', {
			create: true,
		});
		bundle.setFile('blueprint.json', '{}');
		const wpContent = await site.getDirectoryHandle('wp-content', {
			create: true,
		});
		wpContent.setFile('debug.log', 'nested log');
		const plugins = await wpContent.getDirectoryHandle('plugins', {
			create: true,
		});
		plugins.setFile('excluded.php', '<?php excluded();');
		plugins.setFile('readme.txt', 'keep');

		const zipBytes = await zipSite('excluded-site', {
			exclude: [
				'/blueprint-bundle/**',
				'/**/wp-config.php',
				'**/*.log',
				'/wp-content/plugins/*.php',
			],
		});
		const archive = await readZipEntries(zipBytes);

		expect(archive.files.has('wp-runtime.json')).toBe(true);
		expect(archive.directories.has('blueprint-bundle/')).toBe(false);
		expect(archive.files.has('blueprint-bundle/blueprint.json')).toBe(
			false
		);
		expect(archive.files.has('wp-config.php')).toBe(false);
		expect(archive.files.has('debug.log')).toBe(false);
		expect(archive.files.has('wp-content/debug.log')).toBe(false);
		expect(archive.files.has('wp-content/plugins/excluded.php')).toBe(
			false
		);
		expect(archive.files.get('wp-content/plugins/readme.txt')).toBe('keep');
	});

	it('preserves empty directories in the zip', async () => {
		const site = await createSiteDirectory('empty-dir-site');
		site.setFile('wp-runtime.json', '{}');
		const uploads = await (
			await site.getDirectoryHandle('wp-content', { create: true })
		).getDirectoryHandle('uploads', { create: true });
		await uploads.getDirectoryHandle('empty-cache', { create: true });

		const zipBytes = await zipSite('empty-dir-site');
		const archive = await readZipEntries(zipBytes);

		expect(archive.directories.has('wp-content/uploads/empty-cache/')).toBe(
			true
		);
	});

	it('throws a NotFoundError when the saved site does not exist', async () => {
		await expect(zipSite('missing-site')).rejects.toMatchObject({
			name: 'NotFoundError',
		});
	});

	async function createSiteDirectory(slug: string) {
		const sitesRoot = await getSitesRoot();
		return await sitesRoot.getDirectoryHandle(`site-${slug}`, {
			create: true,
		});
	}

	async function getSitesRoot() {
		return await opfsRoot.getDirectoryHandle('sites', { create: true });
	}
});

async function readZipEntries(zipBytes: Uint8Array) {
	const reader = new ZipReader(new Uint8ArrayReader(zipBytes));
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
		return {
			files,
			directories,
		};
	} finally {
		await reader.close();
	}
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
		return new Blob([this.content]);
	}
}

function createDomException(name: string) {
	const error = new Error(name);
	error.name = name;
	return error;
}
