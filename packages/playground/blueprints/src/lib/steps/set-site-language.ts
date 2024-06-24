import { StepHandler } from '.';

export interface SetSiteLanguageStep {
	step: 'setSiteLanguage';
	/** The language to set, e.g. 'en_US' */
	language: string;
}

export const setSiteLanguage: StepHandler<SetSiteLanguageStep> = async (
	playground,
	{ language }
) => {
	const docroot = await playground.documentRoot;

	await playground.defineConstant('WPLANG', language);
	await playground.run({
		code: `<?php
		require_once('${docroot}/wp-load.php');
		require_once('${docroot}/wp-admin/includes/admin.php');
		require_once('${docroot}/wp-admin/includes/translation-install.php');
		wp_download_language_pack('${language}');`,
	});
};
