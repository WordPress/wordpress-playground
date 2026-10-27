import type { PlaygroundClient } from '@wp-playground/client';
import { collectSiteFiles, parseManifest } from './site';
import { publicFileUrl, uploadFilePath } from './paths';

vi.mock('@wp-playground/tools', () => ({
	getSqliteDatabasePath: async () =>
		'/wordpress/wp-content/database/.ht.sqlite',
}));

describe('public Playground source manifests', () => {
	const manifest = {
		formatVersion: 1,
		spaceId: 'spc_test',
		siteUrl: 'https://playground.test/scope:old/',
		uploads: ['2026/10/photo.jpg'],
	};

	it.each([
		'../plugins/plugin.php',
		'/wordpress/wp-config.php',
		'images/../../wp-config.php',
		'photo\0.jpg',
	])(
		'rejects an upload that could write outside the uploads directory: %s',
		(path) =>
			expect(() =>
				parseManifest({ ...manifest, uploads: [path] })
			).toThrow()
	);

	it.each([1, 2] as const)(
		'preserves valid upload names in format %s, including literal backslashes',
		(formatVersion) => {
			const source = {
				...manifest,
				formatVersion,
				uploads: ['2026/10/photo\\name.jpg'],
			};
			expect(parseManifest(source).uploads).toEqual(source.uploads);
		}
	);

	it('fetches filenames containing URL delimiters and literal backslashes without changing them', () => {
		const url = publicFileUrl(
			'_playground/uploads/photo?#\\name.png',
			new URL('https://example.space.fast/subsite/')
		);
		expect(url.href).toBe(
			'https://example.space.fast/subsite/_playground/uploads/photo%3F%23%5Cname.png'
		);
		expect(url.search).toBe('');
		expect(url.hash).toBe('');
	});
});

describe('shared source and static uploads', () => {
	it.each([
		[1, '_playground/uploads/2026/10/photo.jpg'],
		[2, 'wp-content/uploads/2026/10/photo.jpg'],
	] as const)('resolves uploads from manifest format %s', (version, path) => {
		expect(uploadFilePath(version, '2026/10/photo.jpg')).toBe(path);
	});

	it('keeps one published copy while preserving media outside the static crawl', async () => {
		const exported = {
			path: 'wp-content/uploads/photo.svg',
			data: new Blob(['exported SVG']),
		};
		const playground = {
			documentRoot: '/wordpress',
			absoluteUrl: 'https://playground.test/',
			run: vi
				.fn()
				.mockResolvedValueOnce({ exitCode: 0, errors: '' })
				.mockResolvedValueOnce({
					exitCode: 0,
					errors: '',
					text: JSON.stringify(['photo.svg', 'unused.png']),
				}),
			readFileAsBuffer: async () => new Uint8Array([1, 2, 3]),
			unlink: vi.fn(),
			fileExists: async () => true,
		} as unknown as PlaygroundClient;
		const { files, manifest } = await collectSiteFiles(
			playground,
			{},
			'spc_test',
			vi.fn(),
			[exported]
		);
		expect(manifest.formatVersion).toBe(2);
		expect(files.filter((file) => file.path === exported.path)).toEqual([
			exported,
		]);
		expect(
			files.some((file) => file.path === 'wp-content/uploads/unused.png')
		).toBe(true);
		expect(
			files.some((file) => file.path.startsWith('_playground/uploads/'))
		).toBe(false);
	});
});
