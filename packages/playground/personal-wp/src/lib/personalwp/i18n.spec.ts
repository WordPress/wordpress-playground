import { describe, it, expect } from 'vitest';
import { browserLanguageToWpLocale } from './i18n';
import localeMap from './locale-map.json';

describe('locale-map.json', () => {
	it('is a non-empty object', () => {
		expect(typeof localeMap).toBe('object');
		expect(localeMap).not.toBeNull();
		expect(Array.isArray(localeMap)).toBe(false);
		expect(Object.keys(localeMap).length).toBeGreaterThan(100);
	});

	it('has string keys and string values', () => {
		for (const [key, value] of Object.entries(localeMap)) {
			expect(typeof key).toBe('string');
			expect(typeof value).toBe('string');
			expect(key.length).toBeGreaterThan(0);
			expect(value.length).toBeGreaterThan(0);
		}
	});

	it('has lowercase keys (browser locale format)', () => {
		for (const key of Object.keys(localeMap)) {
			expect(key).toBe(key.toLowerCase());
		}
	});

	it('has values matching WordPress locale format', () => {
		const wpLocalePattern = /^[a-z]{2,3}(_[A-Z]{2})?(_formal|_informal)?$/;
		for (const value of Object.values(localeMap)) {
			expect(value).toMatch(wpLocalePattern);
		}
	});

	it('contains expected common locales', () => {
		expect(localeMap).toHaveProperty('de');
		expect(localeMap).toHaveProperty('fr');
		expect(localeMap).toHaveProperty('es');
		expect(localeMap).toHaveProperty('ja');
		expect(localeMap).toHaveProperty('zh-cn');
	});
});

describe('browserLanguageToWpLocale', () => {
	it('maps exact matches from locale map', () => {
		expect(browserLanguageToWpLocale('de')).toBe('de_DE');
		expect(browserLanguageToWpLocale('fr')).toBe('fr_FR');
		expect(browserLanguageToWpLocale('es')).toBe('es_ES');
		expect(browserLanguageToWpLocale('ja')).toBe('ja');
		expect(browserLanguageToWpLocale('zh-cn')).toBe('zh_CN');
		expect(browserLanguageToWpLocale('pt-br')).toBe('pt_BR');
	});

	it('normalizes case for lookups', () => {
		expect(browserLanguageToWpLocale('DE')).toBe('de_DE');
		expect(browserLanguageToWpLocale('ZH-CN')).toBe('zh_CN');
		expect(browserLanguageToWpLocale('Pt-BR')).toBe('pt_BR');
	});

	it('uses explicit regional mappings when available', () => {
		expect(browserLanguageToWpLocale('de-AT')).toBe('de_AT');
		expect(browserLanguageToWpLocale('de-CH')).toBe('de_CH');
		expect(browserLanguageToWpLocale('fr-CA')).toBe('fr_CA');
	});

	it('falls back to base language when region not in map', () => {
		// de-XX is not in the map, so falls back to 'de' which maps to de_DE
		expect(browserLanguageToWpLocale('de-XX')).toBe('de_DE');
	});

	it('converts unknown regional variants to WordPress format', () => {
		expect(browserLanguageToWpLocale('xx-yy')).toBe('xx_YY');
	});

	it('returns null for single language codes not in map', () => {
		expect(browserLanguageToWpLocale('xx')).toBeNull();
	});

	it('handles common browser language codes', () => {
		expect(browserLanguageToWpLocale('en-US')).toBe('en_US');
		expect(browserLanguageToWpLocale('en-GB')).toBe('en_GB');
		expect(browserLanguageToWpLocale('nl')).toBe('nl_NL');
		expect(browserLanguageToWpLocale('it')).toBe('it_IT');
		expect(browserLanguageToWpLocale('ru')).toBe('ru_RU');
		expect(browserLanguageToWpLocale('ko')).toBe('ko_KR');
	});
});
