import type { UniversalPHP } from '@php-wasm/universal';
import type * as PlaygroundCommon from '@wp-playground/common';
import { unzipFile } from '@wp-playground/common';
import { vi } from 'vitest';
import {
	getWordPressTranslationUrl,
	setSiteLanguage,
} from '../../lib/steps/set-site-language';

vi.mock('@wp-playground/common', async (importOriginal) => ({
	...(await importOriginal<typeof PlaygroundCommon>()),
	unzipFile: vi.fn(),
}));

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

describe('Blueprint step setSiteLanguage()', () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
		vi.mocked(unzipFile).mockReset();
	});

	it('persists the selected language in the WPLANG option', async () => {
		global.fetch = vi
			.fn()
			.mockResolvedValueOnce({
				json: async () => ({
					translations: [
						{
							language: 'es_ES',
							package: 'https://example.com/es_ES.zip',
						},
					],
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				arrayBuffer: async () => new ArrayBuffer(0),
			});

		const defineConstant = vi.fn();
		const run = vi
			.fn()
			.mockResolvedValueOnce({ text: '' })
			.mockResolvedValueOnce({ text: '6.8' })
			.mockResolvedValueOnce({ json: [] })
			.mockResolvedValueOnce({ json: [] });
		const playground = {
			defineConstant,
			documentRoot: Promise.resolve('/wordpress'),
			run,
			isDir: vi.fn().mockResolvedValue(true),
			mkdir: vi.fn(),
		} as unknown as UniversalPHP;

		await setSiteLanguage(playground, { language: 'es_ES' });

		expect(defineConstant).toHaveBeenCalledWith('WPLANG', 'es_ES');
		const updateLanguageCall = run.mock.calls[0][0] as { code: string };
		expect(updateLanguageCall.code).toContain("update_option('WPLANG'");
		expect(updateLanguageCall.code).toContain('ImVzX0VTIg==');
	});
});
