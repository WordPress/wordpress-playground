import { vi } from 'vitest';
import {
	importPlugin,
	importTheme,
	importWpContent,
} from './import-from-github';

const writeFilesMock = vi.hoisted(() => vi.fn());

vi.mock('@php-wasm/universal', () => ({
	writeFiles: writeFilesMock,
}));

vi.mock('@wp-playground/blueprints', () => ({
	activatePlugin: vi.fn(),
	activateTheme: vi.fn(),
	login: vi.fn(),
	wpContentFilesExcludedFromExport: ['db.php', 'mu-plugins/0-playground.php'],
}));

describe('importWpContent', () => {
	beforeEach(() => {
		writeFilesMock.mockReset();
	});

	it('does not delete original Playground files when backing them up fails', async () => {
		const php = new FakePHP();
		php.failMoveFrom = '/wordpress/wp-content/mu-plugins/0-playground.php';

		await expect(importWpContent(php as any, {})).rejects.toThrow(
			'backup failed'
		);

		expect(writeFilesMock).not.toHaveBeenCalled();
		expect(php.files.get('/wordpress/wp-content/db.php')).toBe('db');
		expect(
			php.files.get('/wordpress/wp-content/mu-plugins/0-playground.php')
		).toBe('playground');
	});

	it('keeps restoring Playground files after one imported file cannot be removed', async () => {
		const php = new FakePHP();
		php.failUnlinkPath = '/wordpress/wp-content/db.php';
		writeFilesMock.mockImplementation(async () => {
			php.files.set('/wordpress/wp-content/db.php', 'imported db');
			php.files.set(
				'/wordpress/wp-content/mu-plugins/0-playground.php',
				'imported playground'
			);
		});

		await expect(importWpContent(php as any, {})).rejects.toThrow(
			'remove failed'
		);

		expect(
			php.files.get('/wordpress/wp-content/mu-plugins/0-playground.php')
		).toBe('playground');
		expect(php.files.get('/wordpress/wp-content/db.php')).toBe(
			'imported db'
		);
	});

	it('does not collide with stale backup files from an earlier import', async () => {
		const php = new FakePHP();
		php.failMoveIfDestinationExists = true;
		php.files.set(
			'/tmp/playground-github-import-backup/wp-content/db.php',
			'stale db'
		);
		php.files.set(
			'/tmp/playground-github-import-backup/wp-content/mu-plugins/0-playground.php',
			'stale playground'
		);

		await expect(importWpContent(php as any, {})).resolves.toBeUndefined();

		expect(php.files.get('/wordpress/wp-content/db.php')).toBe('db');
		expect(
			php.files.get('/wordpress/wp-content/mu-plugins/0-playground.php')
		).toBe('playground');
		expect(writeFilesMock).toHaveBeenCalled();
	});
});

describe('plugin and theme imports', () => {
	beforeEach(() => {
		writeFilesMock.mockReset();
	});

	it('rejects path segments in plugin directory names', async () => {
		const php = new FakePHP();

		await expect(
			importPlugin(php as any, '../mu-plugin', {})
		).rejects.toThrow('Invalid plugin directory name');

		expect(writeFilesMock).not.toHaveBeenCalled();
	});

	it('rejects path segments in theme directory names', async () => {
		const php = new FakePHP();

		await expect(
			importTheme(php as any, 'parent/theme', {})
		).rejects.toThrow('Invalid theme directory name');

		expect(writeFilesMock).not.toHaveBeenCalled();
	});

	it('rejects null bytes in plugin and theme directory names', async () => {
		const php = new FakePHP();

		await expect(
			importPlugin(php as any, 'plugin\0name', {})
		).rejects.toThrow('Invalid plugin directory name');
		await expect(
			importTheme(php as any, 'theme\0name', {})
		).rejects.toThrow('Invalid theme directory name');

		expect(writeFilesMock).not.toHaveBeenCalled();
	});
});

class FakePHP {
	documentRoot = Promise.resolve('/wordpress');
	failMoveFrom: string | undefined;
	failMoveIfDestinationExists = false;
	failUnlinkPath: string | undefined;
	files = new Map<string, string>([
		['/wordpress/wp-content/db.php', 'db'],
		['/wordpress/wp-content/mu-plugins/0-playground.php', 'playground'],
	]);
	dirs = new Set<string>([
		'/wordpress',
		'/wordpress/wp-content',
		'/wordpress/wp-content/mu-plugins',
	]);

	async fileExists(path: string) {
		return this.files.has(path);
	}

	async mkdirTree(path: string) {
		let current = '';
		for (const segment of path.split('/').filter(Boolean)) {
			current += `/${segment}`;
			this.dirs.add(current);
		}
	}

	async mv(from: string, to: string) {
		if (from === this.failMoveFrom) {
			throw new Error('backup failed');
		}
		if (this.failMoveIfDestinationExists && this.files.has(to)) {
			throw new Error('destination exists');
		}
		const content = this.files.get(from);
		if (content === undefined) {
			throw new Error(`Missing file: ${from}`);
		}
		await this.mkdirTree(dirname(to));
		this.files.delete(from);
		this.files.set(to, content);
	}

	async isDir(path: string) {
		return this.dirs.has(path);
	}

	async rmdir(path: string) {
		for (const filePath of [...this.files.keys()]) {
			if (filePath === path || filePath.startsWith(`${path}/`)) {
				this.files.delete(filePath);
			}
		}
		for (const dirPath of [...this.dirs]) {
			if (dirPath === path || dirPath.startsWith(`${path}/`)) {
				this.dirs.delete(dirPath);
			}
		}
	}

	async unlink(path: string) {
		if (path === this.failUnlinkPath) {
			throw new Error('remove failed');
		}
		this.files.delete(path);
	}

	async run() {}
}

function dirname(path: string) {
	const parts = path.split('/');
	parts.pop();
	return parts.join('/') || '/';
}
