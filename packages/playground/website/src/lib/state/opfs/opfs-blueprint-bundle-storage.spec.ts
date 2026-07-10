import {
	deletePersistedBlueprintBundleVersion,
	isTraversableFilesystemBackend,
	loadPersistedBlueprintBundle,
	persistBlueprintBundle,
} from './opfs-blueprint-bundle-storage';
import type { TraversableFilesystemBackend } from '@wp-playground/storage';

const storageMocks = vi.hoisted(() => ({
	fromPath: vi.fn(),
	copyFilesystem: vi.fn(),
	rawBackend: {
		read: vi.fn(),
		listFiles: vi.fn(async () => [] as string[]),
		isDir: vi.fn(),
		fileExists: vi.fn(),
		writeFile: vi.fn(),
		mkdir: vi.fn(),
		rmdir: vi.fn(),
		mv: vi.fn(),
		unlink: vi.fn(),
		clear: vi.fn(),
	},
}));

vi.mock('@wp-playground/storage', () => ({
	OpfsFilesystemBackend: { fromPath: storageMocks.fromPath },
	copyFilesystem: storageMocks.copyFilesystem,
}));

beforeEach(() => {
	storageMocks.fromPath.mockReset();
	storageMocks.fromPath.mockResolvedValue(storageMocks.rawBackend);
	storageMocks.copyFilesystem.mockReset();
	for (const method of Object.values(storageMocks.rawBackend)) {
		method.mockReset();
	}
	storageMocks.rawBackend.listFiles.mockResolvedValue([]);
});

describe('isTraversableFilesystemBackend', () => {
	it('requires traversal members to be functions', () => {
		expect(
			isTraversableFilesystemBackend({
				read: vi.fn(),
				listFiles: vi.fn(),
				isDir: vi.fn(),
			})
		).toBe(true);
		expect(
			isTraversableFilesystemBackend({
				read: true,
				listFiles: [],
				isDir: 'yes',
			})
		).toBe(false);
	});
});

describe('persistBlueprintBundle', () => {
	it('writes a complete bundle into a new versioned directory', async () => {
		storageMocks.copyFilesystem.mockResolvedValue(undefined);
		const source = {} as TraversableFilesystemBackend;

		const persisted = await persistBlueprintBundle('site', source);

		expect(persisted.directory).toMatch(/^blueprint-bundle-/);
		expect(storageMocks.copyFilesystem).toHaveBeenCalledWith(
			source,
			storageMocks.rawBackend
		);
		expect(storageMocks.fromPath).toHaveBeenCalledWith(
			expect.stringContaining(`/${persisted.directory}`),
			true
		);
	});

	it('leaves the selected bundle untouched when a version copy fails', async () => {
		const copyError = new Error('bundle write failed');
		storageMocks.copyFilesystem.mockRejectedValue(copyError);
		const source = {} as TraversableFilesystemBackend;

		await expect(persistBlueprintBundle('site', source)).rejects.toThrow(
			copyError
		);

		expect(storageMocks.copyFilesystem).toHaveBeenCalledTimes(1);
		expect(storageMocks.rawBackend.clear).not.toHaveBeenCalled();
	});

	it('serializes live backend writes targeting the same physical path', async () => {
		const backend = await loadPersistedBlueprintBundle(
			'site',
			'blueprint-bundle-version'
		);
		let releaseFirstWrite = () => {};
		const firstWrite = new Promise<void>((resolve) => {
			releaseFirstWrite = resolve;
		});
		storageMocks.rawBackend.writeFile
			.mockImplementationOnce(() => firstWrite)
			.mockResolvedValueOnce(undefined);

		const first = backend.writeFile('/first.txt', new Uint8Array());
		await vi.waitFor(() => {
			expect(storageMocks.rawBackend.writeFile).toHaveBeenCalledTimes(1);
		});
		const second = backend.writeFile('/second.txt', new Uint8Array());
		await Promise.resolve();
		expect(storageMocks.rawBackend.writeFile).toHaveBeenCalledTimes(1);

		releaseFirstWrite();
		await Promise.all([first, second]);
		expect(storageMocks.rawBackend.writeFile).toHaveBeenCalledTimes(2);
	});

	it('rejects bundle directories that escape the site path', async () => {
		await expect(
			loadPersistedBlueprintBundle('site', '../../other-site')
		).rejects.toThrow('Invalid Blueprint bundle directory');
	});
});

describe('deletePersistedBlueprintBundleVersion', () => {
	it('removes only the requested versioned directory', async () => {
		await deletePersistedBlueprintBundleVersion(
			'site',
			'blueprint-bundle-inactive'
		);

		expect(storageMocks.rawBackend.rmdir).toHaveBeenCalledWith(
			'/blueprint-bundle-inactive',
			true
		);
	});

	it('rejects the legacy selected bundle directory', async () => {
		await expect(
			deletePersistedBlueprintBundleVersion('site', 'blueprint-bundle')
		).rejects.toThrow('Cannot delete non-versioned Blueprint bundle');

		expect(storageMocks.rawBackend.rmdir).not.toHaveBeenCalled();
	});
});
