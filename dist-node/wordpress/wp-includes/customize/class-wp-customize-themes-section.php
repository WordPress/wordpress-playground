<?php
 class WP_Customize_Themes_Section extends WP_Customize_Section { public $type = 'themes'; public $action = ''; public $filter_type = 'local'; public function json() { $exported = parent::json(); $exported['action'] = $this->action; $exported['filter_type'] = $this->filter_type; return $exported; } protected function render_template() { ?>
		<li id="accordion-section-{{ data.id }}" class="theme-section">
			<button type="button" class="customize-themes-section-title themes-section-{{ data.id }}">{{ data.title }}</button>
			<?php if ( current_user_can( 'install_themes' ) || is_multisite() ) : ?>
			<?php endif; ?>
			<div class="customize-themes-section themes-section-{{ data.id }} control-section-content themes-php">
				<div class="theme-overlay" tabindex="0" role="dialog" aria-label="<?php esc_attr_e( 'Theme Details' ); ?>"></div>
				<div class="theme-browser rendered">
					<div class="customize-preview-header themes-filter-bar">
						<?php $this->filter_bar_content_template(); ?>
					</div>
					<?php $this->filter_drawer_content_template(); ?>
					<div class="error unexpected-error" style="display: none; ">
						<p>
							<?php
 printf( __( 'An unexpected error occurred. Something may be wrong with WordPress.org or this server&#8217;s configuration. If you continue to have problems, please try the <a href="%s">support forums</a>.' ), __( 'https://wordpress.org/support/forums/' ) ); ?>
						</p>
					</div>
					<ul class="themes">
					</ul>
					<p class="no-themes"><?php _e( 'No themes found. Try a different search.' ); ?></p>
					<p class="no-themes-local">
						<?php
 printf( __( 'No themes found. Try a different search, or %s.' ), sprintf( '<button type="button" class="button-link search-dotorg-themes">%s</button>', __( 'Search WordPress.org themes' ) ) ); ?>
					</p>
					<p class="spinner"></p>
				</div>
			</div>
		</li>
		<?php
 } protected function filter_bar_content_template() { ?>
		<button type="button" class="button button-primary customize-section-back customize-themes-mobile-back"><?php _e( 'Go to theme sources' ); ?></button>
		<# if ( 'wporg' === data.action ) { #>
			<div class="search-form">
				<label for="wp-filter-search-input-{{ data.id }}" class="screen-reader-text"><?php _e( 'Search themes&hellip;' ); ?></label>
				<input type="search" id="wp-filter-search-input-{{ data.id }}" placeholder="<?php esc_attr_e( 'Search themes&hellip;' ); ?>" aria-describedby="{{ data.id }}-live-search-desc" class="wp-filter-search">
				<div class="search-icon" aria-hidden="true"></div>
				<span id="{{ data.id }}-live-search-desc" class="screen-reader-text"><?php _e( 'The search results will be updated as you type.' ); ?></span>
			</div>
			<button type="button" class="button feature-filter-toggle">
				<span class="filter-count-0"><?php _e( 'Filter themes' ); ?></span><span class="filter-count-filters">
				<?php
 printf( __( 'Filter themes (%s)' ), '<span class="theme-filter-count">0</span>' ); ?>
				</span>
			</button>
		<# } else { #>
			<div class="themes-filter-container">
				<label for="{{ data.id }}-themes-filter" class="screen-reader-text"><?php _e( 'Search themes&hellip;' ); ?></label>
				<input type="search" id="{{ data.id }}-themes-filter" placeholder="<?php esc_attr_e( 'Search themes&hellip;' ); ?>" aria-describedby="{{ data.id }}-live-search-desc" class="wp-filter-search wp-filter-search-themes" />
				<div class="search-icon" aria-hidden="true"></div>
				<span id="{{ data.id }}-live-search-desc" class="screen-reader-text"><?php _e( 'The search results will be updated as you type.' ); ?></span>
			</div>
		<# } #>
		<div class="filter-themes-count">
			<span class="themes-displayed">
				<?php
 printf( __( '%s themes' ), '<span class="theme-count">0</span>' ); ?>
			</span>
		</div>
		<?php
 } protected function filter_drawer_content_template() { $feature_list = get_theme_feature_list( false ); ?>
		<# if ( 'wporg' === data.action ) { #>
			<div class="filter-drawer filter-details">
				<?php foreach ( $feature_list as $feature_name => $features ) : ?>
					<fieldset class="filter-group">
						<legend><?php echo esc_html( $feature_name ); ?></legend>
						<div class="filter-group-feature">
							<?php foreach ( $features as $feature => $feature_name ) : ?>
								<input type="checkbox" id="filter-id-<?php echo esc_attr( $feature ); ?>" value="<?php echo esc_attr( $feature ); ?>" />
								<label for="filter-id-<?php echo esc_attr( $feature ); ?>"><?php echo esc_html( $feature_name ); ?></label>
							<?php endforeach; ?>
						</div>
					</fieldset>
				<?php endforeach; ?>
			</div>
		<# } #>
		<?php
 } } 