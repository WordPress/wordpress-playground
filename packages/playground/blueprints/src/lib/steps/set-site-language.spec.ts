import { getWordPressTranslationUrl } from './set-site-language';

describe('getWordPressTranslationUrl()', () => {
	[
		{
			versionString: '6.2',
			description:
				'should return a translation URL when the input version string is in a major.minor format',
		},
		{
			versionString: '6.2.1',
			description:
				'should return a translation URL when the input version string is in a major.minor.patch format',
		},
		{
			versionString: '6.6-RC1',
			description: 'should return a translation URL for a RC version',
		},
		{
			versionString: '6.6-beta2',
			description: 'should return a translation URL for a beta version',
		},
		{
			versionString: '6.6-nightly',
			description:
				'should return a translation URL for a nightly version',
		},
		{
			versionString: '6.8-alpha-59408',
			description: 'should return a translation URL for an alpha version',
		},
	].forEach(({ versionString, description }) => {
		it(description, async () => {
			const url = await getWordPressTranslationUrl(
				versionString,
				'es_PE'
			);
			expect(url).toMatch(
				/^https:\/\/downloads\.wordpress\.org\/translation\/core\/[\d.]+\/es_PE\.zip$/
			);
		});
	});

	it('should throw an error if the translation package is not found', async () => {
		/**
		 * en_US is the default language, so there are no translations available
		 * for it.
		 */
		await expect(
			getWordPressTranslationUrl('6.6-RC', 'en_US')
		).rejects.toThrow();
	});
});
