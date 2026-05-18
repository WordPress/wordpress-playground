import { __ } from '@wordpress/i18n';
import {
	DEFAULT_LOCALE,
	TEXT_DOMAIN,
	getActiveLocale,
	getLocaleFromSearch,
	initializeI18n,
	normalizeLocale,
} from './index';

describe('website i18n', () => {
	it('normalizes supported WordPress and browser locale formats', () => {
		expect(normalizeLocale('es_ES')).toBe('es_ES');
		expect(normalizeLocale('es-MX')).toBe('es_ES');
		expect(normalizeLocale('pt-BR')).toBe('pt_BR');
		expect(normalizeLocale('ja-JP')).toBe('ja');
		expect(normalizeLocale('fr_FR')).toBeNull();
	});

	it('prefers the language query parameter over locale', () => {
		expect(getLocaleFromSearch('?locale=pt_BR&language=es_ES')).toBe(
			'es_ES'
		);
		expect(getLocaleFromSearch('?language=pt_BR')).toBe('pt_BR');
		expect(getLocaleFromSearch('?locale=pt_BR')).toBe('pt_BR');
		expect(getLocaleFromSearch('?language=fr_FR')).toBeNull();
	});

	it('falls back to English when a runtime locale cannot load', async () => {
		await expect(initializeI18n('es_ES')).resolves.toBe('es_ES');
		expect(__('Playground settings', TEXT_DOMAIN)).toBe(
			'Configuración de Playground'
		);

		const locale = await initializeI18n(
			'de_DE' as Parameters<typeof initializeI18n>[0]
		);
		expect(locale).toBe(DEFAULT_LOCALE);
		expect(getActiveLocale()).toBe(DEFAULT_LOCALE);
		expect(__('Playground settings', TEXT_DOMAIN)).toBe(
			'Playground settings'
		);
	});
});
