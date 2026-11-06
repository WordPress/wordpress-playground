import type { PHP } from '@php-wasm/universal';
import type * as Common from '@wp-playground/common';
import { vi } from 'vitest';
import { prepareLocalizedInstallation } from '../installation-language';

vi.mock('@wp-playground/common', async (importOriginal) => ({
	...(await importOriginal<typeof Common>()),
	unzipFile: vi.fn(),
}));

// Contract: installation resolves the same preferred locale before content creation.
// Worker navigator detection and catalog matching can independently select the wrong locale.
describe('installation language resolution', () => {
	afterEach(() => vi.unstubAllGlobals());

	it.each([
		{ preferences: ['pt-BR', 'de'], expected: 'pt_BR' },
		{ preferences: ['xx', 'de-AT'], expected: 'de_DE' },
		{ preferences: ['pt'], expected: 'pt_BR' },
		{ preferences: ['en-US', 'de'], expected: 'en_US' },
		{ preferences: ['xx'], expected: 'en_US' },
	])(
		'selects $expected for $preferences in a worker',
		async ({ preferences, expected }) => {
			vi.stubGlobal('WorkerGlobalScope', class {});
			vi.stubGlobal('navigator', { languages: preferences });
			const fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({
						translations: ['de_DE', 'pt_BR'].map((language) => ({
							language,
							package: `https://example.com/${language}.zip`,
						})),
					}),
				})
				.mockResolvedValue({
					ok: true,
					arrayBuffer: async () => new ArrayBuffer(0),
				});
			vi.stubGlobal('fetch', fetch);
			const php = {
				documentRoot: '/wordpress',
				mkdir: vi.fn(),
				run: vi
					.fn()
					.mockResolvedValueOnce({ text: '6.8' })
					.mockResolvedValue({ text: 'Translated title' }),
			} as unknown as PHP;
			const result = await prepareLocalizedInstallation(php, 'browser');
			expect(result.language).toBe(expected);
			if (expected === 'en_US') {
				expect(fetch).toHaveBeenCalledTimes(1);
			} else {
				expect(fetch).toHaveBeenLastCalledWith(
					`https://example.com/${expected}.zip`
				);
			}
		}
	);

	it('avoids downloads for US English and for browser detection outside a browser', async () => {
		vi.stubGlobal('navigator', { languages: ['de-DE'] });
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		for (const language of ['en_US', 'browser']) {
			expect(
				await prepareLocalizedInstallation({} as PHP, language)
			).toEqual({ language: 'en_US' });
		}
		expect(fetch).not.toHaveBeenCalled();
	});
});
