import { generateSiteSlug, getUniqueSiteSlug } from './site-slug';

describe('site slug helpers', () => {
	beforeEach(() => {
		vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
			(array as Uint8Array).fill(0);
			return array;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('draws fresh cryptographic randomness for every slug', () => {
		expect(generateSiteSlug()).toBe('aaaa-aaaa-aaaa');
		vi.mocked(crypto.getRandomValues).mockImplementation((array) => {
			(array as Uint8Array).fill(1);
			return array;
		});
		expect(generateSiteSlug()).toBe('bbbb-bbbb-bbbb');
		expect(crypto.getRandomValues).toHaveBeenCalledTimes(2);
	});

	it('rejects bytes above 249 instead of biasing the 25-letter alphabet', () => {
		const bytes = [
			249, 250, 251, 252, 253, 254, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
		];
		vi.mocked(crypto.getRandomValues).mockImplementation((array) => {
			const buffer = array as Uint8Array;
			buffer.set(bytes.splice(0, buffer.length));
			return array;
		});

		expect(generateSiteSlug()).toBe('zabc-defg-hijk');
		expect(bytes).toEqual([]);
		expect(crypto.getRandomValues).toHaveBeenCalledTimes(2);
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
		expect(crypto.getRandomValues).not.toHaveBeenCalled();
	});

	it('uses a fallback when an explicit slug hint is empty', () => {
		expect(getUniqueSiteSlug('', { unavailableSlugs: [] })).toBe(
			'playground'
		);
	});
});
