<?php
 function wp_set_unique_slug_on_create_template_part( $post_id ) { $post = get_post( $post_id ); if ( 'auto-draft' !== $post->post_status ) { return; } if ( ! $post->post_name ) { wp_update_post( array( 'ID' => $post_id, 'post_name' => 'custom_slug_' . uniqid(), ) ); } $terms = get_the_terms( $post_id, 'wp_theme' ); if ( ! is_array( $terms ) || ! count( $terms ) ) { wp_set_post_terms( $post_id, wp_get_theme()->get_stylesheet(), 'wp_theme' ); } } function wp_filter_wp_template_unique_post_slug( $override_slug, $slug, $post_ID, $post_status, $post_type ) { if ( 'wp_template' !== $post_type && 'wp_template_part' !== $post_type ) { return $override_slug; } if ( ! $override_slug ) { $override_slug = $slug; } $theme = wp_get_theme()->get_stylesheet(); $terms = get_the_terms( $post_ID, 'wp_theme' ); if ( $terms && ! is_wp_error( $terms ) ) { $theme = $terms[0]->name; } $check_query_args = array( 'post_name__in' => array( $override_slug ), 'post_type' => $post_type, 'posts_per_page' => 1, 'no_found_rows' => true, 'post__not_in' => array( $post_ID ), 'tax_query' => array( array( 'taxonomy' => 'wp_theme', 'field' => 'name', 'terms' => $theme, ), ), ); $check_query = new WP_Query( $check_query_args ); $posts = $check_query->posts; if ( count( $posts ) > 0 ) { $suffix = 2; do { $query_args = $check_query_args; $alt_post_name = _truncate_post_slug( $override_slug, 200 - ( strlen( $suffix ) + 1 ) ) . "-$suffix"; $query_args['post_name__in'] = array( $alt_post_name ); $query = new WP_Query( $query_args ); $suffix++; } while ( count( $query->posts ) > 0 ); $override_slug = $alt_post_name; } return $override_slug; } function the_block_template_skip_link() { global $_wp_current_template_content; if ( ! current_theme_supports( 'block-templates' ) ) { return; } if ( ! $_wp_current_template_content ) { return; } ?>

	<?php
 ?>
	<style id="skip-link-styles">
		.skip-link.screen-reader-text {
			border: 0;
			clip: rect(1px,1px,1px,1px);
			clip-path: inset(50%);
			height: 1px;
			margin: -1px;
			overflow: hidden;
			padding: 0;
			position: absolute !important;
			width: 1px;
			word-wrap: normal !important;
		}

		.skip-link.screen-reader-text:focus {
			background-color: #eee;
			clip: auto !important;
			clip-path: none;
			color: #444;
			display: block;
			font-size: 1em;
			height: auto;
			left: 5px;
			line-height: normal;
			padding: 15px 23px 14px;
			text-decoration: none;
			top: 5px;
			width: auto;
			z-index: 100000;
		}
	</style>
	<?php
 ?>
	<script>
	( function() {
		var skipLinkTarget = document.querySelector( 'main' ),
			sibling,
			skipLinkTargetID,
			skipLink;

		// Early exit if a skip-link target can't be located.
		if ( ! skipLinkTarget ) {
			return;
		}

		// Get the site wrapper.
		// The skip-link will be injected in the beginning of it.
		sibling = document.querySelector( '.wp-site-blocks' );

		// Early exit if the root element was not found.
		if ( ! sibling ) {
			return;
		}

		// Get the skip-link target's ID, and generate one if it doesn't exist.
		skipLinkTargetID = skipLinkTarget.id;
		if ( ! skipLinkTargetID ) {
			skipLinkTargetID = 'wp--skip-link--target';
			skipLinkTarget.id = skipLinkTargetID;
		}

		// Create the skip link.
		skipLink = document.createElement( 'a' );
		skipLink.classList.add( 'skip-link', 'screen-reader-text' );
		skipLink.href = '#' + skipLinkTargetID;
		skipLink.innerHTML = '<?php esc_html_e( 'Skip to content' ); ?>';

		// Inject the skip link.
		sibling.parentElement.insertBefore( skipLink, sibling );
	}() );
	</script>
	<?php
} function wp_enable_block_templates() { if ( wp_is_block_theme() || WP_Theme_JSON_Resolver::theme_has_support() ) { add_theme_support( 'block-templates' ); } } 