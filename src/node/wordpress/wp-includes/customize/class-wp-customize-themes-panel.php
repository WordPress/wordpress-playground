<?php
 class WP_Customize_Themes_Panel extends WP_Customize_Panel { public $type = 'themes'; protected function render_template() { ?>
		<li id="accordion-section-{{ data.id }}" class="accordion-section control-panel-themes">
			<h3 class="accordion-section-title">
				<?php
 if ( $this->manager->is_theme_active() ) { echo '<span class="customize-action">' . __( 'Active theme' ) . '</span> {{ data.title }}'; } else { echo '<span class="customize-action">' . __( 'Previewing theme' ) . '</span> {{ data.title }}'; } ?>

				<?php if ( current_user_can( 'switch_themes' ) ) : ?>
					<button type="button" class="button change-theme" aria-label="<?php esc_attr_e( 'Change theme' ); ?>"><?php _ex( 'Change', 'theme' ); ?></button>
				<?php endif; ?>
			</h3>
			<ul class="accordion-sub-container control-panel-content"></ul>
		</li>
		<?php
 } protected function content_template() { ?>
		<li class="panel-meta customize-info accordion-section <# if ( ! data.description ) { #> cannot-expand<# } #>">
			<button class="customize-panel-back" tabindex="-1" type="button"><span class="screen-reader-text"><?php _e( 'Back' ); ?></span></button>
			<div class="accordion-section-title">
				<span class="preview-notice">
					<?php
 printf( __( 'You are browsing %s' ), '<strong class="panel-title">' . __( 'Themes' ) . '</strong>' ); ?>
				</span>
				<?php if ( current_user_can( 'install_themes' ) && ! is_multisite() ) : ?>
					<# if ( data.description ) { #>
						<button class="customize-help-toggle dashicons dashicons-editor-help" type="button" aria-expanded="false"><span class="screen-reader-text"><?php _e( 'Help' ); ?></span></button>
					<# } #>
				<?php endif; ?>
			</div>
			<?php if ( current_user_can( 'install_themes' ) && ! is_multisite() ) : ?>
				<# if ( data.description ) { #>
					<div class="description customize-panel-description">
						{{{ data.description }}}
					</div>
				<# } #>
			<?php endif; ?>

			<div class="customize-control-notifications-container"></div>
		</li>
		<li class="customize-themes-full-container-container">
			<div class="customize-themes-full-container">
				<div class="customize-themes-notifications"></div>
			</div>
		</li>
		<?php
 } } 