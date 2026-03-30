import type { V2StepHandler } from '../types';
import { phpVar } from '@php-wasm/util';
import { registerV2StepHandler } from './index';

interface SetSiteLanguageArgs {
	language: string;
}

/**
 * Sets the WordPress site language and downloads translation
 * packs for WordPress core, installed plugins, and installed
 * themes.
 */
const handler: V2StepHandler<SetSiteLanguageArgs> = async (args, context) => {
	const { php } = context;
	const docroot = await php.documentRoot;
	const language = args.language;

	context.progress.setCaption('Setting site language');

	// 1. Set the WPLANG option.
	await php.run({
		code: `<?php
require_once(${phpVar(docroot)} . '/wp-load.php');
update_option('WPLANG', ${phpVar(language)});
`,
	});

	// 2. Get the installed WordPress version.
	const wpVersionResult = await php.run({
		code: `<?php
require ${phpVar(docroot)} . '/wp-includes/version.php';
echo $wp_version;
`,
	});
	const wpVersion = wpVersionResult.text;

	// 3. Build the list of translations to download.
	const coreTranslationUrl = await fetchCoreTranslationUrl(
		wpVersion,
		language
	);

	const pluginListResult = await php.run({
		code: `<?php
require_once(${phpVar(docroot)} . '/wp-load.php');
require_once(${phpVar(docroot)} . '/wp-admin/includes/plugin.php');
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
);
`,
	});

	const themeListResult = await php.run({
		code: `<?php
require_once(${phpVar(docroot)} . '/wp-load.php');
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
);
`,
	});

	const plugins: Array<{ slug: string; version: string }> =
		pluginListResult.json ?? [];
	const themes: Array<{ slug: string; version: string }> =
		themeListResult.json ?? [];

	// 4. Ensure language directories exist.
	const langDir = `${docroot}/wp-content/languages`;
	if (!(await php.fileExists(langDir))) {
		await php.mkdir(langDir);
	}
	const pluginsLangDir = `${langDir}/plugins`;
	if (!(await php.fileExists(pluginsLangDir))) {
		await php.mkdir(pluginsLangDir);
	}
	const themesLangDir = `${langDir}/themes`;
	if (!(await php.fileExists(themesLangDir))) {
		await php.mkdir(themesLangDir);
	}

	// 5. Download and extract translations.
	await downloadAndExtract(coreTranslationUrl, langDir, php);

	for (const { slug, version } of plugins) {
		const url =
			`https://downloads.wordpress.org/translation/plugin/` +
			`${slug}/${version}/${language}.zip`;
		try {
			await downloadAndExtract(url, pluginsLangDir, php);
		} catch {
			// Not all plugins have translations for every
			// language. This is expected — skip silently.
		}
	}

	for (const { slug, version } of themes) {
		const url =
			`https://downloads.wordpress.org/translation/theme/` +
			`${slug}/${version}/${language}.zip`;
		try {
			await downloadAndExtract(url, themesLangDir, php);
		} catch {
			// Not all themes have translations for every
			// language. This is expected — skip silently.
		}
	}
};

/**
 * Fetches the core translation package URL from the
 * WordPress.org translations API.
 */
async function fetchCoreTranslationUrl(
	wpVersion: string,
	language: string
): Promise<string> {
	const apiUrl =
		`https://api.wordpress.org/translations/core/1.0/` +
		`?version=${wpVersion}`;
	const response = await fetch(apiUrl);
	const data = await response.json();

	const match = data.translations.find(
		(t: { language: string }) =>
			t.language.toLowerCase() === language.toLowerCase()
	);
	if (!match) {
		throw new Error(
			`Translation package for "${language}" not found ` +
				`for WordPress ${wpVersion}. Check that the ` +
				`language code is correct.`
		);
	}
	return match.package;
}

/**
 * Downloads a zip file from a URL and extracts it into the
 * given destination directory using PHP ZipArchive.
 */
async function downloadAndExtract(
	url: string,
	destDir: string,
	php: Parameters<V2StepHandler>[1]['php']
): Promise<void> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to download translation: ${url} ` +
				`(${response.status} ${response.statusText})`
		);
	}
	const buffer = await response.arrayBuffer();
	const tempPath = '/tmp/translation.zip';
	await php.writeFile(tempPath, new Uint8Array(buffer));
	await php.run({
		code: `<?php
$zip = new ZipArchive();
$res = $zip->open(${phpVar(tempPath)});
if ($res !== true) {
	throw new Exception('Failed to open zip: error code ' . $res);
}
$zip->extractTo(${phpVar(destDir)});
$zip->close();
unlink(${phpVar(tempPath)});
`,
	});
}

registerV2StepHandler('setSiteLanguage', handler);
