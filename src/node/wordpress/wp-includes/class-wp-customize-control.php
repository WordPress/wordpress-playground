<?php
 class WP_Customize_Control { protected static $instance_count = 0; public $instance_number; public $manager; public $id; public $settings; public $setting = 'default'; public $capability; public $priority = 10; public $section = ''; public $label = ''; public $description = ''; public $choices = array(); public $input_attrs = array(); public $allow_addition = false; public $json = array(); public $type = 'text'; public $active_callback = ''; public function __construct( $manager, $id, $args = array() ) { $keys = array_keys( get_object_vars( $this ) ); foreach ( $keys as $key ) { if ( isset( $args[ $key ] ) ) { $this->$key = $args[ $key ]; } } $this->manager = $manager; $this->id = $id; if ( empty( $this->active_callback ) ) { $this->active_callback = array( $this, 'active_callback' ); } self::$instance_count += 1; $this->instance_number = self::$instance_count; if ( ! isset( $this->settings ) ) { $this->settings = $id; } $settings = array(); if ( is_array( $this->settings ) ) { foreach ( $this->settings as $key => $setting ) { $settings[ $key ] = $this->manager->get_setting( $setting ); } } elseif ( is_string( $this->settings ) ) { $this->setting = $this->manager->get_setting( $this->settings ); $settings['default'] = $this->setting; } $this->settings = $settings; } public function enqueue() {} final public function active() { $control = $this; $active = call_user_func( $this->active_callback, $this ); $active = apply_filters( 'customize_control_active', $active, $control ); return $active; } public function active_callback() { return true; } final public function value( $setting_key = 'default' ) { if ( isset( $this->settings[ $setting_key ] ) ) { return $this->settings[ $setting_key ]->value(); } } public function to_json() { $this->json['settings'] = array(); foreach ( $this->settings as $key => $setting ) { $this->json['settings'][ $key ] = $setting->id; } $this->json['type'] = $this->type; $this->json['priority'] = $this->priority; $this->json['active'] = $this->active(); $this->json['section'] = $this->section; $this->json['content'] = $this->get_content(); $this->json['label'] = $this->label; $this->json['description'] = $this->description; $this->json['instanceNumber'] = $this->instance_number; if ( 'dropdown-pages' === $this->type ) { $this->json['allow_addition'] = $this->allow_addition; } } public function json() { $this->to_json(); return $this->json; } final public function check_capabilities() { if ( ! empty( $this->capability ) && ! current_user_can( $this->capability ) ) { return false; } foreach ( $this->settings as $setting ) { if ( ! $setting || ! $setting->check_capabilities() ) { return false; } } $section = $this->manager->get_section( $this->section ); if ( isset( $section ) && ! $section->check_capabilities() ) { return false; } return true; } final public function get_content() { ob_start(); $this->maybe_render(); return trim( ob_get_clean() ); } final public function maybe_render() { if ( ! $this->check_capabilities() ) { return; } do_action( 'customize_render_control', $this ); do_action( "customize_render_control_{$this->id}", $this ); $this->render(); } protected function render() { $id = 'customize-control-' . str_replace( array( '[', ']' ), array( '-', '' ), $this->id ); $class = 'customize-control customize-control-' . $this->type; printf( '<li id="%s" class="%s">', esc_attr( $id ), esc_attr( $class ) ); $this->render_content(); echo '</li>'; } public function get_link( $setting_key = 'default' ) { if ( isset( $this->settings[ $setting_key ] ) && $this->settings[ $setting_key ] instanceof WP_Customize_Setting ) { return 'data-customize-setting-link="' . esc_attr( $this->settings[ $setting_key ]->id ) . '"'; } else { return 'data-customize-setting-key-link="' . esc_attr( $setting_key ) . '"'; } } public function link( $setting_key = 'default' ) { echo $this->get_link( $setting_key ); } public function input_attrs() { foreach ( $this->input_attrs as $attr => $value ) { echo $attr . '="' . esc_attr( $value ) . '" '; } } protected function render_content() { $input_id = '_customize-input-' . $this->id; $description_id = '_customize-description-' . $this->id; $describedby_attr = ( ! empty( $this->description ) ) ? ' aria-describedby="' . esc_attr( $description_id ) . '" ' : ''; switch ( $this->type ) { case 'checkbox': ?>
				<span class="customize-inside-control-row">
					<input
						id="<?php echo esc_attr( $input_id ); ?>"
						<?php echo $describedby_attr; ?>
						type="checkbox"
						value="<?php echo esc_attr( $this->value() ); ?>"
						<?php $this->link(); ?>
						<?php checked( $this->value() ); ?>
					/>
					<label for="<?php echo esc_attr( $input_id ); ?>"><?php echo esc_html( $this->label ); ?></label>
					<?php if ( ! empty( $this->description ) ) : ?>
						<span id="<?php echo esc_attr( $description_id ); ?>" class="description customize-control-description"><?php echo $this->description; ?></span>
					<?php endif; ?>
				</span>
				<?php
 break; case 'radio': if ( empty( $this->choices ) ) { return; } $name = '_customize-radio-' . $this->id; ?>
				<?php if ( ! empty( $this->label ) ) : ?>
					<span class="customize-control-title"><?php echo esc_html( $this->label ); ?></span>
				<?php endif; ?>
				<?php if ( ! empty( $this->description ) ) : ?>
					<span id="<?php echo esc_attr( $description_id ); ?>" class="description customize-control-description"><?php echo $this->description; ?></span>
				<?php endif; ?>

				<?php foreach ( $this->choices as $value => $label ) : ?>
					<span class="customize-inside-control-row">
						<input
							id="<?php echo esc_attr( $input_id . '-radio-' . $value ); ?>"
							type="radio"
							<?php echo $describedby_attr; ?>
							value="<?php echo esc_attr( $value ); ?>"
							name="<?php echo esc_attr( $name ); ?>"
							<?php $this->link(); ?>
							<?php checked( $this->value(), $value ); ?>
							/>
						<label for="<?php echo esc_attr( $input_id . '-radio-' . $value ); ?>"><?php echo esc_html( $label ); ?></label>
					</span>
				<?php endforeach; ?>
				<?php
 break; case 'select': if ( empty( $this->choices ) ) { return; } ?>
				<?php if ( ! empty( $this->label ) ) : ?>
					<label for="<?php echo esc_attr( $input_id ); ?>" class="customize-control-title"><?php echo esc_html( $this->label ); ?></label>
				<?php endif; ?>
				<?php if ( ! empty( $this->description ) ) : ?>
					<span id="<?php echo esc_attr( $description_id ); ?>" class="description customize-control-description"><?php echo $this->description; ?></span>
				<?php endif; ?>

				<select id="<?php echo esc_attr( $input_id ); ?>" <?php echo $describedby_attr; ?> <?php $this->link(); ?>>
					<?php
 foreach ( $this->choices as $value => $label ) { echo '<option value="' . esc_attr( $value ) . '"' . selected( $this->value(), $value, false ) . '>' . $label . '</option>'; } ?>
				</select>
				<?php
 break; case 'textarea': ?>
				<?php if ( ! empty( $this->label ) ) : ?>
					<label for="<?php echo esc_attr( $input_id ); ?>" class="customize-control-title"><?php echo esc_html( $this->label ); ?></label>
				<?php endif; ?>
				<?php if ( ! empty( $this->description ) ) : ?>
					<span id="<?php echo esc_attr( $description_id ); ?>" class="description customize-control-description"><?php echo $this->description; ?></span>
				<?php endif; ?>
				<textarea
					id="<?php echo esc_attr( $input_id ); ?>"
					rows="5"
					<?php echo $describedby_attr; ?>
					<?php $this->input_attrs(); ?>
					<?php $this->link(); ?>
				><?php echo esc_textarea( $this->value() ); ?></textarea>
				<?php
 break; case 'dropdown-pages': ?>
				<?php if ( ! empty( $this->label ) ) : ?>
					<label for="<?php echo esc_attr( $input_id ); ?>" class="customize-control-title"><?php echo esc_html( $this->label ); ?></label>
				<?php endif; ?>
				<?php if ( ! empty( $this->description ) ) : ?>
					<span id="<?php echo esc_attr( $description_id ); ?>" class="description customize-control-description"><?php echo $this->description; ?></span>
				<?php endif; ?>

				<?php
 $dropdown_name = '_customize-dropdown-pages-' . $this->id; $show_option_none = __( '&mdash; Select &mdash;' ); $option_none_value = '0'; $dropdown = wp_dropdown_pages( array( 'name' => $dropdown_name, 'echo' => 0, 'show_option_none' => $show_option_none, 'option_none_value' => $option_none_value, 'selected' => $this->value(), ) ); if ( empty( $dropdown ) ) { $dropdown = sprintf( '<select id="%1$s" name="%1$s">', esc_attr( $dropdown_name ) ); $dropdown .= sprintf( '<option value="%1$s">%2$s</option>', esc_attr( $option_none_value ), esc_html( $show_option_none ) ); $dropdown .= '</select>'; } $dropdown = str_replace( '<select', '<select ' . $this->get_link() . ' id="' . esc_attr( $input_id ) . '" ' . $describedby_attr, $dropdown ); $nav_menus_created_posts_setting = $this->manager->get_setting( 'nav_menus_created_posts' ); if ( $nav_menus_created_posts_setting && current_user_can( 'publish_pages' ) ) { $auto_draft_page_options = ''; foreach ( $nav_menus_created_posts_setting->value() as $auto_draft_page_id ) { $post = get_post( $auto_draft_page_id ); if ( $post && 'page' === $post->post_type ) { $auto_draft_page_options .= sprintf( '<option value="%1$s">%2$s</option>', esc_attr( $post->ID ), esc_html( $post->post_title ) ); } } if ( $auto_draft_page_options ) { $dropdown = str_replace( '</select>', $auto_draft_page_options . '</select>', $dropdown ); } } echo $dropdown; ?>
				<?php if ( $this->allow_addition && current_user_can( 'publish_pages' ) && current_user_can( 'edit_theme_options' ) ) : ?>
					<button type="button" class="button-link add-new-toggle">
						<?php
 printf( __( '+ %s' ), get_post_type_object( 'page' )->labels->add_new_item ); ?>
					</button>
					<div class="new-content-item">
						<label for="create-input-<?php echo esc_attr( $this->id ); ?>"><span class="screen-reader-text"><?php _e( 'New page title' ); ?></span></label>
						<input type="text" id="create-input-<?php echo esc_attr( $this->id ); ?>" class="create-item-input" placeholder="<?php esc_attr_e( 'New page title&hellip;' ); ?>">
						<button type="button" class="button add-content"><?php _e( 'Add' ); ?></button>
					</div>
				<?php endif; ?>
				<?php
 break; default: ?>
				<?php if ( ! empty( $this->label ) ) : ?>
					<label for="<?php echo esc_attr( $input_id ); ?>" class="customize-control-title"><?php echo esc_html( $this->label ); ?></label>
				<?php endif; ?>
				<?php if ( ! empty( $this->description ) ) : ?>
					<span id="<?php echo esc_attr( $description_id ); ?>" class="description customize-control-description"><?php echo $this->description; ?></span>
				<?php endif; ?>
				<input
					id="<?php echo esc_attr( $input_id ); ?>"
					type="<?php echo esc_attr( $this->type ); ?>"
					<?php echo $describedby_attr; ?>
					<?php $this->input_attrs(); ?>
					<?php if ( ! isset( $this->input_attrs['value'] ) ) : ?>
						value="<?php echo esc_attr( $this->value() ); ?>"
					<?php endif; ?>
					<?php $this->link(); ?>
					/>
				<?php
 break; } } final public function print_template() { ?>
		<script type="text/html" id="tmpl-customize-control-<?php echo esc_attr( $this->type ); ?>-content">
			<?php $this->content_template(); ?>
		</script>
		<?php
 } protected function content_template() {} } require_once ABSPATH . WPINC . '/customize/class-wp-customize-color-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-media-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-upload-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-image-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-background-image-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-background-position-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-cropped-image-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-site-icon-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-header-image-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-theme-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-widget-area-customize-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-widget-form-customize-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-nav-menu-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-nav-menu-item-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-nav-menu-location-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-nav-menu-name-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-nav-menu-locations-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-nav-menu-auto-add-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-customize-date-time-control.php'; require_once ABSPATH . WPINC . '/customize/class-wp-sidebar-block-editor-control.php'; 