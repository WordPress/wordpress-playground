<?php
 function plugins_api( $action, $args = array() ) { require ABSPATH . WPINC . '/version.php'; if ( is_array( $args ) ) { $args = (object) $args; } if ( 'query_plugins' === $action ) { if ( ! isset( $args->per_page ) ) { $args->per_page = 24; } } if ( ! isset( $args->locale ) ) { $args->locale = get_user_locale(); } if ( ! isset( $args->wp_version ) ) { $args->wp_version = substr( $wp_version, 0, 3 ); } $args = apply_filters( 'plugins_api_args', $args, $action ); $res = apply_filters( 'plugins_api', false, $action, $args ); if ( false === $res ) { $url = 'http://api.wordpress.org/plugins/info/1.2/'; $url = add_query_arg( array( 'action' => $action, 'request' => $args, ), $url ); $http_url = $url; $ssl = wp_http_supports( array( 'ssl' ) ); if ( $ssl ) { $url = set_url_scheme( $url, 'https' ); } $http_args = array( 'timeout' => 15, 'user-agent' => 'WordPress/' . $wp_version . '; ' . home_url( '/' ), ); $request = wp_remote_get( $url, $http_args ); if ( $ssl && is_wp_error( $request ) ) { if ( ! wp_is_json_request() ) { trigger_error( sprintf( __( 'An unexpected error occurred. Something may be wrong with WordPress.org or this server&#8217;s configuration. If you continue to have problems, please try the <a href="%s">support forums</a>.' ), __( 'https://wordpress.org/support/forums/' ) ) . ' ' . __( '(WordPress could not establish a secure connection to WordPress.org. Please contact your server administrator.)' ), headers_sent() || WP_DEBUG ? E_USER_WARNING : E_USER_NOTICE ); } $request = wp_remote_get( $http_url, $http_args ); } if ( is_wp_error( $request ) ) { $res = new WP_Error( 'plugins_api_failed', sprintf( __( 'An unexpected error occurred. Something may be wrong with WordPress.org or this server&#8217;s configuration. If you continue to have problems, please try the <a href="%s">support forums</a>.' ), __( 'https://wordpress.org/support/forums/' ) ), $request->get_error_message() ); } else { $res = json_decode( wp_remote_retrieve_body( $request ), true ); if ( is_array( $res ) ) { $res = (object) $res; } elseif ( null === $res ) { $res = new WP_Error( 'plugins_api_failed', sprintf( __( 'An unexpected error occurred. Something may be wrong with WordPress.org or this server&#8217;s configuration. If you continue to have problems, please try the <a href="%s">support forums</a>.' ), __( 'https://wordpress.org/support/forums/' ) ), wp_remote_retrieve_body( $request ) ); } if ( isset( $res->error ) ) { $res = new WP_Error( 'plugins_api_failed', $res->error ); } } } elseif ( ! is_wp_error( $res ) ) { $res->external = true; } return apply_filters( 'plugins_api_result', $res, $action, $args ); } function install_popular_tags( $args = array() ) { $key = md5( serialize( $args ) ); $tags = get_site_transient( 'poptags_' . $key ); if ( false !== $tags ) { return $tags; } $tags = plugins_api( 'hot_tags', $args ); if ( is_wp_error( $tags ) ) { return $tags; } set_site_transient( 'poptags_' . $key, $tags, 3 * HOUR_IN_SECONDS ); return $tags; } function install_dashboard() { display_plugins_table(); ?>

	<div class="plugins-popular-tags-wrapper">
	<h2><?php _e( 'Popular tags' ); ?></h2>
	<p><?php _e( 'You may also browse based on the most popular tags in the Plugin Directory:' ); ?></p>
	<?php
 $api_tags = install_popular_tags(); echo '<p class="popular-tags">'; if ( is_wp_error( $api_tags ) ) { echo $api_tags->get_error_message(); } else { $tags = array(); foreach ( (array) $api_tags as $tag ) { $url = self_admin_url( 'plugin-install.php?tab=search&type=tag&s=' . urlencode( $tag['name'] ) ); $data = array( 'link' => esc_url( $url ), 'name' => $tag['name'], 'slug' => $tag['slug'], 'id' => sanitize_title_with_dashes( $tag['name'] ), 'count' => $tag['count'], ); $tags[ $tag['name'] ] = (object) $data; } echo wp_generate_tag_cloud( $tags, array( 'single_text' => __( '%s plugin' ), 'multiple_text' => __( '%s plugins' ), ) ); } echo '</p><br class="clear" /></div>'; } function install_search_form( $deprecated = true ) { $type = isset( $_REQUEST['type'] ) ? wp_unslash( $_REQUEST['type'] ) : 'term'; $term = isset( $_REQUEST['s'] ) ? wp_unslash( $_REQUEST['s'] ) : ''; ?>
	<form class="search-form search-plugins" method="get">
		<input type="hidden" name="tab" value="search" />
		<label class="screen-reader-text" for="typeselector"><?php _e( 'Search plugins by:' ); ?></label>
		<select name="type" id="typeselector">
			<option value="term"<?php selected( 'term', $type ); ?>><?php _e( 'Keyword' ); ?></option>
			<option value="author"<?php selected( 'author', $type ); ?>><?php _e( 'Author' ); ?></option>
			<option value="tag"<?php selected( 'tag', $type ); ?>><?php _ex( 'Tag', 'Plugin Installer' ); ?></option>
		</select>
		<label class="screen-reader-text" for="search-plugins"><?php _e( 'Search Plugins' ); ?></label>
		<input type="search" name="s" id="search-plugins" value="<?php echo esc_attr( $term ); ?>" class="wp-filter-search" placeholder="<?php esc_attr_e( 'Search plugins...' ); ?>" />
		<?php submit_button( __( 'Search Plugins' ), 'hide-if-js', false, false, array( 'id' => 'search-submit' ) ); ?>
	</form>
	<?php
} function install_plugins_upload() { ?>
<div class="upload-plugin">
	<p class="install-help"><?php _e( 'If you have a plugin in a .zip format, you may install or update it by uploading it here.' ); ?></p>
	<form method="post" enctype="multipart/form-data" class="wp-upload-form" action="<?php echo self_admin_url( 'update.php?action=upload-plugin' ); ?>">
		<?php wp_nonce_field( 'plugin-upload' ); ?>
		<label class="screen-reader-text" for="pluginzip"><?php _e( 'Plugin zip file' ); ?></label>
		<input type="file" id="pluginzip" name="pluginzip" accept=".zip" />
		<?php submit_button( __( 'Install Now' ), '', 'install-plugin-submit', false ); ?>
	</form>
</div>
	<?php
} function install_plugins_favorites_form() { $user = get_user_option( 'wporg_favorites' ); $action = 'save_wporg_username_' . get_current_user_id(); ?>
	<p><?php _e( 'If you have marked plugins as favorites on WordPress.org, you can browse them here.' ); ?></p>
	<form method="get">
		<input type="hidden" name="tab" value="favorites" />
		<p>
			<label for="user"><?php _e( 'Your WordPress.org username:' ); ?></label>
			<input type="search" id="user" name="user" value="<?php echo esc_attr( $user ); ?>" />
			<input type="submit" class="button" value="<?php esc_attr_e( 'Get Favorites' ); ?>" />
			<input type="hidden" id="wporg-username-nonce" name="_wpnonce" value="<?php echo esc_attr( wp_create_nonce( $action ) ); ?>" />
		</p>
	</form>
	<?php
} function display_plugins_table() { global $wp_list_table; switch ( current_filter() ) { case 'install_plugins_beta': printf( '<p>' . __( 'You are using a development version of WordPress. These feature plugins are also under development. <a href="%s">Learn more</a>.' ) . '</p>', 'https://make.wordpress.org/core/handbook/about/release-cycle/features-as-plugins/' ); break; case 'install_plugins_featured': printf( '<p>' . __( 'Plugins extend and expand the functionality of WordPress. You may automatically install plugins from the <a href="%s">WordPress Plugin Directory</a> or upload a plugin in .zip format by clicking the button at the top of this page.' ) . '</p>', __( 'https://wordpress.org/plugins/' ) ); break; case 'install_plugins_recommended': echo '<p>' . __( 'These suggestions are based on the plugins you and other users have installed.' ) . '</p>'; break; case 'install_plugins_favorites': if ( empty( $_GET['user'] ) && ! get_user_option( 'wporg_favorites' ) ) { return; } break; } ?>
	<form id="plugin-filter" method="post">
		<?php $wp_list_table->display(); ?>
	</form>
	<?php
} function install_plugin_install_status( $api, $loop = false ) { if ( is_array( $api ) ) { $api = (object) $api; } $status = 'install'; $url = false; $update_file = false; $version = ''; $update_plugins = get_site_transient( 'update_plugins' ); if ( isset( $update_plugins->response ) ) { foreach ( (array) $update_plugins->response as $file => $plugin ) { if ( $plugin->slug === $api->slug ) { $status = 'update_available'; $update_file = $file; $version = $plugin->new_version; if ( current_user_can( 'update_plugins' ) ) { $url = wp_nonce_url( self_admin_url( 'update.php?action=upgrade-plugin&plugin=' . $update_file ), 'upgrade-plugin_' . $update_file ); } break; } } } if ( 'install' === $status ) { if ( is_dir( WP_PLUGIN_DIR . '/' . $api->slug ) ) { $installed_plugin = get_plugins( '/' . $api->slug ); if ( empty( $installed_plugin ) ) { if ( current_user_can( 'install_plugins' ) ) { $url = wp_nonce_url( self_admin_url( 'update.php?action=install-plugin&plugin=' . $api->slug ), 'install-plugin_' . $api->slug ); } } else { $key = array_keys( $installed_plugin ); $key = reset( $key ); $update_file = $api->slug . '/' . $key; if ( version_compare( $api->version, $installed_plugin[ $key ]['Version'], '=' ) ) { $status = 'latest_installed'; } elseif ( version_compare( $api->version, $installed_plugin[ $key ]['Version'], '<' ) ) { $status = 'newer_installed'; $version = $installed_plugin[ $key ]['Version']; } else { if ( ! $loop ) { delete_site_transient( 'update_plugins' ); wp_update_plugins(); return install_plugin_install_status( $api, true ); } } } } else { if ( current_user_can( 'install_plugins' ) ) { $url = wp_nonce_url( self_admin_url( 'update.php?action=install-plugin&plugin=' . $api->slug ), 'install-plugin_' . $api->slug ); } } } if ( isset( $_GET['from'] ) ) { $url .= '&amp;from=' . urlencode( wp_unslash( $_GET['from'] ) ); } $file = $update_file; return compact( 'status', 'url', 'version', 'file' ); } function install_plugin_information() { global $tab; if ( empty( $_REQUEST['plugin'] ) ) { return; } $api = plugins_api( 'plugin_information', array( 'slug' => wp_unslash( $_REQUEST['plugin'] ), ) ); if ( is_wp_error( $api ) ) { wp_die( $api ); } $plugins_allowedtags = array( 'a' => array( 'href' => array(), 'title' => array(), 'target' => array(), ), 'abbr' => array( 'title' => array() ), 'acronym' => array( 'title' => array() ), 'code' => array(), 'pre' => array(), 'em' => array(), 'strong' => array(), 'div' => array( 'class' => array() ), 'span' => array( 'class' => array() ), 'p' => array(), 'br' => array(), 'ul' => array(), 'ol' => array(), 'li' => array(), 'h1' => array(), 'h2' => array(), 'h3' => array(), 'h4' => array(), 'h5' => array(), 'h6' => array(), 'img' => array( 'src' => array(), 'class' => array(), 'alt' => array(), ), 'blockquote' => array( 'cite' => true ), ); $plugins_section_titles = array( 'description' => _x( 'Description', 'Plugin installer section title' ), 'installation' => _x( 'Installation', 'Plugin installer section title' ), 'faq' => _x( 'FAQ', 'Plugin installer section title' ), 'screenshots' => _x( 'Screenshots', 'Plugin installer section title' ), 'changelog' => _x( 'Changelog', 'Plugin installer section title' ), 'reviews' => _x( 'Reviews', 'Plugin installer section title' ), 'other_notes' => _x( 'Other Notes', 'Plugin installer section title' ), ); foreach ( (array) $api->sections as $section_name => $content ) { $api->sections[ $section_name ] = wp_kses( $content, $plugins_allowedtags ); } foreach ( array( 'version', 'author', 'requires', 'tested', 'homepage', 'downloaded', 'slug' ) as $key ) { if ( isset( $api->$key ) ) { $api->$key = wp_kses( $api->$key, $plugins_allowedtags ); } } $_tab = esc_attr( $tab ); $section = isset( $_REQUEST['section'] ) ? wp_unslash( $_REQUEST['section'] ) : 'description'; if ( empty( $section ) || ! isset( $api->sections[ $section ] ) ) { $section_titles = array_keys( (array) $api->sections ); $section = reset( $section_titles ); } iframe_header( __( 'Plugin Installation' ) ); $_with_banner = ''; if ( ! empty( $api->banners ) && ( ! empty( $api->banners['low'] ) || ! empty( $api->banners['high'] ) ) ) { $_with_banner = 'with-banner'; $low = empty( $api->banners['low'] ) ? $api->banners['high'] : $api->banners['low']; $high = empty( $api->banners['high'] ) ? $api->banners['low'] : $api->banners['high']; ?>
		<style type="text/css">
			#plugin-information-title.with-banner {
				background-image: url( <?php echo esc_url( $low ); ?> );
			}
			@media only screen and ( -webkit-min-device-pixel-ratio: 1.5 ) {
				#plugin-information-title.with-banner {
					background-image: url( <?php echo esc_url( $high ); ?> );
				}
			}
		</style>
		<?php
 } echo '<div id="plugin-information-scrollable">'; echo "<div id='{$_tab}-title' class='{$_with_banner}'><div class='vignette'></div><h2>{$api->name}</h2></div>"; echo "<div id='{$_tab}-tabs' class='{$_with_banner}'>\n"; foreach ( (array) $api->sections as $section_name => $content ) { if ( 'reviews' === $section_name && ( empty( $api->ratings ) || 0 === array_sum( (array) $api->ratings ) ) ) { continue; } if ( isset( $plugins_section_titles[ $section_name ] ) ) { $title = $plugins_section_titles[ $section_name ]; } else { $title = ucwords( str_replace( '_', ' ', $section_name ) ); } $class = ( $section_name === $section ) ? ' class="current"' : ''; $href = add_query_arg( array( 'tab' => $tab, 'section' => $section_name, ) ); $href = esc_url( $href ); $san_section = esc_attr( $section_name ); echo "\t<a name='$san_section' href='$href' $class>$title</a>\n"; } echo "</div>\n"; ?>
<div id="<?php echo $_tab; ?>-content" class='<?php echo $_with_banner; ?>'>
	<div class="fyi">
		<ul>
			<?php if ( ! empty( $api->version ) ) { ?>
				<li><strong><?php _e( 'Version:' ); ?></strong> <?php echo $api->version; ?></li>
			<?php } if ( ! empty( $api->author ) ) { ?>
				<li><strong><?php _e( 'Author:' ); ?></strong> <?php echo links_add_target( $api->author, '_blank' ); ?></li>
			<?php } if ( ! empty( $api->last_updated ) ) { ?>
				<li><strong><?php _e( 'Last Updated:' ); ?></strong>
					<?php
 printf( __( '%s ago' ), human_time_diff( strtotime( $api->last_updated ) ) ); ?>
				</li>
			<?php } if ( ! empty( $api->requires ) ) { ?>
				<li>
					<strong><?php _e( 'Requires WordPress Version:' ); ?></strong>
					<?php
 printf( __( '%s or higher' ), $api->requires ); ?>
				</li>
			<?php } if ( ! empty( $api->tested ) ) { ?>
				<li><strong><?php _e( 'Compatible up to:' ); ?></strong> <?php echo $api->tested; ?></li>
			<?php } if ( ! empty( $api->requires_php ) ) { ?>
				<li>
					<strong><?php _e( 'Requires PHP Version:' ); ?></strong>
					<?php
 printf( __( '%s or higher' ), $api->requires_php ); ?>
				</li>
			<?php } if ( isset( $api->active_installs ) ) { ?>
				<li><strong><?php _e( 'Active Installations:' ); ?></strong>
				<?php
 if ( $api->active_installs >= 1000000 ) { $active_installs_millions = floor( $api->active_installs / 1000000 ); printf( _nx( '%s+ Million', '%s+ Million', $active_installs_millions, 'Active plugin installations' ), number_format_i18n( $active_installs_millions ) ); } elseif ( $api->active_installs < 10 ) { _ex( 'Less Than 10', 'Active plugin installations' ); } else { echo number_format_i18n( $api->active_installs ) . '+'; } ?>
				</li>
			<?php } if ( ! empty( $api->slug ) && empty( $api->external ) ) { ?>
				<li><a target="_blank" href="<?php echo esc_url( __( 'https://wordpress.org/plugins/' ) . $api->slug ); ?>/"><?php _e( 'WordPress.org Plugin Page &#187;' ); ?></a></li>
			<?php } if ( ! empty( $api->homepage ) ) { ?>
				<li><a target="_blank" href="<?php echo esc_url( $api->homepage ); ?>"><?php _e( 'Plugin Homepage &#187;' ); ?></a></li>
			<?php } if ( ! empty( $api->donate_link ) && empty( $api->contributors ) ) { ?>
				<li><a target="_blank" href="<?php echo esc_url( $api->donate_link ); ?>"><?php _e( 'Donate to this plugin &#187;' ); ?></a></li>
			<?php } ?>
		</ul>
		<?php if ( ! empty( $api->rating ) ) { ?>
			<h3><?php _e( 'Average Rating' ); ?></h3>
			<?php
 wp_star_rating( array( 'rating' => $api->rating, 'type' => 'percent', 'number' => $api->num_ratings, ) ); ?>
			<p aria-hidden="true" class="fyi-description">
				<?php
 printf( _n( '(based on %s rating)', '(based on %s ratings)', $api->num_ratings ), number_format_i18n( $api->num_ratings ) ); ?>
			</p>
			<?php
 } if ( ! empty( $api->ratings ) && array_sum( (array) $api->ratings ) > 0 ) { ?>
			<h3><?php _e( 'Reviews' ); ?></h3>
			<p class="fyi-description"><?php _e( 'Read all reviews on WordPress.org or write your own!' ); ?></p>
			<?php
 foreach ( $api->ratings as $key => $ratecount ) { $_rating = $api->num_ratings ? ( $ratecount / $api->num_ratings ) : 0; $aria_label = esc_attr( sprintf( _n( 'Reviews with %1$d star: %2$s. Opens in a new tab.', 'Reviews with %1$d stars: %2$s. Opens in a new tab.', $key ), $key, number_format_i18n( $ratecount ) ) ); ?>
				<div class="counter-container">
						<span class="counter-label">
							<?php
 printf( '<a href="%s" target="_blank" aria-label="%s">%s</a>', "https://wordpress.org/support/plugin/{$api->slug}/reviews/?filter={$key}", $aria_label, sprintf( _n( '%d star', '%d stars', $key ), $key ) ); ?>
						</span>
						<span class="counter-back">
							<span class="counter-bar" style="width: <?php echo 92 * $_rating; ?>px;"></span>
						</span>
					<span class="counter-count" aria-hidden="true"><?php echo number_format_i18n( $ratecount ); ?></span>
				</div>
				<?php
 } } if ( ! empty( $api->contributors ) ) { ?>
			<h3><?php _e( 'Contributors' ); ?></h3>
			<ul class="contributors">
				<?php
 foreach ( (array) $api->contributors as $contrib_username => $contrib_details ) { $contrib_name = $contrib_details['display_name']; if ( ! $contrib_name ) { $contrib_name = $contrib_username; } $contrib_name = esc_html( $contrib_name ); $contrib_profile = esc_url( $contrib_details['profile'] ); $contrib_avatar = esc_url( add_query_arg( 's', '36', $contrib_details['avatar'] ) ); echo "<li><a href='{$contrib_profile}' target='_blank'><img src='{$contrib_avatar}' width='18' height='18' alt='' />{$contrib_name}</a></li>"; } ?>
			</ul>
					<?php if ( ! empty( $api->donate_link ) ) { ?>
				<a target="_blank" href="<?php echo esc_url( $api->donate_link ); ?>"><?php _e( 'Donate to this plugin &#187;' ); ?></a>
			<?php } ?>
				<?php } ?>
	</div>
	<div id="section-holder">
	<?php
 $requires_php = isset( $api->requires_php ) ? $api->requires_php : null; $requires_wp = isset( $api->requires ) ? $api->requires : null; $compatible_php = is_php_version_compatible( $requires_php ); $compatible_wp = is_wp_version_compatible( $requires_wp ); $tested_wp = ( empty( $api->tested ) || version_compare( get_bloginfo( 'version' ), $api->tested, '<=' ) ); if ( ! $compatible_php ) { echo '<div class="notice notice-error notice-alt"><p>'; _e( '<strong>Error:</strong> This plugin <strong>requires a newer version of PHP</strong>.' ); if ( current_user_can( 'update_php' ) ) { printf( ' ' . __( '<a href="%s" target="_blank">Click here to learn more about updating PHP</a>.' ), esc_url( wp_get_update_php_url() ) ); wp_update_php_annotation( '</p><p><em>', '</em>' ); } else { echo '</p>'; } echo '</div>'; } if ( ! $tested_wp ) { echo '<div class="notice notice-warning notice-alt"><p>'; _e( '<strong>Warning:</strong> This plugin <strong>has not been tested</strong> with your current version of WordPress.' ); echo '</p></div>'; } elseif ( ! $compatible_wp ) { echo '<div class="notice notice-error notice-alt"><p>'; _e( '<strong>Error:</strong> This plugin <strong>requires a newer version of WordPress</strong>.' ); if ( current_user_can( 'update_core' ) ) { printf( ' ' . __( '<a href="%s" target="_parent">Click here to update WordPress</a>.' ), self_admin_url( 'update-core.php' ) ); } echo '</p></div>'; } foreach ( (array) $api->sections as $section_name => $content ) { $content = links_add_base_url( $content, 'https://wordpress.org/plugins/' . $api->slug . '/' ); $content = links_add_target( $content, '_blank' ); $san_section = esc_attr( $section_name ); $display = ( $section_name === $section ) ? 'block' : 'none'; echo "\t<div id='section-{$san_section}' class='section' style='display: {$display};'>\n"; echo $content; echo "\t</div>\n"; } echo "</div>\n"; echo "</div>\n"; echo "</div>\n"; echo "<div id='$tab-footer'>\n"; if ( ! empty( $api->download_link ) && ( current_user_can( 'install_plugins' ) || current_user_can( 'update_plugins' ) ) ) { $status = install_plugin_install_status( $api ); switch ( $status['status'] ) { case 'install': if ( $status['url'] ) { if ( $compatible_php && $compatible_wp ) { echo '<a data-slug="' . esc_attr( $api->slug ) . '" id="plugin_install_from_iframe" class="button button-primary right" href="' . $status['url'] . '" target="_parent">' . __( 'Install Now' ) . '</a>'; } else { printf( '<button type="button" class="button button-primary button-disabled right" disabled="disabled">%s</button>', _x( 'Cannot Install', 'plugin' ) ); } } break; case 'update_available': if ( $status['url'] ) { if ( $compatible_php ) { echo '<a data-slug="' . esc_attr( $api->slug ) . '" data-plugin="' . esc_attr( $status['file'] ) . '" id="plugin_update_from_iframe" class="button button-primary right" href="' . $status['url'] . '" target="_parent">' . __( 'Install Update Now' ) . '</a>'; } else { printf( '<button type="button" class="button button-primary button-disabled right" disabled="disabled">%s</button>', _x( 'Cannot Update', 'plugin' ) ); } } break; case 'newer_installed': echo '<a class="button button-primary right disabled">' . sprintf( __( 'Newer Version (%s) Installed' ), esc_html( $status['version'] ) ) . '</a>'; break; case 'latest_installed': echo '<a class="button button-primary right disabled">' . __( 'Latest Version Installed' ) . '</a>'; break; } } echo "</div>\n"; iframe_footer(); exit; } 