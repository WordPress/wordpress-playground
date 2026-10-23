import type { StepHandler } from '.';
import { unzipFile } from '@wp-playground/common';
import { logger } from '@php-wasm/logger';
import { phpVar, Semaphore } from '@php-wasm/util';
/**
 * @inheritDoc setSiteLanguage
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "setSiteLanguage",
 * 		"language": "en_US"
 * }
 * </code>
 */
export interface SetSiteLanguageStep {
	step: 'setSiteLanguage';
	/**
	 * The WordPress locale to set, e.g. 'en_US'. Use 'browser' to select an available
	 * translation using navigator.languages, in preference order, with regional
	 * language fallbacks. Falls back to 'en_US' if no match or browser is unavailable.
	 */
	language: string;
}

/**
 * Get the translation package URL for a given WordPress version and language.
 * The translation package URL is fetched from the WordPress.org API based on
 * the provided WordPress version.
 *
 * If the translation package is not found, an error is thrown.
 */
export const getWordPressTranslationUrl = async (
	wpVersion: string,
	language: string
): Promise<string> => {
	const languageTranslations = await fetch(
		`https://api.wordpress.org/translations/core/1.0/?version=${wpVersion}`
	);
	const languageTranslationsJson = await languageTranslations.json();
	const languageTranslation = languageTranslationsJson.translations.find(
		(translation: any) =>
			translation.language.toLowerCase() === language.toLowerCase()
	);

	if (!languageTranslation) {
		throw new Error(
			`Failed to get ${language} translation package for WordPress ${wpVersion}.`
		);
	}

	return languageTranslation.package;
};

/**
 * Sets the site language and download translations.
 */
export const setSiteLanguage: StepHandler<SetSiteLanguageStep> = async (
	playground,
	{ language },
	progress
) => {
	progress?.tracker.setCaption(progress?.initialCaption || 'Translating');

	const docroot = await playground.documentRoot;

	const wpVersion = (
		await playground.run({
			code: `<?php
			require '${docroot}/wp-includes/version.php';
			echo $wp_version;
		`,
		})
	).text;

	const browserTranslation =
		language === 'browser'
			? await getBrowserTranslation(wpVersion)
			: undefined;
	if (language === 'browser') {
		language = browserTranslation?.language ?? 'en_US';
	}

	await playground.defineConstant('WPLANG', language);
	await playground.run({
		code: `<?php
		require_once ${phpVar(docroot)} . '/wp-load.php';
		update_option('WPLANG', ${phpVar(language)});
		`,
	});

	// US English is bundled with WordPress and has no translation package.
	if (language === 'en_US') {
		return;
	}

	const translations = [
		{
			url:
				browserTranslation?.package ??
				(await getWordPressTranslationUrl(wpVersion, language)),
			type: 'core',
		},
	];

	const pluginListResponse = await playground.run({
		code: `<?php
		require_once('${docroot}/wp-load.php');
		require_once('${docroot}/wp-admin/includes/plugin.php');
		echo json_encode(
			array_values(
				array_map(
					function($plugin) {
						return [
							'slug'    => $plugin['TextDomain'],
							'version' => $plugin['Version']
						];
					},
					array_filter(
						get_plugins(),
						function($plugin) {
							return !empty($plugin['TextDomain']);
						}
					)
				)
			)
		);`,
	});

	const plugins = pluginListResponse.json;
	for (const { slug, version } of plugins) {
		translations.push({
			url: `https://downloads.wordpress.org/translation/plugin/${slug}/${version}/${language}.zip`,
			type: 'plugin',
		});
	}

	const themeListResponse = await playground.run({
		code: `<?php
		require_once('${docroot}/wp-load.php');
		require_once('${docroot}/wp-admin/includes/theme.php');
		echo json_encode(
			array_values(
				array_map(
					function($theme) {
						return [
							'slug'    => $theme->get('TextDomain'),
							'version' => $theme->get('Version')
						];
					},
					wp_get_themes()
				)
			)
		);`,
	});

	const themes = themeListResponse.json;
	for (const { slug, version } of themes) {
		translations.push({
			url: `https://downloads.wordpress.org/translation/theme/${slug}/${version}/${language}.zip`,
			type: 'theme',
		});
	}

	if (!(await playground.isDir(`${docroot}/wp-content/languages/plugins`))) {
		await playground.mkdir(`${docroot}/wp-content/languages/plugins`);
	}
	if (!(await playground.isDir(`${docroot}/wp-content/languages/themes`))) {
		await playground.mkdir(`${docroot}/wp-content/languages/themes`);
	}

	// Fetch translations in parallel
	const fetchQueue = new Semaphore({ concurrency: 5 });
	const translationsQueue = translations.map(({ url, type }) =>
		fetchQueue.run(async () => {
			try {
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(
						`Failed to download translations for ${type}: ${response.statusText}`
					);
				}

				let destination = `${docroot}/wp-content/languages`;
				if (type === 'plugin') {
					destination += '/plugins';
				} else if (type === 'theme') {
					destination += '/themes';
				}

				await unzipFile(
					playground,
					new File(
						[await response.arrayBuffer()],
						`${language}-${type}.zip`
					),
					destination
				);
			} catch (error) {
				/**
				 * Throw an error when a core translation isn't found.
				 *
				 * The language slug used in the Blueprint is not recognized by the
				 * WordPress.org API and will always return a 404. This is likely
				 * unintentional – perhaps a typo or the API consumer guessed the
				 * slug wrong.
				 *
				 * The least we can do is communicate the problem.
				 */
				if (type === 'core') {
					throw new Error(
						`Failed to download translations for WordPress. Please check if the language code ${language} is correct. You can find all available languages and translations on https://translate.wordpress.org/.`
					);
				}
				/**
				 * WordPress core has translations for the requested language,
				 * but one of the installed plugins or themes doesn't.
				 *
				 * This is fine. Not all plugins and themes have translations for
				 * every language. Let's just log a warning and move on.
				 */
				logger.warn(
					`Error downloading translations for ${type}: ${error}`
				);
			}
		})
	);
	await Promise.all(translationsQueue);
};

/** Resolve browser preferences against translations available for this WordPress version. */
async function getBrowserTranslation(
	wpVersion: string
): Promise<{ language: string; package?: string } | undefined> {
	// Node.js also exposes navigator, but its locale is not a browser preference.
	if (
		typeof navigator === 'undefined' ||
		!(typeof window !== 'undefined' || 'WorkerGlobalScope' in globalThis)
	) {
		return;
	}

	const preferences = navigator.languages?.length
		? navigator.languages
		: [navigator.language];
	const response = await fetch(
		`https://api.wordpress.org/translations/core/1.0/?version=${wpVersion}`
	);
	const { translations } = (await response.json()) as {
		translations: { language: string; package: string }[];
	};
	const available = [
		{ language: 'en_US', package: undefined },
		...translations,
	];
	for (const preference of preferences) {
		let tag = preference.toLowerCase();
		while (tag) {
			const exact = available.find(
				({ language }) =>
					language.replaceAll('_', '-').toLowerCase() === tag
			);
			const match =
				exact ??
				available.find(({ language }) =>
					language
						.replaceAll('_', '-')
						.toLowerCase()
						.startsWith(tag + '-')
				);
			if (match) {
				return match;
			}
			const separator = tag.lastIndexOf('-');
			tag = separator === -1 ? '' : tag.slice(0, separator);
		}
	}
	return undefined;
}
