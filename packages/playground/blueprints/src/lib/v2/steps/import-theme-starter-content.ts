import type { V2StepHandler } from '../types';
import { phpVar } from '@php-wasm/util';
import { registerV2StepHandler } from './index';

interface ImportThemeStarterContentArgs {
	themeSlug?: string;
}

/**
 * Imports the active theme's starter content into WordPress.
 *
 * Simulates the customizer environment so that
 * import_theme_starter_content() runs correctly, then
 * publishes the resulting changeset.
 */
const handler: V2StepHandler<ImportThemeStarterContentArgs> = async (
	args,
	context
) => {
	const { php } = context;
	const docroot = await php.documentRoot;
	const themeSlug = args.themeSlug || '';

	context.progress.setCaption('Importing theme starter content');

	await php.run({
		code: `<?php

/**
 * Ensure that the customizer loads as an admin user.
 *
 * For compatibility with themes, this MUST be run prior
 * to theme inclusion, which is why this is a
 * plugins_loaded filter instead of running
 * _wp_customize_include() manually after load.
 */
function importThemeStarterContent_plugins_loaded() {
	wp_set_current_user(
		get_users(array('role' => 'Administrator'))[0]
	);

	add_filter('pre_option_fresh_site', '__return_true');

	$_REQUEST['wp_customize']    = 'on';
	$_REQUEST['customize_theme'] =
		${phpVar(themeSlug)} ?: get_stylesheet();

	$_REQUEST['action'] = 'customize_save';
	add_filter('wp_doing_ajax', '__return_true');

	$_GET = $_REQUEST;
}
playground_add_filter(
	'plugins_loaded',
	'importThemeStarterContent_plugins_loaded',
	0
);

require ${phpVar(docroot)} . '/wp-load.php';

if (!get_theme_starter_content()) {
	return;
}

$wp_customize->import_theme_starter_content();

wp_publish_post($wp_customize->changeset_post_id());
`,
	});
};

registerV2StepHandler('importThemeStarterContent', handler);
