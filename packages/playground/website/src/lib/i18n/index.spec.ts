import { logger } from '@php-wasm/logger';
import { __, setLocaleData } from '@wordpress/i18n';
import {
	DEFAULT_LOCALE,
	TEXT_DOMAIN,
	getActiveLanguageTag,
	getActiveLocale,
	getLocaleFromSearch,
	initializeI18n,
	normalizeLocale,
} from './index';

describe('website i18n', () => {
	afterEach(async () => {
		await initializeI18n(DEFAULT_LOCALE);
	});

	it('normalizes supported WordPress and browser locale formats', () => {
		expect(normalizeLocale('en_US')).toBe('en_US');
		expect(normalizeLocale('es_ES')).toBe('es_ES');
		expect(normalizeLocale(' es-MX ')).toBe('es_ES');
		expect(normalizeLocale('pt-BR')).toBe('pt_BR');
		expect(normalizeLocale('fr_FR')).toBeNull();
		expect(normalizeLocale('   ')).toBeNull();
	});

	it('prefers the language query parameter over locale', () => {
		expect(getLocaleFromSearch('?locale=pt_BR&language=es_ES')).toBe(
			'es_ES'
		);
		expect(getLocaleFromSearch('?language=pt_BR')).toBe('pt_BR');
		expect(getLocaleFromSearch('?locale=pt_BR')).toBe('pt_BR');
		expect(getLocaleFromSearch('?language=fr_FR')).toBeNull();
	});

	it('replaces translations cleanly when switching locales without leaking stale strings', async () => {
		await expect(initializeI18n('es_ES')).resolves.toBe('es_ES');
		expect(getActiveLocale()).toBe('es_ES');
		expect(getActiveLanguageTag()).toBe('es-ES');
		if (typeof document !== 'undefined') {
			expect(document.documentElement.lang).toBe('es-ES');
		}

		// Inject a synthetic translation into the active domain to verify
		// switching locales resets the domain instead of merging.
		setLocaleData(
			{ 'Synthetic stale key': ['Cadena obsoleta'] },
			TEXT_DOMAIN
		);
		expect(__('Synthetic stale key', TEXT_DOMAIN)).toBe('Cadena obsoleta');

		await expect(initializeI18n('pt_BR')).resolves.toBe('pt_BR');
		expect(getActiveLocale()).toBe('pt_BR');
		expect(getActiveLanguageTag()).toBe('pt-BR');
		if (typeof document !== 'undefined') {
			expect(document.documentElement.lang).toBe('pt-BR');
		}
		expect(__('Synthetic stale key', TEXT_DOMAIN)).toBe(
			'Synthetic stale key'
		);

		await expect(initializeI18n('en_US')).resolves.toBe('en_US');
		expect(getActiveLocale()).toBe('en_US');
		expect(getActiveLanguageTag()).toBe('en-US');
		if (typeof document !== 'undefined') {
			expect(document.documentElement.lang).toBe('en-US');
		}
		expect(__('Download as .zip', TEXT_DOMAIN)).toBe('Download as .zip');
	});

	it('falls back to English and logs an error when a runtime locale cannot load', async () => {
		const errorSpy = vi
			.spyOn(logger, 'error')
			.mockImplementation(() => undefined);
		try {
			await expect(initializeI18n('es_ES')).resolves.toBe('es_ES');
			const spanishLabel = __('Download as .zip', TEXT_DOMAIN);
			expect(spanishLabel).not.toBe('Download as .zip');

			const locale = await initializeI18n(
				'de_DE' as Parameters<typeof initializeI18n>[0]
			);
			expect(locale).toBe(DEFAULT_LOCALE);
			expect(getActiveLocale()).toBe(DEFAULT_LOCALE);
			if (typeof document !== 'undefined') {
				expect(document.documentElement.lang).toBe('en-US');
			}
			expect(__('Download as .zip', TEXT_DOMAIN)).toBe(
				'Download as .zip'
			);
			expect(errorSpy).toHaveBeenCalledTimes(1);
		} finally {
			errorSpy.mockRestore();
		}
	});
});
