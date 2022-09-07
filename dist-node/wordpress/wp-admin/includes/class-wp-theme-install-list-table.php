<?php
 class WP_Theme_Install_List_Table extends WP_Themes_List_Table { public $features = array(); public function ajax_user_can() { return current_user_can( 'install_themes' ); } public function prepare_items() { require ABSPATH . 'wp-admin/includes/theme-install.php'; global $tabs, $tab, $paged, $type, $theme_field_defaults; wp_reset_vars( array( 'tab' ) ); $search_terms = array(); $search_string = ''; if ( ! empty( $_REQUEST['s'] ) ) { $search_string = strtolower( wp_unslash( $_REQUEST['s'] ) ); $search_terms = array_unique( array_filter( array_map( 'trim', explode( ',', $search_string ) ) ) ); } if ( ! empty( $_REQUEST['features'] ) ) { $this->features = $_REQUEST['features']; } $paged = $this->get_pagenum(); $per_page = 36; $tabs = array(); $tabs['dashboard'] = __( 'Search' ); if ( 'search' === $tab ) { $tabs['search'] = __( 'Search Results' ); } $tabs['upload'] = __( 'Upload' ); $tabs['featured'] = _x( 'Featured', 'themes' ); $tabs['new'] = _x( 'Latest', 'themes' ); $tabs['updated'] = _x( 'Recently Updated', 'themes' ); $nonmenu_tabs = array( 'theme-information' ); $tabs = apply_filters( 'install_themes_tabs', $tabs ); $nonmenu_tabs = apply_filters( 'install_themes_nonmenu_tabs', $nonmenu_tabs ); if ( empty( $tab ) || ( ! isset( $tabs[ $tab ] ) && ! in_array( $tab, (array) $nonmenu_tabs, true ) ) ) { $tab = key( $tabs ); } $args = array( 'page' => $paged, 'per_page' => $per_page, 'fields' => $theme_field_defaults, ); switch ( $tab ) { case 'search': $type = isset( $_REQUEST['type'] ) ? wp_unslash( $_REQUEST['type'] ) : 'term'; switch ( $type ) { case 'tag': $args['tag'] = array_map( 'sanitize_key', $search_terms ); break; case 'term': $args['search'] = $search_string; break; case 'author': $args['author'] = $search_string; break; } if ( ! empty( $this->features ) ) { $args['tag'] = $this->features; $_REQUEST['s'] = implode( ',', $this->features ); $_REQUEST['type'] = 'tag'; } add_action( 'install_themes_table_header', 'install_theme_search_form', 10, 0 ); break; case 'featured': case 'new': case 'updated': $args['browse'] = $tab; break; default: $args = false; break; } $args = apply_filters( "install_themes_table_api_args_{$tab}", $args ); if ( ! $args ) { return; } $api = themes_api( 'query_themes', $args ); if ( is_wp_error( $api ) ) { wp_die( '<p>' . $api->get_error_message() . '</p> <p><a href="#" onclick="document.location.reload(); return false;">' . __( 'Try Again' ) . '</a></p>' ); } $this->items = $api->themes; $this->set_pagination_args( array( 'total_items' => $api->info['results'], 'per_page' => $args['per_page'], 'infinite_scroll' => true, ) ); } public function no_items() { _e( 'No themes match your request.' ); } protected function get_views() { global $tabs, $tab; $display_tabs = array(); foreach ( (array) $tabs as $action => $text ) { $current_link_attributes = ( $action === $tab ) ? ' class="current" aria-current="page"' : ''; $href = self_admin_url( 'theme-install.php?tab=' . $action ); $display_tabs[ 'theme-install-' . $action ] = "<a href='$href'$current_link_attributes>$text</a>"; } return $display_tabs; } public function display() { wp_nonce_field( 'fetch-list-' . get_class( $this ), '_ajax_fetch_list_nonce' ); ?>
		<div class="tablenav top themes">
			<div class="alignleft actions">
				<?php
 do_action( 'install_themes_table_header' ); ?>
			</div>
			<?php $this->pagination( 'top' ); ?>
			<br class="clear" />
		</div>

		<div id="availablethemes">
			<?php $this->display_rows_or_placeholder(); ?>
		</div>

		<?php
 $this->tablenav( 'bottom' ); } public function display_rows() { $themes = $this->items; foreach ( $themes as $theme ) { ?>
				<div class="available-theme installable-theme">
				<?php
 $this->single_row( $theme ); ?>
				</div>
			<?php
 } $this->theme_installer(); } public function single_row( $theme ) { global $themes_allowedtags; if ( empty( $theme ) ) { return; } $name = wp_kses( $theme->name, $themes_allowedtags ); $author = wp_kses( $theme->author, $themes_allowedtags ); $preview_title = sprintf( __( 'Preview &#8220;%s&#8221;' ), $name ); $preview_url = add_query_arg( array( 'tab' => 'theme-information', 'theme' => $theme->slug, ), self_admin_url( 'theme-install.php' ) ); $actions = array(); $install_url = add_query_arg( array( 'action' => 'install-theme', 'theme' => $theme->slug, ), self_admin_url( 'update.php' ) ); $update_url = add_query_arg( array( 'action' => 'upgrade-theme', 'theme' => $theme->slug, ), self_admin_url( 'update.php' ) ); $status = $this->_get_theme_status( $theme ); switch ( $status ) { case 'update_available': $actions[] = sprintf( '<a class="install-now" href="%s" title="%s">%s</a>', esc_url( wp_nonce_url( $update_url, 'upgrade-theme_' . $theme->slug ) ), esc_attr( sprintf( __( 'Update to version %s' ), $theme->version ) ), __( 'Update' ) ); break; case 'newer_installed': case 'latest_installed': $actions[] = sprintf( '<span class="install-now" title="%s">%s</span>', esc_attr__( 'This theme is already installed and is up to date' ), _x( 'Installed', 'theme' ) ); break; case 'install': default: $actions[] = sprintf( '<a class="install-now" href="%s" title="%s">%s</a>', esc_url( wp_nonce_url( $install_url, 'install-theme_' . $theme->slug ) ), esc_attr( sprintf( _x( 'Install %s', 'theme' ), $name ) ), __( 'Install Now' ) ); break; } $actions[] = sprintf( '<a class="install-theme-preview" href="%s" title="%s">%s</a>', esc_url( $preview_url ), esc_attr( sprintf( __( 'Preview %s' ), $name ) ), __( 'Preview' ) ); $actions = apply_filters( 'theme_install_actions', $actions, $theme ); ?>
		<a class="screenshot install-theme-preview" href="<?php echo esc_url( $preview_url ); ?>" title="<?php echo esc_attr( $preview_title ); ?>">
			<img src="<?php echo esc_url( $theme->screenshot_url . '?ver=' . $theme->version ); ?>" width="150" alt="" />
		</a>

		<h3><?php echo $name; ?></h3>
		<div class="theme-author">
		<?php
 printf( __( 'By %s' ), $author ); ?>
		</div>

		<div class="action-links">
			<ul>
				<?php foreach ( $actions as $action ) : ?>
					<li><?php echo $action; ?></li>
				<?php endforeach; ?>
				<li class="hide-if-no-js"><a href="#" class="theme-detail"><?php _e( 'Details' ); ?></a></li>
			</ul>
		</div>

		<?php
 $this->install_theme_info( $theme ); } public function theme_installer() { ?>
		<div id="theme-installer" class="wp-full-overlay expanded">
			<div class="wp-full-overlay-sidebar">
				<div class="wp-full-overlay-header">
					<a href="#" class="close-full-overlay button"><?php _e( 'Close' ); ?></a>
					<span class="theme-install"></span>
				</div>
				<div class="wp-full-overlay-sidebar-content">
					<div class="install-theme-info"></div>
				</div>
				<div class="wp-full-overlay-footer">
					<button type="button" class="collapse-sidebar button" aria-expanded="true" aria-label="<?php esc_attr_e( 'Collapse Sidebar' ); ?>">
						<span class="collapse-sidebar-arrow"></span>
						<span class="collapse-sidebar-label"><?php _e( 'Collapse' ); ?></span>
					</button>
				</div>
			</div>
			<div class="wp-full-overlay-main"></div>
		</div>
		<?php
 } public function theme_installer_single( $theme ) { ?>
		<div id="theme-installer" class="wp-full-overlay single-theme">
			<div class="wp-full-overlay-sidebar">
				<?php $this->install_theme_info( $theme ); ?>
			</div>
			<div class="wp-full-overlay-main">
				<iframe src="<?php echo esc_url( $theme->preview_url ); ?>"></iframe>
			</div>
		</div>
		<?php
 } public function install_theme_info( $theme ) { global $themes_allowedtags; if ( empty( $theme ) ) { return; } $name = wp_kses( $theme->name, $themes_allowedtags ); $author = wp_kses( $theme->author, $themes_allowedtags ); $install_url = add_query_arg( array( 'action' => 'install-theme', 'theme' => $theme->slug, ), self_admin_url( 'update.php' ) ); $update_url = add_query_arg( array( 'action' => 'upgrade-theme', 'theme' => $theme->slug, ), self_admin_url( 'update.php' ) ); $status = $this->_get_theme_status( $theme ); ?>
		<div class="install-theme-info">
		<?php
 switch ( $status ) { case 'update_available': printf( '<a class="theme-install button button-primary" href="%s" title="%s">%s</a>', esc_url( wp_nonce_url( $update_url, 'upgrade-theme_' . $theme->slug ) ), esc_attr( sprintf( __( 'Update to version %s' ), $theme->version ) ), __( 'Update' ) ); break; case 'newer_installed': case 'latest_installed': printf( '<span class="theme-install" title="%s">%s</span>', esc_attr__( 'This theme is already installed and is up to date' ), _x( 'Installed', 'theme' ) ); break; case 'install': default: printf( '<a class="theme-install button button-primary" href="%s">%s</a>', esc_url( wp_nonce_url( $install_url, 'install-theme_' . $theme->slug ) ), __( 'Install' ) ); break; } ?>
			<h3 class="theme-name"><?php echo $name; ?></h3>
			<span class="theme-by">
			<?php
 printf( __( 'By %s' ), $author ); ?>
			</span>
			<?php if ( isset( $theme->screenshot_url ) ) : ?>
				<img class="theme-screenshot" src="<?php echo esc_url( $theme->screenshot_url . '?ver=' . $theme->version ); ?>" alt="" />
			<?php endif; ?>
			<div class="theme-details">
				<?php
 wp_star_rating( array( 'rating' => $theme->rating, 'type' => 'percent', 'number' => $theme->num_ratings, ) ); ?>
				<div class="theme-version">
					<strong><?php _e( 'Version:' ); ?> </strong>
					<?php echo wp_kses( $theme->version, $themes_allowedtags ); ?>
				</div>
				<div class="theme-description">
					<?php echo wp_kses( $theme->description, $themes_allowedtags ); ?>
				</div>
			</div>
			<input class="theme-preview-url" type="hidden" value="<?php echo esc_url( $theme->preview_url ); ?>" />
		</div>
		<?php
 } public function _js_vars( $extra_args = array() ) { global $tab, $type; parent::_js_vars( compact( 'tab', 'type' ) ); } private function _get_theme_status( $theme ) { $status = 'install'; $installed_theme = wp_get_theme( $theme->slug ); if ( $installed_theme->exists() ) { if ( version_compare( $installed_theme->get( 'Version' ), $theme->version, '=' ) ) { $status = 'latest_installed'; } elseif ( version_compare( $installed_theme->get( 'Version' ), $theme->version, '>' ) ) { $status = 'newer_installed'; } else { $status = 'update_available'; } } return $status; } } 