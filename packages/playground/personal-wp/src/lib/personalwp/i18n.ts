/**
 * Internationalization support for personal WordPress Playground.
 *
 * Detects the user's browser language and maps it to a WordPress locale
 * for automatic language configuration.
 */

/**
 * Common browser language to WordPress locale mappings.
 *
 * Browser languages use BCP 47 format (e.g., "en-US", "de", "pt-BR")
 * WordPress locales use underscore format (e.g., "en_US", "de_DE", "pt_BR")
 *
 * This map provides explicit mappings for cases where the conversion
 * isn't straightforward (e.g., "de" -> "de_DE", not "de").
 */
const BROWSER_TO_WP_LOCALE: Record<string, string> = {
	// Languages that need explicit country codes
	de: 'de_DE',
	fr: 'fr_FR',
	es: 'es_ES',
	it: 'it_IT',
	nl: 'nl_NL',
	pl: 'pl_PL',
	pt: 'pt_PT',
	ru: 'ru_RU',
	ja: 'ja',
	ko: 'ko_KR',
	zh: 'zh_CN',
	ar: 'ar',
	he: 'he_IL',
	tr: 'tr_TR',
	sv: 'sv_SE',
	da: 'da_DK',
	fi: 'fi',
	nb: 'nb_NO',
	nn: 'nn_NO',
	cs: 'cs_CZ',
	sk: 'sk_SK',
	hu: 'hu_HU',
	ro: 'ro_RO',
	bg: 'bg_BG',
	uk: 'uk',
	el: 'el',
	th: 'th',
	vi: 'vi',
	id: 'id_ID',
	ms: 'ms_MY',
	fa: 'fa_IR',
	hi: 'hi_IN',

	// Region-specific variants
	'pt-br': 'pt_BR',
	'zh-tw': 'zh_TW',
	'zh-hk': 'zh_HK',
	'zh-hans': 'zh_CN',
	'zh-hant': 'zh_TW',
	'es-mx': 'es_MX',
	'es-ar': 'es_AR',
	'fr-ca': 'fr_CA',
	'fr-be': 'fr_BE',
	'nl-be': 'nl_BE',
	'de-at': 'de_AT',
	'de-ch': 'de_CH',
	'en-gb': 'en_GB',
	'en-au': 'en_AU',
	'en-ca': 'en_CA',
	'en-nz': 'en_NZ',
	'en-za': 'en_ZA',
};

/**
 * Converts a browser language code (BCP 47) to a WordPress locale.
 *
 * @param browserLang - Browser language code (e.g., "en-US", "de", "pt-BR")
 * @returns WordPress locale (e.g., "en_US", "de_DE", "pt_BR") or null if no mapping
 */
export function browserLanguageToWpLocale(browserLang: string): string | null {
	const normalized = browserLang.toLowerCase();

	// Check for explicit mapping first
	if (BROWSER_TO_WP_LOCALE[normalized]) {
		return BROWSER_TO_WP_LOCALE[normalized];
	}

	// Try base language without region
	const baseLang = normalized.split('-')[0];
	if (baseLang !== normalized && BROWSER_TO_WP_LOCALE[baseLang]) {
		return BROWSER_TO_WP_LOCALE[baseLang];
	}

	// Convert BCP 47 format to WordPress format (en-US -> en_US)
	if (normalized.includes('-')) {
		const [lang, region] = normalized.split('-');
		return `${lang}_${region.toUpperCase()}`;
	}

	// Single language code without region - return null to indicate
	// we should skip language setting (defaults to en_US)
	return null;
}

/**
 * Gets the user's preferred WordPress locale based on browser settings.
 *
 * Checks navigator.languages (array of preferred languages) first,
 * then falls back to navigator.language.
 *
 * @returns WordPress locale or null if browser language is English (default)
 */
export function getBrowserWpLocale(): string | null {
	const languages =
		typeof navigator !== 'undefined'
			? navigator.languages || [navigator.language]
			: [];

	for (const lang of languages) {
		if (!lang) continue;

		// Skip English variants since that's the default
		if (lang.toLowerCase().startsWith('en')) {
			return null;
		}

		const wpLocale = browserLanguageToWpLocale(lang);
		if (wpLocale) {
			return wpLocale;
		}
	}

	return null;
}

/**
 * Creates a setSiteLanguage blueprint step for the browser's language.
 *
 * @returns A setSiteLanguage step or null if no translation is needed
 */
export function createLanguageStep(): {
	step: 'setSiteLanguage';
	language: string;
} | null {
	const locale = getBrowserWpLocale();
	if (!locale) {
		return null;
	}
	return {
		step: 'setSiteLanguage',
		language: locale,
	};
}
