import { isTraversableFilesystemBackend } from './opfs-blueprint-bundle-storage';

vi.mock('@wp-playground/storage', () => ({
	OpfsFilesystemBackend: {},
	copyFilesystem: vi.fn(),
}));

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
