<?php
 class WP_Customize_Nav_Menu_Auto_Add_Control extends WP_Customize_Control { public $type = 'nav_menu_auto_add'; protected function render_content() {} protected function content_template() { ?>
		<# var elementId = _.uniqueId( 'customize-nav-menu-auto-add-control-' ); #>
		<span class="customize-control-title"><?php _e( 'Menu Options' ); ?></span>
		<span class="customize-inside-control-row">
			<input id="{{ elementId }}" type="checkbox" class="auto_add" />
			<label for="{{ elementId }}">
				<?php _e( 'Automatically add new top-level pages to this menu' ); ?>
			</label>
		</span>
		<?php
 } } 