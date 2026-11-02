import type { UniversalPHP } from '@php-wasm/universal';
import type { Files } from '@wp-playground/storage';
import { importWpContent } from './import-from-github';

const mocks = vi.hoisted(() => ({
	getLegacyPlaygroundRuntimeWpContentPaths: vi.fn(),
	login: vi.fn(),
	writeFiles: vi.fn(),
}));

vi.mock('@php-wasm/universal', () => ({
	writeFiles: mocks.writeFiles,
}));

vi.mock('@wp-playground/blueprints', () => ({
	activatePlugin: vi.fn(),
	activateTheme: vi.fn(),
	getLegacyPlaygroundRuntimeWpContentPaths:
		mocks.getLegacyPlaygroundRuntimeWpContentPaths,
	login: mocks.login,
}));

vi.mock('@wp-playground/storage', () => ({
	filesListToObject: vi.fn(),
}));

describe('importWpContent', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('restores current runtime artifacts when writing imported files fails', async () => {
		const runtimePath = '/wordpress/wp-content/mu-plugins/0-playground.php';
		const { php, filesystem } = createPhp({
			[runtimePath]: 'current runtime',
		});
		mocks.getLegacyPlaygroundRuntimeWpContentPaths.mockResolvedValue([
			'mu-plugins/0-playground.php',
		]);
		mocks.writeFiles.mockRejectedValue(new Error('Failed to write files'));

		await expect(importWpContent(php, {} as Files)).rejects.toThrow(
			'Failed to write files'
		);

		expect(filesystem.get(runtimePath)).toBe('current runtime');
		expect(
			[...filesystem.keys()].some((path) =>
				path.startsWith('/tmp/wp-content')
			)
		).toBe(false);
	});

	it('removes the managed db.php backup when an import supplies a custom drop-in', async () => {
		const dbPhpPath = '/wordpress/wp-content/db.php';
		const { php, filesystem } = createPhp({
			[dbPhpPath]: 'managed drop-in',
		});
		mocks.getLegacyPlaygroundRuntimeWpContentPaths
			.mockResolvedValueOnce(['db.php'])
			.mockResolvedValueOnce([]);
		mocks.writeFiles.mockImplementation(async () => {
			filesystem.set(dbPhpPath, 'custom drop-in');
		});

		await importWpContent(php, {} as Files);

		expect(filesystem.get(dbPhpPath)).toBe('custom drop-in');
		expect(
			[...filesystem.keys()].some((path) =>
				path.startsWith('/tmp/wp-content')
			)
		).toBe(false);
	});
});

function createPhp(initialFiles: Record<string, string>) {
	const filesystem = new Map(Object.entries(initialFiles));
	const hasPath = (path: string) =>
		filesystem.has(path) ||
		[...filesystem.keys()].some((filePath) =>
			filePath.startsWith(`${path}/`)
		);
	const php = {
		fileExists: vi.fn(async (path: string) => hasPath(path)),
		isDir: vi.fn(
			async (path: string) =>
				!filesystem.has(path) &&
				[...filesystem.keys()].some((filePath) =>
					filePath.startsWith(`${path}/`)
				)
		),
		mkdir: vi.fn(),
		mv: vi.fn(async (fromPath: string, toPath: string) => {
			const contents = filesystem.get(fromPath);
			if (contents === undefined) {
				throw new Error(`Missing path: ${fromPath}`);
			}
			filesystem.delete(fromPath);
			filesystem.set(toPath, contents);
		}),
		rmdir: vi.fn(async (path: string) => {
			for (const filePath of filesystem.keys()) {
				if (filePath.startsWith(`${path}/`)) {
					filesystem.delete(filePath);
				}
			}
		}),
		unlink: vi.fn(async (path: string) => {
			filesystem.delete(path);
		}),
		run: vi.fn(),
	} as unknown as UniversalPHP;
	return { php, filesystem };
}
