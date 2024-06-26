import { StepHandler } from '.';
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
	 * The name of the theme to import content from.
	 */
	themeSlug?: string;
}

/**
 * Imports a theme Starter Content into WordPress.
 *
 * @param playground Playground client.
 */
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
