import { deriveSlugFromSiteName, getUniqueSiteSlug } from './site-slug';

describe('site slug helpers', () => {
	it('derives readable default slugs from site names', () => {
		expect(deriveSlugFromSiteName(' My WordPress Playground! ')).toBe(
			'my-wordpress-playground'
		);
		expect(deriveSlugFromSiteName(' Mój WordPress Playground! ')).toBe(
			'moj-wordpress-playground'
		);
	});

	it('uses a fallback slug when the site name has no usable characters', () => {
		expect(deriveSlugFromSiteName('!!!')).toBe('playground');
	});

	it('appends a suffix to avoid slug collisions', () => {
		expect(
			getUniqueSiteSlug('demo-site', {
				unavailableSlugs: ['demo-site', 'demo-site-2', 'other-site'],
			})
		).toBe('demo-site-3');
	});

	it('does not sanitize explicit slug hints while avoiding collisions', () => {
		expect(
			getUniqueSiteSlug('Mój Playground 🚀', {
				unavailableSlugs: [],
			})
		).toBe('Mój Playground 🚀');
		expect(
			getUniqueSiteSlug('  spaced slug  ', {
				unavailableSlugs: [],
			})
		).toBe('  spaced slug  ');
		expect(
			getUniqueSiteSlug('Mój Playground 🚀', {
				unavailableSlugs: ['Mój Playground 🚀'],
			})
		).toBe('Mój Playground 🚀-2');
	});

	it('uses a fallback when an explicit slug hint is empty', () => {
		expect(getUniqueSiteSlug('', { unavailableSlugs: [] })).toBe(
			'playground'
		);
	});
});
