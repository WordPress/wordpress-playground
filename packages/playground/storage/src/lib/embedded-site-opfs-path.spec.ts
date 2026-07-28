import { getEmbeddedSiteOpfsPath } from './embedded-site-opfs-path';

describe('getEmbeddedSiteOpfsPath', () => {
	it('places embedded sites in their own OPFS namespace', () => {
		expect(getEmbeddedSiteOpfsPath('demo-site')).toBe(
			'/embedded-sites/site-demo-site'
		);
	});

	it('encodes the storage key as a single path segment', () => {
		expect(getEmbeddedSiteOpfsPath('a/b')).toBe(
			'/embedded-sites/site-a%2Fb'
		);
		expect(getEmbeddedSiteOpfsPath('a?b')).toBe(
			'/embedded-sites/site-a%3Fb'
		);
		expect(getEmbeddedSiteOpfsPath('..')).toBe(
			'/embedded-sites/site-..'
		);
	});
});
