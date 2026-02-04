#!/usr/bin/env npx tsx
/**
 * Generates a browser-to-WordPress locale mapping from the canonical
 * GlotPress locales.php file.
 *
 * Usage: npx tsx packages/playground/personal-wp/bin/generate-locale-map.ts
 *
 * This script:
 * 1. Fetches the GlotPress locales.php from GitHub
 * 2. Parses locale definitions to extract lang_code_iso_639_1, country_code, and wp_locale
 * 3. Builds a mapping from BCP 47 browser locales to WordPress locales
 * 4. Outputs JSON to src/lib/personalwp/locale-map.json
 */

import * as fs from 'fs';
import * as path from 'path';

const GLOTPRESS_LOCALES_URL =
	'https://raw.githubusercontent.com/GlotPress/GlotPress/develop/locales/locales.php';

interface LocaleInfo {
	wp_locale: string;
	lang_code_iso_639_1?: string;
	country_code?: string;
	english_name?: string;
}

/**
 * Fetches and parses locale definitions from GlotPress locales.php
 */
async function fetchLocales(): Promise<LocaleInfo[]> {
	const response = await fetch(GLOTPRESS_LOCALES_URL);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch locales.php: ${response.status} ${response.statusText}`
		);
	}
	const php = await response.text();
	return parseLocalesPhp(php);
}

/**
 * Parses the PHP file to extract locale information.
 * Looks for patterns like:
 *   $de = new GP_Locale();
 *   $de->wp_locale = 'de_DE';
 *   $de->lang_code_iso_639_1 = 'de';
 *   $de->country_code = 'de';
 */
function parseLocalesPhp(php: string): LocaleInfo[] {
	const locales: LocaleInfo[] = [];

	// Split into locale blocks - each starts with "$varname = new GP_Locale();"
	const blocks = php.split(/\$\w+\s*=\s*new\s+GP_Locale\s*\(\s*\)\s*;/);

	for (const block of blocks) {
		const locale: Partial<LocaleInfo> = {};

		// Extract wp_locale
		const wpLocaleMatch = block.match(
			/->\s*wp_locale\s*=\s*['"]([^'"]+)['"]/
		);
		if (wpLocaleMatch) {
			locale.wp_locale = wpLocaleMatch[1];
		}

		// Extract lang_code_iso_639_1
		const iso1Match = block.match(
			/->\s*lang_code_iso_639_1\s*=\s*['"]([^'"]+)['"]/
		);
		if (iso1Match) {
			locale.lang_code_iso_639_1 = iso1Match[1];
		}

		// Extract country_code
		const countryMatch = block.match(
			/->\s*country_code\s*=\s*['"]([^'"]+)['"]/
		);
		if (countryMatch) {
			locale.country_code = countryMatch[1];
		}

		// Extract english_name for debugging/comments
		const nameMatch = block.match(
			/->\s*english_name\s*=\s*['"]([^'"]+)['"]/
		);
		if (nameMatch) {
			locale.english_name = nameMatch[1];
		}

		if (locale.wp_locale) {
			locales.push(locale as LocaleInfo);
		}
	}

	return locales;
}

/**
 * Builds the browser locale to WordPress locale mapping.
 *
 * Strategy:
 * - For regional variants (e.g., de-at -> de_AT), create direct mappings
 * - For base languages (e.g., de -> de_DE), pick the "main" locale
 *   (where country_code matches lang_code_iso_639_1, or first occurrence)
 */
function buildLocaleMap(locales: LocaleInfo[]): Record<string, string> {
	const map: Record<string, string> = {};
	const baseLanguageOptions: Record<string, LocaleInfo[]> = {};

	for (const locale of locales) {
		if (!locale.lang_code_iso_639_1 || !locale.wp_locale) {
			continue;
		}

		const iso1 = locale.lang_code_iso_639_1.toLowerCase();
		const country = locale.country_code?.toLowerCase();

		// Build regional variant key (e.g., "de-at", "pt-br")
		if (country && country !== iso1) {
			const browserLocale = `${iso1}-${country}`;
			if (!map[browserLocale]) {
				map[browserLocale] = locale.wp_locale;
			}
		}

		// Collect options for base language mapping
		if (!baseLanguageOptions[iso1]) {
			baseLanguageOptions[iso1] = [];
		}
		baseLanguageOptions[iso1].push(locale);
	}

	// Pick the best base language mapping
	for (const [iso1, options] of Object.entries(baseLanguageOptions)) {
		if (map[iso1]) {
			continue; // Already set
		}

		// Prefer locale where country matches language (de_DE for de, fr_FR for fr)
		const primary = options.find(
			(l) => l.country_code?.toLowerCase() === iso1
		);
		if (primary) {
			map[iso1] = primary.wp_locale;
			continue;
		}

		// Otherwise use first available
		if (options.length > 0) {
			map[iso1] = options[0].wp_locale;
		}
	}

	// Add script-based Chinese variants that browsers may send
	// zh-Hans (Simplified) and zh-Hant (Traditional) are BCP 47 script subtags
	if (!map['zh-hans'] && map['zh-cn']) {
		map['zh-hans'] = map['zh-cn'];
	}
	if (!map['zh-hant'] && map['zh-tw']) {
		map['zh-hant'] = map['zh-tw'];
	}

	return map;
}

/**
 * Sorts the map for consistent output
 */
function sortMap(map: Record<string, string>): Record<string, string> {
	const sorted: Record<string, string> = {};
	const keys = Object.keys(map).sort((a, b) => {
		// Sort base languages first, then regional variants
		const aHasRegion = a.includes('-');
		const bHasRegion = b.includes('-');
		if (aHasRegion !== bHasRegion) {
			return aHasRegion ? 1 : -1;
		}
		return a.localeCompare(b);
	});
	for (const key of keys) {
		sorted[key] = map[key];
	}
	return sorted;
}

async function main() {
	console.log('Fetching GlotPress locales...');
	const locales = await fetchLocales();
	console.log(`Parsed ${locales.length} locales`);

	console.log('Building locale map...');
	const map = buildLocaleMap(locales);
	const sorted = sortMap(map);
	console.log(`Generated ${Object.keys(sorted).length} mappings`);

	const outputPath = path.resolve(
		__dirname,
		'../src/lib/personalwp/locale-map.json'
	);
	fs.writeFileSync(outputPath, JSON.stringify(sorted, null, '\t') + '\n');
	console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
