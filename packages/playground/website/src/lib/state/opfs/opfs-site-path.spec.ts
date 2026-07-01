import {
	getCandidateDirectoryNamesForSlug,
	getDirectoryNameForSlug,
} from './opfs-site-path';

describe('getDirectoryNameForSlug', () => {
	it('keeps existing ASCII slug directory names stable', () => {
		expect(getDirectoryNameForSlug('demo-site')).toBe('site-demo-site');
	});

	it('encodes path separators without conflating different slugs', () => {
		expect(getDirectoryNameForSlug('a/b')).toBe('site-a%2Fb');
		expect(getDirectoryNameForSlug('a?b')).toBe('site-a%3Fb');
		expect(getDirectoryNameForSlug('a/b')).not.toBe(
			getDirectoryNameForSlug('a?b')
		);
	});

	it('preserves the full slug through reversible path encoding', () => {
		const slug = 'Mój Playground 🚀';
		const directoryName = getDirectoryNameForSlug(slug);

		expect(directoryName).toBe(`site-${encodeURIComponent(slug)}`);
		expect(decodeURIComponent(directoryName.replace(/^site-/, ''))).toBe(
			slug
		);
	});

	it('checks the encoded directory before the legacy directory', () => {
		expect(getCandidateDirectoryNamesForSlug('demo-site')).toEqual([
			'site-demo-site',
		]);
		expect(getCandidateDirectoryNamesForSlug('a/b')).toEqual([
			'site-a%2Fb',
			'site-a-b',
		]);
	});
});
