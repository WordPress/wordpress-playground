<?php
 _deprecated_file( basename( __FILE__ ), '4.9.0' ); class WP_Customize_New_Menu_Control extends WP_Customize_Control { public $type = 'new_menu'; public function __construct( WP_Customize_Manager $manager, $id, array $args = array() ) { _deprecated_function( __METHOD__, '4.9.0' ); parent::__construct( $manager, $id, $args ); } public function render_content() { _deprecated_function( __METHOD__, '4.9.0' ); ?>
		<button type="button" class="button button-primary" id="create-new-menu-submit"><?php _e( 'Create Menu' ); ?></button>
		<span class="spinner"></span>
		<?php
 } } 