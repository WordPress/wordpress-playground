<?php
 function delete_theme( $stylesheet, $redirect = '' ) { global $wp_filesystem; if ( empty( $stylesheet ) ) { return false; } if ( empty( $redirect ) ) { $redirect = wp_nonce_url( 'themes.php?action=delete&stylesheet=' . urlencode( $stylesheet ), 'delete-theme_' . $stylesheet ); } ob_start(); $credentials = request_filesystem_credentials( $redirect ); $data = ob_get_clean(); if ( false === $credentials ) { if ( ! empty( $data ) ) { require_once ABSPATH . 'wp-admin/admin-header.php'; echo $data; require_once ABSPATH . 'wp-admin/admin-footer.php'; exit; } return; } if ( ! WP_Filesystem( $credentials ) ) { ob_start(); request_filesystem_credentials( $redirect, '', true ); $data = ob_get_clean(); if ( ! empty( $data ) ) { require_once ABSPATH . 'wp-admin/admin-header.php'; echo $data; require_once ABSPATH . 'wp-admin/admin-footer.php'; exit; } return; } if ( ! is_object( $wp_filesystem ) ) { return new WP_Error( 'fs_unavailable', __( 'Could not access filesystem.' ) ); } if ( is_wp_error( $wp_filesystem->errors ) && $wp_filesystem->errors->has_errors() ) { return new WP_Error( 'fs_error', __( 'Filesystem error.' ), $wp_filesystem->errors ); } $themes_dir = $wp_filesystem->wp_themes_dir(); if ( empty( $themes_dir ) ) { return new WP_Error( 'fs_no_themes_dir', __( 'Unable to locate WordPress theme directory.' ) ); } do_action( 'delete_theme', $stylesheet ); $themes_dir = trailingslashit( $themes_dir ); $theme_dir = trailingslashit( $themes_dir . $stylesheet ); $deleted = $wp_filesystem->delete( $theme_dir, true ); do_action( 'deleted_theme', $stylesheet, $deleted ); if ( ! $deleted ) { return new WP_Error( 'could_not_remove_theme', sprintf( __( 'Could not fully remove the theme %s.' ), $stylesheet ) ); } $theme_translations = wp_get_installed_translations( 'themes' ); if ( ! empty( $theme_translations[ $stylesheet ] ) ) { $translations = $theme_translations[ $stylesheet ]; foreach ( $translations as $translation => $data ) { $wp_filesystem->delete( WP_LANG_DIR . '/themes/' . $stylesheet . '-' . $translation . '.po' ); $wp_filesystem->delete( WP_LANG_DIR . '/themes/' . $stylesheet . '-' . $translation . '.mo' ); $json_translation_files = glob( WP_LANG_DIR . '/themes/' . $stylesheet . '-' . $translation . '-*.json' ); if ( $json_translation_files ) { array_map( array( $wp_filesystem, 'delete' ), $json_translation_files ); } } } if ( is_multisite() ) { WP_Theme::network_disable_theme( $stylesheet ); } delete_site_transient( 'update_themes' ); return true; } function get_page_templates( $post = null, $post_type = 'page' ) { return array_flip( wp_get_theme()->get_page_templates( $post, $post_type ) ); } function _get_template_edit_filename( $fullpath, $containingfolder ) { return str_replace( dirname( dirname( $containingfolder ) ), '', $fullpath ); } function theme_update_available( $theme ) { echo get_theme_update_available( $theme ); } function get_theme_update_available( $theme ) { static $themes_update = null; if ( ! current_user_can( 'update_themes' ) ) { return false; } if ( ! isset( $themes_update ) ) { $themes_update = get_site_transient( 'update_themes' ); } if ( ! ( $theme instanceof WP_Theme ) ) { return false; } $stylesheet = $theme->get_stylesheet(); $html = ''; if ( isset( $themes_update->response[ $stylesheet ] ) ) { $update = $themes_update->response[ $stylesheet ]; $theme_name = $theme->display( 'Name' ); $details_url = add_query_arg( array( 'TB_iframe' => 'true', 'width' => 1024, 'height' => 800, ), $update['url'] ); $update_url = wp_nonce_url( admin_url( 'update.php?action=upgrade-theme&amp;theme=' . urlencode( $stylesheet ) ), 'upgrade-theme_' . $stylesheet ); if ( ! is_multisite() ) { if ( ! current_user_can( 'update_themes' ) ) { $html = sprintf( '<p><strong>' . __( 'There is a new version of %1$s available. <a href="%2$s" %3$s>View version %4$s details</a>.' ) . '</strong></p>', $theme_name, esc_url( $details_url ), sprintf( 'class="thickbox open-plugin-details-modal" aria-label="%s"', esc_attr( sprintf( __( 'View %1$s version %2$s details' ), $theme_name, $update['new_version'] ) ) ), $update['new_version'] ); } elseif ( empty( $update['package'] ) ) { $html = sprintf( '<p><strong>' . __( 'There is a new version of %1$s available. <a href="%2$s" %3$s>View version %4$s details</a>. <em>Automatic update is unavailable for this theme.</em>' ) . '</strong></p>', $theme_name, esc_url( $details_url ), sprintf( 'class="thickbox open-plugin-details-modal" aria-label="%s"', esc_attr( sprintf( __( 'View %1$s version %2$s details' ), $theme_name, $update['new_version'] ) ) ), $update['new_version'] ); } else { $html = sprintf( '<p><strong>' . __( 'There is a new version of %1$s available. <a href="%2$s" %3$s>View version %4$s details</a> or <a href="%5$s" %6$s>update now</a>.' ) . '</strong></p>', $theme_name, esc_url( $details_url ), sprintf( 'class="thickbox open-plugin-details-modal" aria-label="%s"', esc_attr( sprintf( __( 'View %1$s version %2$s details' ), $theme_name, $update['new_version'] ) ) ), $update['new_version'], $update_url, sprintf( 'aria-label="%s" id="update-theme" data-slug="%s"', esc_attr( sprintf( _x( 'Update %s now', 'theme' ), $theme_name ) ), $stylesheet ) ); } } } return $html; } function get_theme_feature_list( $api = true ) { $features = array( __( 'Subject' ) => array( 'blog' => __( 'Blog' ), 'e-commerce' => __( 'E-Commerce' ), 'education' => __( 'Education' ), 'entertainment' => __( 'Entertainment' ), 'food-and-drink' => __( 'Food & Drink' ), 'holiday' => __( 'Holiday' ), 'news' => __( 'News' ), 'photography' => __( 'Photography' ), 'portfolio' => __( 'Portfolio' ), ), __( 'Features' ) => array( 'accessibility-ready' => __( 'Accessibility Ready' ), 'block-patterns' => __( 'Block Editor Patterns' ), 'block-styles' => __( 'Block Editor Styles' ), 'custom-background' => __( 'Custom Background' ), 'custom-colors' => __( 'Custom Colors' ), 'custom-header' => __( 'Custom Header' ), 'custom-logo' => __( 'Custom Logo' ), 'editor-style' => __( 'Editor Style' ), 'featured-image-header' => __( 'Featured Image Header' ), 'featured-images' => __( 'Featured Images' ), 'footer-widgets' => __( 'Footer Widgets' ), 'full-site-editing' => __( 'Full Site Editing' ), 'full-width-template' => __( 'Full Width Template' ), 'post-formats' => __( 'Post Formats' ), 'sticky-post' => __( 'Sticky Post' ), 'template-editing' => __( 'Template Editing' ), 'theme-options' => __( 'Theme Options' ), ), __( 'Layout' ) => array( 'grid-layout' => __( 'Grid Layout' ), 'one-column' => __( 'One Column' ), 'two-columns' => __( 'Two Columns' ), 'three-columns' => __( 'Three Columns' ), 'four-columns' => __( 'Four Columns' ), 'left-sidebar' => __( 'Left Sidebar' ), 'right-sidebar' => __( 'Right Sidebar' ), 'wide-blocks' => __( 'Wide Blocks' ), ), ); if ( ! $api || ! current_user_can( 'install_themes' ) ) { return $features; } $feature_list = get_site_transient( 'wporg_theme_feature_list' ); if ( ! $feature_list ) { set_site_transient( 'wporg_theme_feature_list', array(), 3 * HOUR_IN_SECONDS ); } if ( ! $feature_list ) { $feature_list = themes_api( 'feature_list', array() ); if ( is_wp_error( $feature_list ) ) { return $features; } } if ( ! $feature_list ) { return $features; } set_site_transient( 'wporg_theme_feature_list', $feature_list, 3 * HOUR_IN_SECONDS ); $category_translations = array( 'Layout' => __( 'Layout' ), 'Features' => __( 'Features' ), 'Subject' => __( 'Subject' ), ); $wporg_features = array(); foreach ( (array) $feature_list as $feature_category => $feature_items ) { if ( isset( $category_translations[ $feature_category ] ) ) { $feature_category = $category_translations[ $feature_category ]; } $wporg_features[ $feature_category ] = array(); foreach ( $feature_items as $feature ) { if ( isset( $features[ $feature_category ][ $feature ] ) ) { $wporg_features[ $feature_category ][ $feature ] = $features[ $feature_category ][ $feature ]; } else { $wporg_features[ $feature_category ][ $feature ] = $feature; } } } return $wporg_features; } function themes_api( $action, $args = array() ) { require ABSPATH . WPINC . '/version.php'; if ( is_array( $args ) ) { $args = (object) $args; } if ( 'query_themes' === $action ) { if ( ! isset( $args->per_page ) ) { $args->per_page = 24; } } if ( ! isset( $args->locale ) ) { $args->locale = get_user_locale(); } if ( ! isset( $args->wp_version ) ) { $args->wp_version = substr( $wp_version, 0, 3 ); } $args = apply_filters( 'themes_api_args', $args, $action ); $res = apply_filters( 'themes_api', false, $action, $args ); if ( ! $res ) { $url = 'http://api.wordpress.org/themes/info/1.2/'; $url = add_query_arg( array( 'action' => $action, 'request' => $args, ), $url ); $http_url = $url; $ssl = wp_http_supports( array( 'ssl' ) ); if ( $ssl ) { $url = set_url_scheme( $url, 'https' ); } $http_args = array( 'user-agent' => 'WordPress/' . $wp_version . '; ' . home_url( '/' ), ); $request = wp_remote_get( $url, $http_args ); if ( $ssl && is_wp_error( $request ) ) { if ( ! wp_doing_ajax() ) { trigger_error( sprintf( __( 'An unexpected error occurred. Something may be wrong with WordPress.org or this server&#8217;s configuration. If you continue to have problems, please try the <a href="%s">support forums</a>.' ), __( 'https://wordpress.org/support/forums/' ) ) . ' ' . __( '(WordPress could not establish a secure connection to WordPress.org. Please contact your server administrator.)' ), headers_sent() || WP_DEBUG ? E_USER_WARNING : E_USER_NOTICE ); } $request = wp_remote_get( $http_url, $http_args ); } if ( is_wp_error( $request ) ) { $res = new WP_Error( 'themes_api_failed', sprintf( __( 'An unexpected error occurred. Something may be wrong with WordPress.org or this server&#8217;s configuration. If you continue to have problems, please try the <a href="%s">support forums</a>.' ), __( 'https://wordpress.org/support/forums/' ) ), $request->get_error_message() ); } else { $res = json_decode( wp_remote_retrieve_body( $request ), true ); if ( is_array( $res ) ) { $res = (object) $res; } elseif ( null === $res ) { $res = new WP_Error( 'themes_api_failed', sprintf( __( 'An unexpected error occurred. Something may be wrong with WordPress.org or this server&#8217;s configuration. If you continue to have problems, please try the <a href="%s">support forums</a>.' ), __( 'https://wordpress.org/support/forums/' ) ), wp_remote_retrieve_body( $request ) ); } if ( isset( $res->error ) ) { $res = new WP_Error( 'themes_api_failed', $res->error ); } } if ( ! is_wp_error( $res ) ) { if ( 'query_themes' === $action ) { foreach ( $res->themes as $i => $theme ) { $res->themes[ $i ] = (object) $theme; } } if ( 'feature_list' === $action ) { $res = (array) $res; } } } return apply_filters( 'themes_api_result', $res, $action, $args ); } function wp_prepare_themes_for_js( $themes = null ) { $current_theme = get_stylesheet(); $prepared_themes = (array) apply_filters( 'pre_prepare_themes_for_js', array(), $themes, $current_theme ); if ( ! empty( $prepared_themes ) ) { return $prepared_themes; } $prepared_themes[ $current_theme ] = array(); if ( null === $themes ) { $themes = wp_get_themes( array( 'allowed' => true ) ); if ( ! isset( $themes[ $current_theme ] ) ) { $themes[ $current_theme ] = wp_get_theme(); } } $updates = array(); $no_updates = array(); if ( ! is_multisite() && current_user_can( 'update_themes' ) ) { $updates_transient = get_site_transient( 'update_themes' ); if ( isset( $updates_transient->response ) ) { $updates = $updates_transient->response; } if ( isset( $updates_transient->no_update ) ) { $no_updates = $updates_transient->no_update; } } WP_Theme::sort_by_name( $themes ); $parents = array(); $auto_updates = (array) get_site_option( 'auto_update_themes', array() ); foreach ( $themes as $theme ) { $slug = $theme->get_stylesheet(); $encoded_slug = urlencode( $slug ); $parent = false; if ( $theme->parent() ) { $parent = $theme->parent(); $parents[ $slug ] = $parent->get_stylesheet(); $parent = $parent->display( 'Name' ); } $customize_action = null; $can_edit_theme_options = current_user_can( 'edit_theme_options' ); $can_customize = current_user_can( 'customize' ); $is_block_theme = $theme->is_block_theme(); if ( $is_block_theme && $can_edit_theme_options ) { $customize_action = esc_url( admin_url( 'site-editor.php' ) ); } elseif ( ! $is_block_theme && $can_customize && $can_edit_theme_options ) { $customize_action = esc_url( add_query_arg( array( 'return' => urlencode( esc_url_raw( remove_query_arg( wp_removable_query_args(), wp_unslash( $_SERVER['REQUEST_URI'] ) ) ) ), ), wp_customize_url( $slug ) ) ); } $update_requires_wp = isset( $updates[ $slug ]['requires'] ) ? $updates[ $slug ]['requires'] : null; $update_requires_php = isset( $updates[ $slug ]['requires_php'] ) ? $updates[ $slug ]['requires_php'] : null; $auto_update = in_array( $slug, $auto_updates, true ); $auto_update_action = $auto_update ? 'disable-auto-update' : 'enable-auto-update'; if ( isset( $updates[ $slug ] ) ) { $auto_update_supported = true; $auto_update_filter_payload = (object) $updates[ $slug ]; } elseif ( isset( $no_updates[ $slug ] ) ) { $auto_update_supported = true; $auto_update_filter_payload = (object) $no_updates[ $slug ]; } else { $auto_update_supported = false; $auto_update_filter_payload = (object) array( 'theme' => $slug, 'new_version' => $theme->get( 'Version' ), 'url' => '', 'package' => '', 'requires' => $theme->get( 'RequiresWP' ), 'requires_php' => $theme->get( 'RequiresPHP' ), ); } $auto_update_forced = wp_is_auto_update_forced_for_item( 'theme', null, $auto_update_filter_payload ); $prepared_themes[ $slug ] = array( 'id' => $slug, 'name' => $theme->display( 'Name' ), 'screenshot' => array( $theme->get_screenshot() ), 'description' => $theme->display( 'Description' ), 'author' => $theme->display( 'Author', false, true ), 'authorAndUri' => $theme->display( 'Author' ), 'tags' => $theme->display( 'Tags' ), 'version' => $theme->get( 'Version' ), 'compatibleWP' => is_wp_version_compatible( $theme->get( 'RequiresWP' ) ), 'compatiblePHP' => is_php_version_compatible( $theme->get( 'RequiresPHP' ) ), 'updateResponse' => array( 'compatibleWP' => is_wp_version_compatible( $update_requires_wp ), 'compatiblePHP' => is_php_version_compatible( $update_requires_php ), ), 'parent' => $parent, 'active' => $slug === $current_theme, 'hasUpdate' => isset( $updates[ $slug ] ), 'hasPackage' => isset( $updates[ $slug ] ) && ! empty( $updates[ $slug ]['package'] ), 'update' => get_theme_update_available( $theme ), 'autoupdate' => array( 'enabled' => $auto_update || $auto_update_forced, 'supported' => $auto_update_supported, 'forced' => $auto_update_forced, ), 'actions' => array( 'activate' => current_user_can( 'switch_themes' ) ? wp_nonce_url( admin_url( 'themes.php?action=activate&amp;stylesheet=' . $encoded_slug ), 'switch-theme_' . $slug ) : null, 'customize' => $customize_action, 'delete' => ( ! is_multisite() && current_user_can( 'delete_themes' ) ) ? wp_nonce_url( admin_url( 'themes.php?action=delete&amp;stylesheet=' . $encoded_slug ), 'delete-theme_' . $slug ) : null, 'autoupdate' => wp_is_auto_update_enabled_for_type( 'theme' ) && ! is_multisite() && current_user_can( 'update_themes' ) ? wp_nonce_url( admin_url( 'themes.php?action=' . $auto_update_action . '&amp;stylesheet=' . $encoded_slug ), 'updates' ) : null, ), 'blockTheme' => $theme->is_block_theme(), ); } if ( ! empty( $parents ) && array_key_exists( $current_theme, $parents ) ) { unset( $prepared_themes[ $parents[ $current_theme ] ]['actions']['delete'] ); } $prepared_themes = apply_filters( 'wp_prepare_themes_for_js', $prepared_themes ); $prepared_themes = array_values( $prepared_themes ); return array_filter( $prepared_themes ); } function customize_themes_print_templates() { ?>
	<script type="text/html" id="tmpl-customize-themes-details-view">
		<div class="theme-backdrop"></div>
		<div class="theme-wrap wp-clearfix" role="document">
			<div class="theme-header">
				<button type="button" class="left dashicons dashicons-no"><span class="screen-reader-text"><?php _e( 'Show previous theme' ); ?></span></button>
				<button type="button" class="right dashicons dashicons-no"><span class="screen-reader-text"><?php _e( 'Show next theme' ); ?></span></button>
				<button type="button" class="close dashicons dashicons-no"><span class="screen-reader-text"><?php _e( 'Close details dialog' ); ?></span></button>
			</div>
			<div class="theme-about wp-clearfix">
				<div class="theme-screenshots">
				<# if ( data.screenshot && data.screenshot[0] ) { #>
					<div class="screenshot"><img src="{{ data.screenshot[0] }}?ver={{ data.version }}" alt="" /></div>
				<# } else { #>
					<div class="screenshot blank"></div>
				<# } #>
				</div>

				<div class="theme-info">
					<# if ( data.active ) { #>
						<span class="current-label"><?php _e( 'Active Theme' ); ?></span>
					<# } #>
					<h2 class="theme-name">{{{ data.name }}}<span class="theme-version">
						<?php
 printf( __( 'Version: %s' ), '{{ data.version }}' ); ?>
					</span></h2>
					<h3 class="theme-author">
						<?php
 printf( __( 'By %s' ), '{{{ data.authorAndUri }}}' ); ?>
					</h3>

					<# if ( data.stars && 0 != data.num_ratings ) { #>
						<div class="theme-rating">
							{{{ data.stars }}}
							<a class="num-ratings" target="_blank" href="{{ data.reviews_url }}">
								<?php
 printf( '%1$s <span class="screen-reader-text">%2$s</span>', sprintf( __( '(%s ratings)' ), '{{ data.num_ratings }}' ), __( '(opens in a new tab)' ) ); ?>
							</a>
						</div>
					<# } #>

					<# if ( data.hasUpdate ) { #>
						<# if ( data.updateResponse.compatibleWP && data.updateResponse.compatiblePHP ) { #>
							<div class="notice notice-warning notice-alt notice-large" data-slug="{{ data.id }}">
								<h3 class="notice-title"><?php _e( 'Update Available' ); ?></h3>
								{{{ data.update }}}
							</div>
						<# } else { #>
							<div class="notice notice-error notice-alt notice-large" data-slug="{{ data.id }}">
								<h3 class="notice-title"><?php _e( 'Update Incompatible' ); ?></h3>
								<p>
									<# if ( ! data.updateResponse.compatibleWP && ! data.updateResponse.compatiblePHP ) { #>
										<?php
 printf( __( 'There is a new version of %s available, but it does not work with your versions of WordPress and PHP.' ), '{{{ data.name }}}' ); if ( current_user_can( 'update_core' ) && current_user_can( 'update_php' ) ) { printf( ' ' . __( '<a href="%1$s">Please update WordPress</a>, and then <a href="%2$s">learn more about updating PHP</a>.' ), self_admin_url( 'update-core.php' ), esc_url( wp_get_update_php_url() ) ); wp_update_php_annotation( '</p><p><em>', '</em>' ); } elseif ( current_user_can( 'update_core' ) ) { printf( ' ' . __( '<a href="%s">Please update WordPress</a>.' ), self_admin_url( 'update-core.php' ) ); } elseif ( current_user_can( 'update_php' ) ) { printf( ' ' . __( '<a href="%s">Learn more about updating PHP</a>.' ), esc_url( wp_get_update_php_url() ) ); wp_update_php_annotation( '</p><p><em>', '</em>' ); } ?>
									<# } else if ( ! data.updateResponse.compatibleWP ) { #>
										<?php
 printf( __( 'There is a new version of %s available, but it does not work with your version of WordPress.' ), '{{{ data.name }}}' ); if ( current_user_can( 'update_core' ) ) { printf( ' ' . __( '<a href="%s">Please update WordPress</a>.' ), self_admin_url( 'update-core.php' ) ); } ?>
									<# } else if ( ! data.updateResponse.compatiblePHP ) { #>
										<?php
 printf( __( 'There is a new version of %s available, but it does not work with your version of PHP.' ), '{{{ data.name }}}' ); if ( current_user_can( 'update_php' ) ) { printf( ' ' . __( '<a href="%s">Learn more about updating PHP</a>.' ), esc_url( wp_get_update_php_url() ) ); wp_update_php_annotation( '</p><p><em>', '</em>' ); } ?>
									<# } #>
								</p>
							</div>
						<# } #>
					<# } #>

					<# if ( data.parent ) { #>
						<p class="parent-theme">
							<?php
 printf( __( 'This is a child theme of %s.' ), '<strong>{{{ data.parent }}}</strong>' ); ?>
						</p>
					<# } #>

					<# if ( ! data.compatibleWP || ! data.compatiblePHP ) { #>
						<div class="notice notice-error notice-alt notice-large"><p>
							<# if ( ! data.compatibleWP && ! data.compatiblePHP ) { #>
								<?php
 _e( 'This theme does not work with your versions of WordPress and PHP.' ); if ( current_user_can( 'update_core' ) && current_user_can( 'update_php' ) ) { printf( ' ' . __( '<a href="%1$s">Please update WordPress</a>, and then <a href="%2$s">learn more about updating PHP</a>.' ), self_admin_url( 'update-core.php' ), esc_url( wp_get_update_php_url() ) ); wp_update_php_annotation( '</p><p><em>', '</em>' ); } elseif ( current_user_can( 'update_core' ) ) { printf( ' ' . __( '<a href="%s">Please update WordPress</a>.' ), self_admin_url( 'update-core.php' ) ); } elseif ( current_user_can( 'update_php' ) ) { printf( ' ' . __( '<a href="%s">Learn more about updating PHP</a>.' ), esc_url( wp_get_update_php_url() ) ); wp_update_php_annotation( '</p><p><em>', '</em>' ); } ?>
							<# } else if ( ! data.compatibleWP ) { #>
								<?php
 _e( 'This theme does not work with your version of WordPress.' ); if ( current_user_can( 'update_core' ) ) { printf( ' ' . __( '<a href="%s">Please update WordPress</a>.' ), self_admin_url( 'update-core.php' ) ); } ?>
							<# } else if ( ! data.compatiblePHP ) { #>
								<?php
 _e( 'This theme does not work with your version of PHP.' ); if ( current_user_can( 'update_php' ) ) { printf( ' ' . __( '<a href="%s">Learn more about updating PHP</a>.' ), esc_url( wp_get_update_php_url() ) ); wp_update_php_annotation( '</p><p><em>', '</em>' ); } ?>
							<# } #>
						</p></div>
					<# } else if ( ! data.active && data.blockTheme ) { #>
						<div class="notice notice-error notice-alt notice-large"><p>
						<?php
 _e( 'This theme doesn\'t support Customizer.' ); ?>
						<# if ( data.actions.activate ) { #>
							<?php
 printf( ' ' . __( 'However, you can still <a href="%s">activate this theme</a>, and use the Site Editor to customize it.' ), '{{{ data.actions.activate }}}' ); ?>
						<# } #>
						</p></div>
					<# } #>

					<p class="theme-description">{{{ data.description }}}</p>

					<# if ( data.tags ) { #>
						<p class="theme-tags"><span><?php _e( 'Tags:' ); ?></span> {{{ data.tags }}}</p>
					<# } #>
				</div>
			</div>

			<div class="theme-actions">
				<# if ( data.active ) { #>
					<button type="button" class="button button-primary customize-theme"><?php _e( 'Customize' ); ?></button>
				<# } else if ( 'installed' === data.type ) { #>
					<?php if ( current_user_can( 'delete_themes' ) ) { ?>
						<# if ( data.actions && data.actions['delete'] ) { #>
							<a href="{{{ data.actions['delete'] }}}" data-slug="{{ data.id }}" class="button button-secondary delete-theme"><?php _e( 'Delete' ); ?></a>
						<# } #>
					<?php } ?>

					<# if ( data.blockTheme ) { #>
						<?php
 $aria_label = sprintf( _x( 'Activate %s', 'theme' ), '{{ data.name }}' ); ?>
						<# if ( data.compatibleWP && data.compatiblePHP && data.actions.activate ) { #>
							<a href="{{{ data.actions.activate }}}" class="button button-primary activate" aria-label="<?php echo esc_attr( $aria_label ); ?>"><?php _e( 'Activate' ); ?></a>
						<# } #>
					<# } else { #>
						<# if ( data.compatibleWP && data.compatiblePHP ) { #>
							<button type="button" class="button button-primary preview-theme" data-slug="{{ data.id }}"><?php _e( 'Live Preview' ); ?></button>
						<# } else { #>
							<button class="button button-primary disabled"><?php _e( 'Live Preview' ); ?></button>
						<# } #>
					<# } #>
				<# } else { #>
					<# if ( data.compatibleWP && data.compatiblePHP ) { #>
						<button type="button" class="button theme-install" data-slug="{{ data.id }}"><?php _e( 'Install' ); ?></button>
						<button type="button" class="button button-primary theme-install preview" data-slug="{{ data.id }}"><?php _e( 'Install &amp; Preview' ); ?></button>
					<# } else { #>
						<button type="button" class="button disabled"><?php _ex( 'Cannot Install', 'theme' ); ?></button>
						<button type="button" class="button button-primary disabled"><?php _e( 'Install &amp; Preview' ); ?></button>
					<# } #>
				<# } #>
			</div>
		</div>
	</script>
	<?php
} function is_theme_paused( $theme ) { if ( ! isset( $GLOBALS['_paused_themes'] ) ) { return false; } if ( get_stylesheet() !== $theme && get_template() !== $theme ) { return false; } return array_key_exists( $theme, $GLOBALS['_paused_themes'] ); } function wp_get_theme_error( $theme ) { if ( ! isset( $GLOBALS['_paused_themes'] ) ) { return false; } if ( ! array_key_exists( $theme, $GLOBALS['_paused_themes'] ) ) { return false; } return $GLOBALS['_paused_themes'][ $theme ]; } function resume_theme( $theme, $redirect = '' ) { list( $extension ) = explode( '/', $theme ); if ( ! empty( $redirect ) ) { $functions_path = ''; if ( strpos( STYLESHEETPATH, $extension ) ) { $functions_path = STYLESHEETPATH . '/functions.php'; } elseif ( strpos( TEMPLATEPATH, $extension ) ) { $functions_path = TEMPLATEPATH . '/functions.php'; } if ( ! empty( $functions_path ) ) { wp_redirect( add_query_arg( '_error_nonce', wp_create_nonce( 'theme-resume-error_' . $theme ), $redirect ) ); ob_start(); if ( ! defined( 'WP_SANDBOX_SCRAPING' ) ) { define( 'WP_SANDBOX_SCRAPING', true ); } include $functions_path; ob_clean(); } } $result = wp_paused_themes()->delete( $extension ); if ( ! $result ) { return new WP_Error( 'could_not_resume_theme', __( 'Could not resume the theme.' ) ); } return true; } function paused_themes_notice() { if ( 'themes.php' === $GLOBALS['pagenow'] ) { return; } if ( ! current_user_can( 'resume_themes' ) ) { return; } if ( ! isset( $GLOBALS['_paused_themes'] ) || empty( $GLOBALS['_paused_themes'] ) ) { return; } printf( '<div class="notice notice-error"><p><strong>%s</strong><br>%s</p><p><a href="%s">%s</a></p></div>', __( 'One or more themes failed to load properly.' ), __( 'You can find more details and make changes on the Themes screen.' ), esc_url( admin_url( 'themes.php' ) ), __( 'Go to the Themes screen' ) ); } 