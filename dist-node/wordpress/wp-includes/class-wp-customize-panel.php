<?php
 class WP_Customize_Panel { protected static $instance_count = 0; public $instance_number; public $manager; public $id; public $priority = 160; public $capability = 'edit_theme_options'; public $theme_supports = ''; public $title = ''; public $description = ''; public $auto_expand_sole_section = false; public $sections; public $type = 'default'; public $active_callback = ''; public function __construct( $manager, $id, $args = array() ) { $keys = array_keys( get_object_vars( $this ) ); foreach ( $keys as $key ) { if ( isset( $args[ $key ] ) ) { $this->$key = $args[ $key ]; } } $this->manager = $manager; $this->id = $id; if ( empty( $this->active_callback ) ) { $this->active_callback = array( $this, 'active_callback' ); } self::$instance_count += 1; $this->instance_number = self::$instance_count; $this->sections = array(); } final public function active() { $panel = $this; $active = call_user_func( $this->active_callback, $this ); $active = apply_filters( 'customize_panel_active', $active, $panel ); return $active; } public function active_callback() { return true; } public function json() { $array = wp_array_slice_assoc( (array) $this, array( 'id', 'description', 'priority', 'type' ) ); $array['title'] = html_entity_decode( $this->title, ENT_QUOTES, get_bloginfo( 'charset' ) ); $array['content'] = $this->get_content(); $array['active'] = $this->active(); $array['instanceNumber'] = $this->instance_number; $array['autoExpandSoleSection'] = $this->auto_expand_sole_section; return $array; } public function check_capabilities() { if ( $this->capability && ! current_user_can( $this->capability ) ) { return false; } if ( $this->theme_supports && ! current_theme_supports( ... (array) $this->theme_supports ) ) { return false; } return true; } final public function get_content() { ob_start(); $this->maybe_render(); return trim( ob_get_clean() ); } final public function maybe_render() { if ( ! $this->check_capabilities() ) { return; } do_action( 'customize_render_panel', $this ); do_action( "customize_render_panel_{$this->id}" ); $this->render(); } protected function render() {} protected function render_content() {} public function print_template() { ?>
		<script type="text/html" id="tmpl-customize-panel-<?php echo esc_attr( $this->type ); ?>-content">
			<?php $this->content_template(); ?>
		</script>
		<script type="text/html" id="tmpl-customize-panel-<?php echo esc_attr( $this->type ); ?>">
			<?php $this->render_template(); ?>
		</script>
		<?php
 } protected function render_template() { ?>
		<li id="accordion-panel-{{ data.id }}" class="accordion-section control-section control-panel control-panel-{{ data.type }}">
			<h3 class="accordion-section-title" tabindex="0">
				{{ data.title }}
				<span class="screen-reader-text"><?php _e( 'Press return or enter to open this panel' ); ?></span>
			</h3>
			<ul class="accordion-sub-container control-panel-content"></ul>
		</li>
		<?php
 } protected function content_template() { ?>
		<li class="panel-meta customize-info accordion-section <# if ( ! data.description ) { #> cannot-expand<# } #>">
			<button class="customize-panel-back" tabindex="-1"><span class="screen-reader-text"><?php _e( 'Back' ); ?></span></button>
			<div class="accordion-section-title">
				<span class="preview-notice">
				<?php
 printf( __( 'You are customizing %s' ), '<strong class="panel-title">{{ data.title }}</strong>' ); ?>
				</span>
				<# if ( data.description ) { #>
					<button type="button" class="customize-help-toggle dashicons dashicons-editor-help" aria-expanded="false"><span class="screen-reader-text"><?php _e( 'Help' ); ?></span></button>
				<# } #>
			</div>
			<# if ( data.description ) { #>
				<div class="description customize-panel-description">
					{{{ data.description }}}
				</div>
			<# } #>

			<div class="customize-control-notifications-container"></div>
		</li>
		<?php
 } } require_once ABSPATH . WPINC . '/customize/class-wp-customize-nav-menus-panel.php'; 