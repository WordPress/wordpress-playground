import { logger } from '@php-wasm/logger';
import { resetLocaleData } from '@wordpress/i18n';

export const TEXT_DOMAIN = 'playground-website';
export const DEFAULT_LOCALE = 'en_US';

const DEFAULT_LOCALE_DATA = {
	'': {
		domain: TEXT_DOMAIN,
		lang: DEFAULT_LOCALE,
		'plural-forms': 'nplurals=2; plural=(n != 1);',
	},
};

export const SUPPORTED_LOCALES = ['en_US', 'es_ES', 'pt_BR'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

type RuntimeLocale = Exclude<SupportedLocale, typeof DEFAULT_LOCALE>;

interface LocaleJson {
	locale_data: Record<
		string,
		Record<string, string[] | Record<string, string>>
	>;
}

const runtimeLocaleLoaders: Record<
	RuntimeLocale,
	() => Promise<{ default: LocaleJson }>
> = {
	es_ES: () => import('./locales/es_ES.json'),
	pt_BR: () => import('./locales/pt_BR.json'),
};

const localeAliases: Record<string, SupportedLocale> = {
	en: 'en_US',
	es: 'es_ES',
	pt: 'pt_BR',
};

let activeLocale: SupportedLocale = DEFAULT_LOCALE;

export async function initializeI18n(locale = getInitialLocale()) {
	try {
		await loadLocale(locale);
		activeLocale = locale;
	} catch (error) {
		logger.error(
			`Failed to load locale "${locale}", falling back to "${DEFAULT_LOCALE}".`,
			error
		);
		await loadLocale(DEFAULT_LOCALE);
		activeLocale = DEFAULT_LOCALE;
	}
	if (typeof document !== 'undefined') {
		document.documentElement.lang = getActiveLanguageTag();
	}
	return activeLocale;
}

export function getInitialLocale() {
	if (typeof window === 'undefined') {
		return DEFAULT_LOCALE;
	}
	return getLocaleFromSearch(window.location.search) || DEFAULT_LOCALE;
}

export function getLocaleFromSearch(search: string) {
	const params = new URLSearchParams(search);
	return (
		normalizeLocale(params.get('language')) ||
		normalizeLocale(params.get('locale'))
	);
}

export function normalizeLocale(locale: string | null | undefined) {
	if (!locale) {
		return null;
	}
	const normalized = locale.trim().toLowerCase().replace(/_/g, '-');
	if (!normalized) {
		return null;
	}
	return (
		localeAliases[normalized] ||
		localeAliases[normalized.split('-')[0]] ||
		null
	);
}

export function getActiveLocale() {
	return activeLocale;
}

export function getActiveLanguageTag() {
	return activeLocale.replace('_', '-');
}

async function loadLocale(locale: SupportedLocale) {
	if (locale === DEFAULT_LOCALE) {
		resetLocaleData(DEFAULT_LOCALE_DATA, TEXT_DOMAIN);
		return;
	}

	const localeData = await runtimeLocaleLoaders[locale]();
	resetLocaleData(localeData.default.locale_data[TEXT_DOMAIN], TEXT_DOMAIN);
}
