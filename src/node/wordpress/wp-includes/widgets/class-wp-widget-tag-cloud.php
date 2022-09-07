<?php
 class WP_Widget_Tag_Cloud extends WP_Widget { public function __construct() { $widget_ops = array( 'description' => __( 'A cloud of your most used tags.' ), 'customize_selective_refresh' => true, 'show_instance_in_rest' => true, ); parent::__construct( 'tag_cloud', __( 'Tag Cloud' ), $widget_ops ); } public function widget( $args, $instance ) { $current_taxonomy = $this->_get_current_taxonomy( $instance ); if ( ! empty( $instance['title'] ) ) { $title = $instance['title']; } else { if ( 'post_tag' === $current_taxonomy ) { $title = __( 'Tags' ); } else { $tax = get_taxonomy( $current_taxonomy ); $title = $tax->labels->name; } } $default_title = $title; $show_count = ! empty( $instance['count'] ); $tag_cloud = wp_tag_cloud( apply_filters( 'widget_tag_cloud_args', array( 'taxonomy' => $current_taxonomy, 'echo' => false, 'show_count' => $show_count, ), $instance ) ); if ( empty( $tag_cloud ) ) { return; } $title = apply_filters( 'widget_title', $title, $instance, $this->id_base ); echo $args['before_widget']; if ( $title ) { echo $args['before_title'] . $title . $args['after_title']; } $format = current_theme_supports( 'html5', 'navigation-widgets' ) ? 'html5' : 'xhtml'; $format = apply_filters( 'navigation_widgets_format', $format ); if ( 'html5' === $format ) { $title = trim( strip_tags( $title ) ); $aria_label = $title ? $title : $default_title; echo '<nav aria-label="' . esc_attr( $aria_label ) . '">'; } echo '<div class="tagcloud">'; echo $tag_cloud; echo "</div>\n"; if ( 'html5' === $format ) { echo '</nav>'; } echo $args['after_widget']; } public function update( $new_instance, $old_instance ) { $instance = array(); $instance['title'] = sanitize_text_field( $new_instance['title'] ); $instance['count'] = ! empty( $new_instance['count'] ) ? 1 : 0; $instance['taxonomy'] = stripslashes( $new_instance['taxonomy'] ); return $instance; } public function form( $instance ) { $title = ! empty( $instance['title'] ) ? $instance['title'] : ''; $count = isset( $instance['count'] ) ? (bool) $instance['count'] : false; ?>
		<p>
			<label for="<?php echo $this->get_field_id( 'title' ); ?>"><?php _e( 'Title:' ); ?></label>
			<input type="text" class="widefat" id="<?php echo $this->get_field_id( 'title' ); ?>" name="<?php echo $this->get_field_name( 'title' ); ?>" value="<?php echo esc_attr( $title ); ?>" />
		</p>
		<?php
 $taxonomies = get_taxonomies( array( 'show_tagcloud' => true ), 'object' ); $current_taxonomy = $this->_get_current_taxonomy( $instance ); switch ( count( $taxonomies ) ) { case 0: ?>
				<input type="hidden" id="<?php echo $this->get_field_id( 'taxonomy' ); ?>" name="<?php echo $this->get_field_name( 'taxonomy' ); ?>" value="" />
				<p>
					<?php _e( 'The tag cloud will not be displayed since there are no taxonomies that support the tag cloud widget.' ); ?>
				</p>
				<?php
 break; case 1: $keys = array_keys( $taxonomies ); $taxonomy = reset( $keys ); ?>
				<input type="hidden" id="<?php echo $this->get_field_id( 'taxonomy' ); ?>" name="<?php echo $this->get_field_name( 'taxonomy' ); ?>" value="<?php echo esc_attr( $taxonomy ); ?>" />
				<?php
 break; default: ?>
				<p>
					<label for="<?php echo $this->get_field_id( 'taxonomy' ); ?>"><?php _e( 'Taxonomy:' ); ?></label>
					<select class="widefat" id="<?php echo $this->get_field_id( 'taxonomy' ); ?>" name="<?php echo $this->get_field_name( 'taxonomy' ); ?>">
					<?php foreach ( $taxonomies as $taxonomy => $tax ) : ?>
						<option value="<?php echo esc_attr( $taxonomy ); ?>" <?php selected( $taxonomy, $current_taxonomy ); ?>>
							<?php echo esc_html( $tax->labels->name ); ?>
						</option>
					<?php endforeach; ?>
					</select>
				</p>
				<?php
 } if ( count( $taxonomies ) > 0 ) { ?>
			<p>
				<input type="checkbox" class="checkbox" id="<?php echo $this->get_field_id( 'count' ); ?>" name="<?php echo $this->get_field_name( 'count' ); ?>" <?php checked( $count, true ); ?> />
				<label for="<?php echo $this->get_field_id( 'count' ); ?>"><?php _e( 'Show tag counts' ); ?></label>
			</p>
			<?php
 } } public function _get_current_taxonomy( $instance ) { if ( ! empty( $instance['taxonomy'] ) && taxonomy_exists( $instance['taxonomy'] ) ) { return $instance['taxonomy']; } return 'post_tag'; } } 