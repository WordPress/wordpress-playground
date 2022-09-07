<?php
 class WP_Widget_Meta extends WP_Widget { public function __construct() { $widget_ops = array( 'classname' => 'widget_meta', 'description' => __( 'Login, RSS, &amp; WordPress.org links.' ), 'customize_selective_refresh' => true, 'show_instance_in_rest' => true, ); parent::__construct( 'meta', __( 'Meta' ), $widget_ops ); } public function widget( $args, $instance ) { $default_title = __( 'Meta' ); $title = ! empty( $instance['title'] ) ? $instance['title'] : $default_title; $title = apply_filters( 'widget_title', $title, $instance, $this->id_base ); echo $args['before_widget']; if ( $title ) { echo $args['before_title'] . $title . $args['after_title']; } $format = current_theme_supports( 'html5', 'navigation-widgets' ) ? 'html5' : 'xhtml'; $format = apply_filters( 'navigation_widgets_format', $format ); if ( 'html5' === $format ) { $title = trim( strip_tags( $title ) ); $aria_label = $title ? $title : $default_title; echo '<nav aria-label="' . esc_attr( $aria_label ) . '">'; } ?>

		<ul>
			<?php wp_register(); ?>
			<li><?php wp_loginout(); ?></li>
			<li><a href="<?php echo esc_url( get_bloginfo( 'rss2_url' ) ); ?>"><?php _e( 'Entries feed' ); ?></a></li>
			<li><a href="<?php echo esc_url( get_bloginfo( 'comments_rss2_url' ) ); ?>"><?php _e( 'Comments feed' ); ?></a></li>

			<?php
 echo apply_filters( 'widget_meta_poweredby', sprintf( '<li><a href="%1$s">%2$s</a></li>', esc_url( __( 'https://wordpress.org/' ) ), __( 'WordPress.org' ) ), $instance ); wp_meta(); ?>

		</ul>

		<?php
 if ( 'html5' === $format ) { echo '</nav>'; } echo $args['after_widget']; } public function update( $new_instance, $old_instance ) { $instance = $old_instance; $instance['title'] = sanitize_text_field( $new_instance['title'] ); return $instance; } public function form( $instance ) { $instance = wp_parse_args( (array) $instance, array( 'title' => '' ) ); ?>
		<p>
			<label for="<?php echo $this->get_field_id( 'title' ); ?>"><?php _e( 'Title:' ); ?></label>
			<input class="widefat" id="<?php echo $this->get_field_id( 'title' ); ?>" name="<?php echo $this->get_field_name( 'title' ); ?>" type="text" value="<?php echo esc_attr( $instance['title'] ); ?>" />
		</p>
		<?php
 } } 