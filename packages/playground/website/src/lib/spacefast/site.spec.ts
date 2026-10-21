import { parseManifest } from './site';
import { publicFileUrl } from './paths';

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

	it('preserves valid upload names, including literal backslashes', () => {
		const source = { ...manifest, uploads: ['2026/10/photo\\name.jpg'] };
		expect(parseManifest(source).uploads).toEqual(source.uploads);
	});

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
