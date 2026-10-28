import { deriveSlugFromSiteName, getUniqueSiteSlug } from './site-slug';

describe('site slug helpers', () => {
	const uuid = '54e2f9f8-73c4-4ad2-960e-5b17a296c830';

	beforeEach(() => {
		vi.spyOn(crypto, 'randomUUID').mockReturnValue(uuid);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('keeps readable names and the full random UUID in default slugs', () => {
		expect(deriveSlugFromSiteName(' My WordPress Playground! ')).toBe(
			`my-wordpress-playground-${uuid}`
		);
		expect(deriveSlugFromSiteName(' Mój WordPress Playground! ')).toBe(
			`moj-wordpress-playground-${uuid}`
		);
	});

	it('draws a fresh UUID even when the site name is the same', () => {
		const anotherUuid = '9d4152f0-3b8c-4e6a-a721-608fc923d57e';
		vi.mocked(crypto.randomUUID)
			.mockReturnValueOnce(uuid)
			.mockReturnValueOnce(anotherUuid);

		expect(deriveSlugFromSiteName('Happy Quiet River')).toBe(
			`happy-quiet-river-${uuid}`
		);
		expect(deriveSlugFromSiteName('Happy Quiet River')).toBe(
			`happy-quiet-river-${anotherUuid}`
		);
	});

	it('keeps the random suffix when the site name has no usable characters', () => {
		expect(deriveSlugFromSiteName('!!!')).toBe(`playground-${uuid}`);
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
		expect(crypto.randomUUID).not.toHaveBeenCalled();
	});

	it('uses a fallback when an explicit slug hint is empty', () => {
		expect(getUniqueSiteSlug('', { unavailableSlugs: [] })).toBe(
			'playground'
		);
	});
});
