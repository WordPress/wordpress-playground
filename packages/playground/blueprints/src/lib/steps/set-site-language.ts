import { StepHandler } from '.';
import { unzipFile } from '@wp-playground/common';
import { logger } from '@php-wasm/logger';
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
	/** The language to set, e.g. 'en_US' */
	language: string;
}

/**
 * Sets the site language and download translations.
 */
export const setSiteLanguage: StepHandler<SetSiteLanguageStep> = async (
	playground,
	{ language },
	progress
) => {
	progress?.tracker.setCaption(progress?.initialCaption || 'Translating');

	await playground.defineConstant('WPLANG', language);

	const docroot = await playground.documentRoot;

	const wpVersion = (
		await playground.run({
			code: `<?php
			require '${docroot}/wp-includes/version.php';
			echo $wp_version;
		`,
		})
	).text;

	const translations = [
		{
			url: `https://downloads.wordpress.org/translation/core/${wpVersion}/${language}.zip`,
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

	for (const { url, type } of translations) {
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
				new File([await response.blob()], `${language}-${type}.zip`),
				destination
			);
		} catch (error) {
			/**
			 * If a core translation wasn't found we should throw an error because it
			 * means the language is not supported or the language code isn't correct.
			 */
			if (type === 'core') {
				throw new Error(
					`Failed to download translations for WordPress. Please check if the language code ${language} is correct. You can find all available languages and translations on https://translate.wordpress.org/.`
				);
			}
			/**
			 * Some languages don't have translations for themes and plugins and will
			 * return a 404 and a CORS error. In this case, we can just skip the
			 * download because Playground can still work without them.
			 */
			logger.warn(`Error downloading translations for ${type}: ${error}`);
		}
	}
};
