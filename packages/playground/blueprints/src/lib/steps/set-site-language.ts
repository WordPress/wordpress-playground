import { StepHandler } from '.';

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
	const docroot = await playground.documentRoot;

	progress?.tracker.setCaption(progress?.initialCaption || 'Translating');
	await playground.defineConstant('WPLANG', language);
	await playground.run({
		code: `<?php
		require_once('${docroot}/wp-load.php');
		require_once('${docroot}/wp-admin/includes/admin.php');
		require_once('${docroot}/wp-admin/includes/translation-install.php');
		wp_download_language_pack('${language}');`,
	});
};
