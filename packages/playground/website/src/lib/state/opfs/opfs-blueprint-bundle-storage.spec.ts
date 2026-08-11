import type { TraversableFilesystemBackend } from '@wp-playground/storage';
import {
	isTraversableFilesystemBackend,
	persistBlueprintBundle,
} from './opfs-blueprint-bundle-storage';

const mocks = vi.hoisted(() => ({
	copyFilesystem: vi.fn(),
	fromPath: vi.fn(),
}));

vi.mock('@wp-playground/storage', () => ({
	OpfsFilesystemBackend: { fromPath: mocks.fromPath },
	copyFilesystem: mocks.copyFilesystem,
}));

describe('persistBlueprintBundle', () => {
	beforeEach(() => {
		mocks.copyFilesystem.mockReset();
		mocks.fromPath.mockReset();
	});

	it('returns the destination backend after copying the bundle', async () => {
		const source = {} as TraversableFilesystemBackend;
		const destination = {};
		mocks.fromPath.mockResolvedValue(destination);

		await expect(
			persistBlueprintBundle('copied-site', source)
		).resolves.toBe(destination);

		expect(mocks.fromPath).toHaveBeenCalledWith(
			'/sites/site-copied-site/blueprint-bundle',
			true
		);
		expect(mocks.copyFilesystem).toHaveBeenCalledWith(source, destination);
	});
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
