<?php
 class WP_Widget_Text extends WP_Widget { protected $registered = false; public function __construct() { $widget_ops = array( 'classname' => 'widget_text', 'description' => __( 'Arbitrary text.' ), 'customize_selective_refresh' => true, 'show_instance_in_rest' => true, ); $control_ops = array( 'width' => 400, 'height' => 350, ); parent::__construct( 'text', __( 'Text' ), $widget_ops, $control_ops ); } public function _register_one( $number = -1 ) { parent::_register_one( $number ); if ( $this->registered ) { return; } $this->registered = true; wp_add_inline_script( 'text-widgets', sprintf( 'wp.textWidgets.idBases.push( %s );', wp_json_encode( $this->id_base ) ) ); if ( $this->is_preview() ) { add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_preview_scripts' ) ); } add_action( 'admin_print_scripts-widgets.php', array( $this, 'enqueue_admin_scripts' ) ); add_action( 'admin_footer-widgets.php', array( 'WP_Widget_Text', 'render_control_template_scripts' ) ); } public function is_legacy_instance( $instance ) { if ( isset( $instance['visual'] ) ) { return ! $instance['visual']; } if ( isset( $instance['filter'] ) && 'content' === $instance['filter'] ) { return false; } if ( empty( $instance['text'] ) ) { return false; } $wpautop = ! empty( $instance['filter'] ); $has_line_breaks = ( false !== strpos( trim( $instance['text'] ), "\n" ) ); if ( ! $wpautop && $has_line_breaks ) { return true; } if ( false !== strpos( $instance['text'], '<!--' ) ) { return true; } if ( ! class_exists( 'DOMDocument' ) ) { return true; } $doc = new DOMDocument(); $errors = libxml_use_internal_errors( true ); @$doc->loadHTML( sprintf( '<!DOCTYPE html><html><head><meta charset="%s"></head><body>%s</body></html>', esc_attr( get_bloginfo( 'charset' ) ), $instance['text'] ) ); libxml_use_internal_errors( $errors ); $body = $doc->getElementsByTagName( 'body' )->item( 0 ); $safe_elements_attributes = array( 'strong' => array(), 'em' => array(), 'b' => array(), 'i' => array(), 'u' => array(), 's' => array(), 'ul' => array(), 'ol' => array(), 'li' => array(), 'hr' => array(), 'abbr' => array(), 'acronym' => array(), 'code' => array(), 'dfn' => array(), 'a' => array( 'href' => true, ), 'img' => array( 'src' => true, 'alt' => true, ), ); $safe_empty_elements = array( 'img', 'hr', 'iframe' ); foreach ( $body->getElementsByTagName( '*' ) as $element ) { $tag_name = strtolower( $element->nodeName ); if ( ! isset( $safe_elements_attributes[ $tag_name ] ) ) { return true; } if ( ! in_array( $tag_name, $safe_empty_elements, true ) && '' === trim( $element->textContent ) ) { return true; } foreach ( $element->attributes as $attribute ) { $attribute_name = strtolower( $attribute->nodeName ); if ( ! isset( $safe_elements_attributes[ $tag_name ][ $attribute_name ] ) ) { return true; } } } return false; } public function _filter_gallery_shortcode_attrs( $attrs ) { if ( ! is_singular() && empty( $attrs['id'] ) && empty( $attrs['include'] ) ) { $attrs['id'] = -1; } return $attrs; } public function widget( $args, $instance ) { global $post; $title = ! empty( $instance['title'] ) ? $instance['title'] : ''; $title = apply_filters( 'widget_title', $title, $instance, $this->id_base ); $text = ! empty( $instance['text'] ) ? $instance['text'] : ''; $is_visual_text_widget = ( ! empty( $instance['visual'] ) && ! empty( $instance['filter'] ) ); if ( ! $is_visual_text_widget ) { $is_visual_text_widget = ( isset( $instance['filter'] ) && 'content' === $instance['filter'] ); } if ( $is_visual_text_widget ) { $instance['filter'] = true; $instance['visual'] = true; } $widget_text_do_shortcode_priority = has_filter( 'widget_text', 'do_shortcode' ); $should_suspend_legacy_shortcode_support = ( $is_visual_text_widget && false !== $widget_text_do_shortcode_priority ); if ( $should_suspend_legacy_shortcode_support ) { remove_filter( 'widget_text', 'do_shortcode', $widget_text_do_shortcode_priority ); } $original_post = $post; if ( is_singular() ) { $post = get_queried_object(); } else { $post = null; } add_filter( 'shortcode_atts_gallery', array( $this, '_filter_gallery_shortcode_attrs' ) ); $text = apply_filters( 'widget_text', $text, $instance, $this ); if ( $is_visual_text_widget ) { $text = apply_filters( 'widget_text_content', $text, $instance, $this ); } else { if ( ! empty( $instance['filter'] ) ) { $text = wpautop( $text ); } if ( has_filter( 'widget_text_content', 'do_shortcode' ) && ! $widget_text_do_shortcode_priority ) { if ( ! empty( $instance['filter'] ) ) { $text = shortcode_unautop( $text ); } $text = do_shortcode( $text ); } } $post = $original_post; remove_filter( 'shortcode_atts_gallery', array( $this, '_filter_gallery_shortcode_attrs' ) ); if ( $should_suspend_legacy_shortcode_support ) { add_filter( 'widget_text', 'do_shortcode', $widget_text_do_shortcode_priority ); } echo $args['before_widget']; if ( ! empty( $title ) ) { echo $args['before_title'] . $title . $args['after_title']; } $text = preg_replace_callback( '#<(video|iframe|object|embed)\s[^>]*>#i', array( $this, 'inject_video_max_width_style' ), $text ); $text = wp_targeted_link_rel( $text ); ?>
			<div class="textwidget"><?php echo $text; ?></div>
		<?php
 echo $args['after_widget']; } public function inject_video_max_width_style( $matches ) { $html = $matches[0]; $html = preg_replace( '/\sheight="\d+"/', '', $html ); $html = preg_replace( '/\swidth="\d+"/', '', $html ); $html = preg_replace( '/(?<=width:)\s*\d+px(?=;?)/', '100%', $html ); return $html; } public function update( $new_instance, $old_instance ) { $new_instance = wp_parse_args( $new_instance, array( 'title' => '', 'text' => '', 'filter' => false, 'visual' => null, ) ); $instance = $old_instance; $instance['title'] = sanitize_text_field( $new_instance['title'] ); if ( current_user_can( 'unfiltered_html' ) ) { $instance['text'] = $new_instance['text']; } else { $instance['text'] = wp_kses_post( $new_instance['text'] ); } $instance['filter'] = ! empty( $new_instance['filter'] ); if ( isset( $old_instance['filter'] ) && 'content' === $old_instance['filter'] ) { $instance['visual'] = true; } if ( 'content' === $new_instance['filter'] ) { $instance['visual'] = true; } if ( isset( $new_instance['visual'] ) ) { $instance['visual'] = ! empty( $new_instance['visual'] ); } if ( ! empty( $instance['visual'] ) ) { $instance['filter'] = true; } return $instance; } public function enqueue_preview_scripts() { require_once dirname( __DIR__ ) . '/media.php'; wp_playlist_scripts( 'audio' ); wp_playlist_scripts( 'video' ); } public function enqueue_admin_scripts() { wp_enqueue_editor(); wp_enqueue_media(); wp_enqueue_script( 'text-widgets' ); wp_add_inline_script( 'text-widgets', 'wp.textWidgets.init();', 'after' ); } public function form( $instance ) { $instance = wp_parse_args( (array) $instance, array( 'title' => '', 'text' => '', ) ); ?>
		<?php if ( ! $this->is_legacy_instance( $instance ) ) : ?>
			<?php
 if ( user_can_richedit() ) { add_filter( 'the_editor_content', 'format_for_editor', 10, 2 ); $default_editor = 'tinymce'; } else { $default_editor = 'html'; } $text = apply_filters( 'the_editor_content', $instance['text'], $default_editor ); if ( user_can_richedit() ) { remove_filter( 'the_editor_content', 'format_for_editor' ); } $escaped_text = preg_replace( '#</textarea#i', '&lt;/textarea', $text ); ?>
			<input id="<?php echo $this->get_field_id( 'title' ); ?>" name="<?php echo $this->get_field_name( 'title' ); ?>" class="title sync-input" type="hidden" value="<?php echo esc_attr( $instance['title'] ); ?>">
			<textarea id="<?php echo $this->get_field_id( 'text' ); ?>" name="<?php echo $this->get_field_name( 'text' ); ?>" class="text sync-input" hidden><?php echo $escaped_text; ?></textarea>
			<input id="<?php echo $this->get_field_id( 'filter' ); ?>" name="<?php echo $this->get_field_name( 'filter' ); ?>" class="filter sync-input" type="hidden" value="on">
			<input id="<?php echo $this->get_field_id( 'visual' ); ?>" name="<?php echo $this->get_field_name( 'visual' ); ?>" class="visual sync-input" type="hidden" value="on">
		<?php else : ?>
			<input id="<?php echo $this->get_field_id( 'visual' ); ?>" name="<?php echo $this->get_field_name( 'visual' ); ?>" class="visual" type="hidden" value="">
			<p>
				<label for="<?php echo $this->get_field_id( 'title' ); ?>"><?php _e( 'Title:' ); ?></label>
				<input class="widefat" id="<?php echo $this->get_field_id( 'title' ); ?>" name="<?php echo $this->get_field_name( 'title' ); ?>" type="text" value="<?php echo esc_attr( $instance['title'] ); ?>" />
			</p>
			<div class="notice inline notice-info notice-alt">
				<?php if ( ! isset( $instance['visual'] ) ) : ?>
					<p><?php _e( 'This widget may contain code that may work better in the &#8220;Custom HTML&#8221; widget. How about trying that widget instead?' ); ?></p>
				<?php else : ?>
					<p><?php _e( 'This widget may have contained code that may work better in the &#8220;Custom HTML&#8221; widget. If you have not yet, how about trying that widget instead?' ); ?></p>
				<?php endif; ?>
			</div>
			<p>
				<label for="<?php echo $this->get_field_id( 'text' ); ?>"><?php _e( 'Content:' ); ?></label>
				<textarea class="widefat" rows="16" cols="20" id="<?php echo $this->get_field_id( 'text' ); ?>" name="<?php echo $this->get_field_name( 'text' ); ?>"><?php echo esc_textarea( $instance['text'] ); ?></textarea>
			</p>
			<p>
				<input id="<?php echo $this->get_field_id( 'filter' ); ?>" name="<?php echo $this->get_field_name( 'filter' ); ?>" type="checkbox"<?php checked( ! empty( $instance['filter'] ) ); ?> />&nbsp;<label for="<?php echo $this->get_field_id( 'filter' ); ?>"><?php _e( 'Automatically add paragraphs' ); ?></label>
			</p>
			<?php
 endif; } public static function render_control_template_scripts() { $dismissed_pointers = explode( ',', (string) get_user_meta( get_current_user_id(), 'dismissed_wp_pointers', true ) ); ?>
		<script type="text/html" id="tmpl-widget-text-control-fields">
			<# var elementIdPrefix = 'el' + String( Math.random() ).replace( /\D/g, '' ) + '_' #>
			<p>
				<label for="{{ elementIdPrefix }}title"><?php esc_html_e( 'Title:' ); ?></label>
				<input id="{{ elementIdPrefix }}title" type="text" class="widefat title">
			</p>

			<?php if ( ! in_array( 'text_widget_custom_html', $dismissed_pointers, true ) ) : ?>
				<div hidden class="wp-pointer custom-html-widget-pointer wp-pointer-top">
					<div class="wp-pointer-content">
						<h3><?php _e( 'New Custom HTML Widget' ); ?></h3>
						<?php if ( is_customize_preview() ) : ?>
							<p><?php _e( 'Did you know there is a &#8220;Custom HTML&#8221; widget now? You can find it by pressing the &#8220;<a class="add-widget" href="#">Add a Widget</a>&#8221; button and searching for &#8220;HTML&#8221;. Check it out to add some custom code to your site!' ); ?></p>
						<?php else : ?>
							<p><?php _e( 'Did you know there is a &#8220;Custom HTML&#8221; widget now? You can find it by scanning the list of available widgets on this screen. Check it out to add some custom code to your site!' ); ?></p>
						<?php endif; ?>
						<div class="wp-pointer-buttons">
							<a class="close" href="#"><?php _e( 'Dismiss' ); ?></a>
						</div>
					</div>
					<div class="wp-pointer-arrow">
						<div class="wp-pointer-arrow-inner"></div>
					</div>
				</div>
			<?php endif; ?>

			<?php if ( ! in_array( 'text_widget_paste_html', $dismissed_pointers, true ) ) : ?>
				<div hidden class="wp-pointer paste-html-pointer wp-pointer-top">
					<div class="wp-pointer-content">
						<h3><?php _e( 'Did you just paste HTML?' ); ?></h3>
						<p><?php _e( 'Hey there, looks like you just pasted HTML into the &#8220;Visual&#8221; tab of the Text widget. You may want to paste your code into the &#8220;Text&#8221; tab instead. Alternately, try out the new &#8220;Custom HTML&#8221; widget!' ); ?></p>
						<div class="wp-pointer-buttons">
							<a class="close" href="#"><?php _e( 'Dismiss' ); ?></a>
						</div>
					</div>
					<div class="wp-pointer-arrow">
						<div class="wp-pointer-arrow-inner"></div>
					</div>
				</div>
			<?php endif; ?>

			<p>
				<label for="{{ elementIdPrefix }}text" class="screen-reader-text"><?php esc_html_e( 'Content:' ); ?></label>
				<textarea id="{{ elementIdPrefix }}text" class="widefat text wp-editor-area" style="height: 200px" rows="16" cols="20"></textarea>
			</p>
		</script>
		<?php
 } } 