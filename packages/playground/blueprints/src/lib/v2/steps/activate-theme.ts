import type { V2StepHandler } from '../types';
import { joinPaths, phpVar } from '@php-wasm/util';
import { registerV2StepHandler } from './index';

interface ActivateThemeArgs {
	themeDirectoryName: string;
}

/**
 * Activates an already-installed WordPress theme by its
 * folder name inside wp-content/themes/.
 */
const handler: V2StepHandler<ActivateThemeArgs> = async (args, context) => {
	const { php } = context;
	const docroot = await php.documentRoot;
	const themeFolderName = args.themeDirectoryName;

	const themeFolderPath = joinPaths(
		docroot,
		'wp-content',
		'themes',
		themeFolderName
	);
	if (!(await php.fileExists(themeFolderPath))) {
		throw new Error(
			`Cannot activate theme "${themeFolderName}": ` +
				`not found at ${themeFolderPath}`
		);
	}

	await php.run({
		code: `<?php
define('WP_ADMIN', true);
require_once(${phpVar(docroot)} . '/wp-load.php');

wp_set_current_user(
	get_users(array('role' => 'Administrator'))[0]->ID
);

switch_theme(${phpVar(themeFolderName)});

if (wp_get_theme()->get_stylesheet() !== ${phpVar(themeFolderName)}) {
	throw new Exception(
		'Theme ' . ${phpVar(themeFolderName)} .
		' could not be activated.'
	);
}
`,
	});
};

registerV2StepHandler('activateTheme', handler);
