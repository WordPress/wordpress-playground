/**
 * Internationalization support for personal WordPress Playground.
 *
 * Detects the user's browser language and maps it to a WordPress locale
 * for automatic language configuration.
 *
 * The locale map is loaded dynamically to avoid bundling it in the main chunk,
 * since it's only needed once during first boot.
 */

type LocaleMap = Record<string, string>;

let localeMapPromise: Promise<LocaleMap> | null = null;

/**
 * Lazily loads the browser-to-WordPress locale mapping.
 *
 * Generated from the canonical GlotPress locales.php file.
 * To regenerate: npx tsx packages/playground/personal-wp/bin/generate-locale-map.ts
 */
async function getLocaleMap(): Promise<LocaleMap> {
	if (!localeMapPromise) {
		localeMapPromise = import('./locale-map.json').then((m) => m.default);
	}
	return localeMapPromise;
}

/**
 * Converts a browser language code (BCP 47) to a WordPress locale.
 *
 * @param browserLang - Browser language code (e.g., "en-US", "de", "pt-BR")
 * @returns WordPress locale (e.g., "en_US", "de_DE", "pt_BR") or null if no mapping
 */
export async function browserLanguageToWpLocale(
	browserLang: string
): Promise<string | null> {
	const localeMap = await getLocaleMap();
	const normalized = browserLang.toLowerCase();

	// Check for explicit mapping first
	if (localeMap[normalized]) {
		return localeMap[normalized];
	}

	// Try base language without region
	const baseLang = normalized.split('-')[0];
	if (baseLang !== normalized && localeMap[baseLang]) {
		return localeMap[baseLang];
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
export async function getBrowserWpLocale(): Promise<string | null> {
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

		const wpLocale = await browserLanguageToWpLocale(lang);
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
export async function createLanguageStep(): Promise<{
	step: 'setSiteLanguage';
	language: string;
} | null> {
	const locale = await getBrowserWpLocale();
	if (!locale) {
		return null;
	}
	return {
		step: 'setSiteLanguage',
		language: locale,
	};
}
