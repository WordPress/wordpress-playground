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

	it('uses a new random suffix even when a name or explicit hint is available', () => {
		const uuid = crypto.randomUUID();
		const randomUUID = vi.spyOn(crypto, 'randomUUID');
		randomUUID.mockReturnValueOnce(uuid);
		expect(getUniqueSiteSlug('demo-site', { unavailableSlugs: [] })).toBe(
			`demo-site-${uuid}`
		);
		expect(randomUUID).toHaveBeenCalledTimes(1);
		expect(
			getUniqueSiteSlug('demo-site', { unavailableSlugs: [] })
		).not.toBe(`demo-site-${uuid}`);
		randomUUID.mockRestore();
	});

	it('retries a collision without falling back to a predictable numeric suffix', () => {
		const first = crypto.randomUUID();
		const second = crypto.randomUUID();
		const randomUUID = vi
			.spyOn(crypto, 'randomUUID')
			.mockReturnValueOnce(first)
			.mockReturnValueOnce(second);
		expect(
			getUniqueSiteSlug('demo-site', {
				unavailableSlugs: [`demo-site-${first}`],
			})
		).toBe(`demo-site-${second}`);
		randomUUID.mockRestore();
	});

	it('keeps explicit hint bytes as the prefix and supplies a fallback for empty hints', () => {
		for (const hint of ['Mój Playground 🚀', '  spaced slug  ', '']) {
			const slug = getUniqueSiteSlug(hint, { unavailableSlugs: [] });
			expect(slug).toMatch(
				/^[\s\S]+-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
			);
			expect(slug.slice(0, -37)).toBe(hint || 'playground');
		}
	});
});
