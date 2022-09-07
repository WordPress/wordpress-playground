<?php
 class WP_Widget_Links extends WP_Widget { public function __construct() { $widget_ops = array( 'description' => __( 'Your blogroll' ), 'customize_selective_refresh' => true, ); parent::__construct( 'links', __( 'Links' ), $widget_ops ); } public function widget( $args, $instance ) { $show_description = isset( $instance['description'] ) ? $instance['description'] : false; $show_name = isset( $instance['name'] ) ? $instance['name'] : false; $show_rating = isset( $instance['rating'] ) ? $instance['rating'] : false; $show_images = isset( $instance['images'] ) ? $instance['images'] : true; $category = isset( $instance['category'] ) ? $instance['category'] : false; $orderby = isset( $instance['orderby'] ) ? $instance['orderby'] : 'name'; $order = 'rating' === $orderby ? 'DESC' : 'ASC'; $limit = isset( $instance['limit'] ) ? $instance['limit'] : -1; $before_widget = preg_replace( '/id="[^"]*"/', 'id="%id"', $args['before_widget'] ); $widget_links_args = array( 'title_before' => $args['before_title'], 'title_after' => $args['after_title'], 'category_before' => $before_widget, 'category_after' => $args['after_widget'], 'show_images' => $show_images, 'show_description' => $show_description, 'show_name' => $show_name, 'show_rating' => $show_rating, 'category' => $category, 'class' => 'linkcat widget', 'orderby' => $orderby, 'order' => $order, 'limit' => $limit, ); wp_list_bookmarks( apply_filters( 'widget_links_args', $widget_links_args, $instance ) ); } public function update( $new_instance, $old_instance ) { $new_instance = (array) $new_instance; $instance = array( 'images' => 0, 'name' => 0, 'description' => 0, 'rating' => 0, ); foreach ( $instance as $field => $val ) { if ( isset( $new_instance[ $field ] ) ) { $instance[ $field ] = 1; } } $instance['orderby'] = 'name'; if ( in_array( $new_instance['orderby'], array( 'name', 'rating', 'id', 'rand' ), true ) ) { $instance['orderby'] = $new_instance['orderby']; } $instance['category'] = (int) $new_instance['category']; $instance['limit'] = ! empty( $new_instance['limit'] ) ? (int) $new_instance['limit'] : -1; return $instance; } public function form( $instance ) { $instance = wp_parse_args( (array) $instance, array( 'images' => true, 'name' => true, 'description' => false, 'rating' => false, 'category' => false, 'orderby' => 'name', 'limit' => -1, ) ); $link_cats = get_terms( array( 'taxonomy' => 'link_category' ) ); $limit = (int) $instance['limit']; if ( ! $limit ) { $limit = -1; } ?>
		<p>
			<label for="<?php echo $this->get_field_id( 'category' ); ?>"><?php _e( 'Select Link Category:' ); ?></label>
			<select class="widefat" id="<?php echo $this->get_field_id( 'category' ); ?>" name="<?php echo $this->get_field_name( 'category' ); ?>">
				<option value=""><?php _ex( 'All Links', 'links widget' ); ?></option>
				<?php foreach ( $link_cats as $link_cat ) : ?>
					<option value="<?php echo (int) $link_cat->term_id; ?>" <?php selected( $instance['category'], $link_cat->term_id ); ?>>
						<?php echo esc_html( $link_cat->name ); ?>
					</option>
				<?php endforeach; ?>
			</select>
			<label for="<?php echo $this->get_field_id( 'orderby' ); ?>"><?php _e( 'Sort by:' ); ?></label>
			<select name="<?php echo $this->get_field_name( 'orderby' ); ?>" id="<?php echo $this->get_field_id( 'orderby' ); ?>" class="widefat">
				<option value="name"<?php selected( $instance['orderby'], 'name' ); ?>><?php _e( 'Link title' ); ?></option>
				<option value="rating"<?php selected( $instance['orderby'], 'rating' ); ?>><?php _e( 'Link rating' ); ?></option>
				<option value="id"<?php selected( $instance['orderby'], 'id' ); ?>><?php _e( 'Link ID' ); ?></option>
				<option value="rand"<?php selected( $instance['orderby'], 'rand' ); ?>><?php _ex( 'Random', 'Links widget' ); ?></option>
			</select>
		</p>

		<p>
			<input class="checkbox" type="checkbox"<?php checked( $instance['images'], true ); ?> id="<?php echo $this->get_field_id( 'images' ); ?>" name="<?php echo $this->get_field_name( 'images' ); ?>" />
			<label for="<?php echo $this->get_field_id( 'images' ); ?>"><?php _e( 'Show Link Image' ); ?></label>
			<br />

			<input class="checkbox" type="checkbox"<?php checked( $instance['name'], true ); ?> id="<?php echo $this->get_field_id( 'name' ); ?>" name="<?php echo $this->get_field_name( 'name' ); ?>" />
			<label for="<?php echo $this->get_field_id( 'name' ); ?>"><?php _e( 'Show Link Name' ); ?></label>
			<br />

			<input class="checkbox" type="checkbox"<?php checked( $instance['description'], true ); ?> id="<?php echo $this->get_field_id( 'description' ); ?>" name="<?php echo $this->get_field_name( 'description' ); ?>" />
			<label for="<?php echo $this->get_field_id( 'description' ); ?>"><?php _e( 'Show Link Description' ); ?></label>
			<br />

			<input class="checkbox" type="checkbox"<?php checked( $instance['rating'], true ); ?> id="<?php echo $this->get_field_id( 'rating' ); ?>" name="<?php echo $this->get_field_name( 'rating' ); ?>" />
			<label for="<?php echo $this->get_field_id( 'rating' ); ?>"><?php _e( 'Show Link Rating' ); ?></label>
		</p>

		<p>
			<label for="<?php echo $this->get_field_id( 'limit' ); ?>"><?php _e( 'Number of links to show:' ); ?></label>
			<input id="<?php echo $this->get_field_id( 'limit' ); ?>" name="<?php echo $this->get_field_name( 'limit' ); ?>" type="text" value="<?php echo ( -1 !== $limit ) ? (int) $limit : ''; ?>" size="3" />
		</p>
		<?php
 } } 