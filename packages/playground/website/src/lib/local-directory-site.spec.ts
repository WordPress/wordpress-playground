import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import {
	LOCAL_DIRECTORY_MOUNTPOINT,
	detectLocalDirectorySiteMode,
	getLocalDirectoryDocumentRoot,
	getRelativeLocalDirectoryDocumentRoot,
} from './local-directory-site';

describe('local directory site paths', () => {
	it('derives document roots under the fixed mountpoint', () => {
		expect(
			getLocalDirectoryDocumentRoot({
				mountpoint: LOCAL_DIRECTORY_MOUNTPOINT,
				documentRoot: '',
				siteMode: 'php',
			})
		).toBe('/app');
		expect(
			getLocalDirectoryDocumentRoot({
				mountpoint: LOCAL_DIRECTORY_MOUNTPOINT,
				documentRoot: 'public',
				siteMode: 'php',
			})
		).toBe('/app/public');
	});

	it.each(['/public', '../public', 'web/../../public', 'web/../public'])(
		'rejects non-canonical relative document root %s',
		(documentRoot) => {
			expect(() =>
				getLocalDirectoryDocumentRoot({
					mountpoint: LOCAL_DIRECTORY_MOUNTPOINT,
					documentRoot,
					siteMode: 'php',
				})
			).toThrow('Invalid local directory document root.');
		}
	);

	it('stores picker paths as relative document roots', () => {
		expect(getRelativeLocalDirectoryDocumentRoot('/')).toBe('');
		expect(getRelativeLocalDirectoryDocumentRoot('/public')).toBe('public');
		expect(() =>
			getRelativeLocalDirectoryDocumentRoot('/public/../private')
		).toThrow('Invalid local directory tree path.');
	});
});

describe('detectLocalDirectorySiteMode', () => {
	it('recognizes only complete SQLite-backed WordPress directories', async () => {
		const wordpressFilesystem = createFilesystem([
			'/wp-config.php',
			'/wp-includes/version.php',
			'/wp-content/database/.ht.sqlite',
		]);
		const phpFilesystem = createFilesystem([
			'/wp-config.php',
			'/wp-includes/version.php',
		]);

		await expect(
			detectLocalDirectorySiteMode(wordpressFilesystem, '')
		).resolves.toBe('wordpress');
		await expect(
			detectLocalDirectorySiteMode(phpFilesystem, '')
		).resolves.toBe('php');
	});
});

function createFilesystem(files: string[]): AsyncWritableFilesystem {
	const existingFiles = new Set(files);
	return {
		listFiles: vi.fn(async () => []),
		fileExists: vi.fn(async (path: string) => existingFiles.has(path)),
		isDir: vi.fn(async () => false),
	} as unknown as AsyncWritableFilesystem;
}
