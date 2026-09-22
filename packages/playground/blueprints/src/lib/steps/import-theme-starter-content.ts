import type { StepHandler } from '.';
import { phpVar } from '@php-wasm/util';

/**
 * @inheritDoc importThemeStarterContent
 * @example
 *
 * <code>
 * {
 * 		"step": "importThemeStarterContent"
 * }
 * </code>
 */
export interface ImportThemeStarterContentStep {
	/** The step identifier. */
	step: 'importThemeStarterContent';
	/**
	 * The slug of an installed theme to import content from. Defaults to the active theme.
	 */
	themeSlug?: string;
}

/* eslint-disable comment-length/limit-multi-line-comments */
/**
 * Imports a theme's starter content into WordPress and publishes it.
 * The theme must already be installed. If it has no starter content, this step does nothing.
 *
 * To import starter content when installing a theme, use `installTheme` with
 * `options.importStarterContent` set to `true`. Use this standalone step when you need to
 * add or modify starter content after installing the theme and before importing it.
 *
 * For example, this complete Blueprint writes and activates a plugin that registers a
 * Home page as starter content for the active theme, then imports it and sets it as the
 * site's front page. The plugin runs on `after_setup_theme` at priority 100, after callbacks
 * with lower priorities, and replaces previously registered starter content. Callbacks
 * registered later at priority 100, or at a higher priority, can replace this content again
 * before it is imported. All plugin code is included inline; no external PHP file is needed.
 *
 * ```json
 * {
 *   "steps": [
 *     {
 *       "step": "writeFile",
 *       "path": "/wordpress/wp-content/plugins/theme-starter-content.php",
 *       "data": "<?php\n// Plugin Name: Theme Starter Content\nadd_action( 'after_setup_theme', function () {\n    add_theme_support( 'starter-content', array(\n        'posts' => array(\n            'home' => array(\n                'post_type' => 'page',\n                'post_title' => 'Home',\n                'post_content' => 'Welcome to my Playground!'\n            )\n        ),\n        'options' => array(\n            'show_on_front' => 'page',\n            'page_on_front' => '{{home}}'\n        )\n    ) );\n}, 100 );"
 *     },
 *     {
 *       "step": "activatePlugin",
 *       "pluginPath": "/wordpress/wp-content/plugins/theme-starter-content.php"
 *     },
 *     {
 *       "step": "importThemeStarterContent"
 *     }
 *   ]
 * }
 * ```
 *
 * Learn more about supported content and placeholders in
 * [Starter content for themes in 4.7](https://make.wordpress.org/core/2016/11/30/starter-content-for-themes-in-4-7/).
 *
 * @param playground Playground client.
 */
/* eslint-enable comment-length/limit-multi-line-comments */
export const importThemeStarterContent: StepHandler<
	ImportThemeStarterContentStep
> = async (playground, { themeSlug = '' }, progress) => {
	progress?.tracker?.setCaption('Importing theme starter content');

	const docroot = await playground.documentRoot;
	await playground.run({
		code: `<?php

		/**
		 * Ensure that the customizer loads as an admin user.
		 *
		 * For compatibility with themes, this MUST be run prior to theme inclusion, which is why this is a plugins_loaded filter instead
		 * of running _wp_customize_include() manually after load.
		 */
		function importThemeStarterContent_plugins_loaded() {
			// Set as the admin user, this ensures we can customize the site.
			wp_set_current_user(
				get_users( [ 'role' => 'Administrator' ] )[0]
			);

			// Force the site to be fresh, although it should already be.
			add_filter( 'pre_option_fresh_site', '__return_true' );

			/*
			 * Simulate this request as the customizer loading with the current theme in preview mode.
			 *
			 * See _wp_customize_include()
			 */
			$_REQUEST['wp_customize']    = 'on';
			$_REQUEST['customize_theme'] = ${phpVar(themeSlug)} ?: get_stylesheet();

			/*
			 * Claim this is a ajax request saving settings, to avoid the preview filters being applied.
			 */
			$_REQUEST['action'] = 'customize_save';
			add_filter( 'wp_doing_ajax', '__return_true' );

			$_GET = $_REQUEST;
		}
		playground_add_filter( 'plugins_loaded', 'importThemeStarterContent_plugins_loaded', 0 );

		require ${phpVar(docroot)} . '/wp-load.php';

		// Return early if there's no starter content.
		if ( ! get_theme_starter_content() ) {
			return;
		}

		// Import the Starter Content.
		$wp_customize->import_theme_starter_content();

		// Publish the changeset, which publishes the starter content.
		wp_publish_post( $wp_customize->changeset_post_id() );
		`,
	});
};
