import type { PHP } from '@php-wasm/universal';
import { joinPaths, phpVar } from '@php-wasm/util';
import { unzipFile } from '@wp-playground/common';

/** Preload core translations before the installer creates default content. */
export async function prepareLocalizedInstallation(
	php: PHP,
	language: string
): Promise<{ language: string; title?: string }> {
	if (language === 'en_US') {
		return { language };
	}

	const preferences =
		language === 'browser' ? getBrowserLanguages() : undefined;
	if (preferences?.length === 0) {
		return { language: 'en_US' };
	}

	const version = await php.run({
		code: `<?php
			require ${phpVar(joinPaths(php.documentRoot, 'wp-includes/version.php'))};
			echo $wp_version;
		`,
	});
	const response = await fetch(
		`https://api.wordpress.org/translations/core/1.0/?version=${version.text}`
	);
	if (!response.ok) {
		throw new Error(
			`Failed to load WordPress translations: ${response.status}`
		);
	}
	const { translations } = (await response.json()) as {
		translations: { language: string; package: string }[];
	};
	const available: { language: string; package?: string }[] = [
		{ language: 'en_US' },
		...translations,
	];
	const translation = preferences
		? matchBrowserLanguage(preferences, available)
		: available.find(
				(translation) =>
					translation.language.toLowerCase() ===
					language.toLowerCase()
			);
	if (!translation) {
		if (preferences) {
			return { language: 'en_US' };
		}
		throw new Error(
			`No ${language} translation for WordPress ${version.text}.`
		);
	}
	if (!translation.package) {
		return { language: translation.language };
	}

	const archive = await fetch(translation.package);
	if (!archive.ok) {
		throw new Error(
			`Failed to download ${translation.language} translations.`
		);
	}
	const directory = joinPaths(php.documentRoot, 'wp-content/languages');
	php.mkdir(directory);
	await unzipFile(
		php,
		new File([await archive.arrayBuffer()], 'translations.zip'),
		directory
	);

	// Use a separate PHP execution so the installer starts with a fresh locale.
	const title = await php.run({
		code: `<?php
			define('WP_INSTALLING', true);
			require ${phpVar(joinPaths(php.documentRoot, 'wp-load.php'))};
			load_default_textdomain(${phpVar(translation.language)});
			echo __('My Site');
		`,
	});
	return { language: translation.language, title: title.text };
}

/** Read browser preferences without using Node.js's navigator locale. */
function getBrowserLanguages(): readonly string[] {
	if (
		typeof navigator === 'undefined' ||
		!(typeof window !== 'undefined' || 'WorkerGlobalScope' in globalThis)
	) {
		return [];
	}
	return navigator.languages?.length
		? navigator.languages
		: [navigator.language];
}

/** Try preferred locales in order, including less specific regional fallbacks. */
function matchBrowserLanguage<T extends { language: string }>(
	preferences: readonly string[],
	available: T[]
): T | undefined {
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
