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

	it('draws another random slug for every collision', () => {
		vi.mocked(crypto.getRandomValues)
			.mockImplementationOnce((array) => {
				(array as Uint8Array).fill(1);
				return array;
			})
			.mockImplementationOnce((array) => {
				(array as Uint8Array).fill(2);
				return array;
			});
		expect(
			getUniqueSiteSlug('aaaa-aaaa-aaaa', {
				unavailableSlugs: ['aaaa-aaaa-aaaa', 'bbbb-bbbb-bbbb'],
			})
		).toBe('cccc-cccc-cccc');
		expect(crypto.getRandomValues).toHaveBeenCalledTimes(2);
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
		expect(crypto.getRandomValues).not.toHaveBeenCalled();
	});

	it.each(['', undefined])(
		'generates a random slug for an empty hint (%s)',
		(hint) => {
			expect(getUniqueSiteSlug(hint, { unavailableSlugs: [] })).toBe(
				'aaaa-aaaa-aaaa'
			);
		}
	);
});
