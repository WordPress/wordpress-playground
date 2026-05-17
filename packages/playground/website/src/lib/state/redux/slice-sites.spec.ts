import { getUniqueSiteSlug, normalizeSiteSlug } from './site-slug';

describe('site slug helpers', () => {
	it('normalizes site names into stable slugs', () => {
		expect(normalizeSiteSlug(' My WordPress Playground! ')).toBe(
			'my-wordpress-playground'
		);
	});

	it('uses a fallback slug when the preferred value has no usable characters', () => {
		expect(normalizeSiteSlug('!!!')).toBe('playground');
	});

	it('appends a suffix to avoid slug collisions', () => {
		expect(
			getUniqueSiteSlug('Demo Site', [
				'demo-site',
				'demo-site-2',
				'other-site',
			])
		).toBe('demo-site-3');
	});
});
