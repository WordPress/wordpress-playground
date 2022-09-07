<?php
 ?>
<div class="wp-embed">
	<p class="wp-embed-heading"><?php _e( 'Oops! That embed cannot be found.' ); ?></p>

	<div class="wp-embed-excerpt">
		<p>
			<?php
 printf( __( 'It looks like nothing was found at this location. Maybe try visiting %s directly?' ), '<strong><a href="' . esc_url( home_url() ) . '">' . esc_html( get_bloginfo( 'name' ) ) . '</a></strong>' ); ?>
		</p>
	</div>

	<?php
 do_action( 'embed_content' ); ?>

	<div class="wp-embed-footer">
		<?php the_embed_site_title(); ?>
	</div>
</div>
