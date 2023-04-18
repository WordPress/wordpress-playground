<?php
/*
 * Plugin Name: WordPress WXZ Exporter
 * Version: 0.1
 */

add_action( 'export_wp', 'override_export_wp' );
if ( ! defined( 'PCLZIP_TEMPORARY_DIR' ) ) {
	define( 'PCLZIP_TEMPORARY_DIR', sys_get_temp_dir() . '/' );
}

function override_export_wp( $args = array() ) {
	if (isset($_GET['export_wxz'])) {
		$export = new Export_WXZ($args);
		$export->export();
		exit;
	}
}

class Export_WXZ {
	public $filelist = array();
	public $filename;

	public function __construct( $args = array() ) {
		global $wpdb, $post;

		$defaults = array(
			'content'    => 'all',
			'author'     => false,
			'category'   => false,
			'start_date' => false,
			'end_date'   => false,
			'status'     => false,
		);
		$this->args     = wp_parse_args( $args, $defaults );

		$sitename = sanitize_key( get_bloginfo( 'name' ) );
		if ( ! empty( $sitename ) ) {
			$sitename .= '.';
		}
		$date        = gmdate( 'Y-m-d' );
		$wp_filename = $sitename . 'WordPress.' . $date . '.wxz';
		/**
		 * Export the export filename.
		 *
		 * @param string $wp_filename The name of the file for download.
		 * @param string $sitename    The site name.
		 * @param string $date        Today's date, formatted.
		 */
		$this->filename = apply_filters( 'export_wp_filename', $wp_filename, $sitename, $date );
	}

	private function json_encode( $json ) {
		return json_encode( $json, JSON_PRETTY_PRINT );
	}

	private function add_file( $filename, $content, $write_to_dir = false ) {
		require_once ABSPATH . '/wp-admin/includes/class-pclzip.php';

		$this->filelist[] = array(
			PCLZIP_ATT_FILE_NAME => $filename,
			PCLZIP_ATT_FILE_CONTENT => $content,
		);

		if ( $write_to_dir ) {
			$dir = dirname( $filename );
			$write_to_dir = rtrim( $write_to_dir, '/' ) . '/';
			if ( ! file_exists( $write_to_dir . $dir ) ) {
				mkdir( $write_to_dir . $dir, 0777, true );
			}
			file_put_contents( $write_to_dir . $filename, $content );
		}

		return $filename;
	}

	private function output_wxz() {
		if ( empty( $this->filelist ) ) {
			return new WP_Error( 'no-files', 'No files to write.' );
		}

		require_once ABSPATH . '/wp-admin/includes/class-pclzip.php';
		$zip = tempnam( '/tmp/', $this->filename . '.zip' );

		$archive = new PclZip( $zip );
		// This two-step approach is needed to save the mimetype file uncompressed.
		$archive->create( array(
				array(
					PCLZIP_ATT_FILE_NAME => 'mimetype',
					PCLZIP_ATT_FILE_CONTENT => 'application/vnd.wordpress.export+zip',
				),
			),
			PCLZIP_OPT_NO_COMPRESSION
		);
		// No we can add the actual files and use compression.
		$archive->add( $this->filelist );

		readfile( $zip );
		unlink( $zip );
	}

	public function export() {
		global $wpdb, $post;
		// add_filter( 'wxr_export_skip_postmeta', 'wxr_filter_postmeta', 10, 2 );

		if ( 'all' !== $this->args['content'] && post_type_exists( $this->args['content'] ) ) {
			$ptype = get_post_type_object( $this->args['content'] );
			if ( ! $ptype->can_export ) {
				$this->args['content'] = 'post';
			}

			$where = $wpdb->prepare( "{$wpdb->posts}.post_type = %s", $this->args['content'] );
		} else {
			$post_types = get_post_types( array( 'can_export' => true ) );
			$esses      = array_fill( 0, count( $post_types ), '%s' );

			// phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
			$where = $wpdb->prepare( "{$wpdb->posts}.post_type IN (" . implode( ',', $esses ) . ')', $post_types );
		}

		if ( $this->args['status'] && ( 'post' === $this->args['content'] || 'page' === $this->args['content'] ) ) {
			$where .= $wpdb->prepare( " AND {$wpdb->posts}.post_status = %s", $this->args['status'] );
		} else {
			$where .= " AND {$wpdb->posts}.post_status != 'auto-draft'";
		}

		$join = '';
		if ( $this->args['category'] && 'post' === $this->args['content'] ) {
			$term = term_exists( $this->args['category'], 'category' );
			if ( $term ) {
				$join   = "INNER JOIN {$wpdb->term_relationships} ON ({$wpdb->posts}.ID = {$wpdb->term_relationships}.object_id)";
				$where .= $wpdb->prepare( " AND {$wpdb->term_relationships}.term_taxonomy_id = %d", $term['term_taxonomy_id'] );
			}
		}

		if ( in_array( $this->args['content'], array( 'post', 'page', 'attachment' ), true ) ) {
			if ( $this->args['author'] ) {
				$where .= $wpdb->prepare( " AND {$wpdb->posts}.post_author = %d", $this->args['author'] );
			}

			if ( $this->args['start_date'] ) {
				$where .= $wpdb->prepare( " AND {$wpdb->posts}.post_date >= %s", gmdate( 'Y-m-d', strtotime( $this->args['start_date'] ) ) );
			}

			if ( $this->args['end_date'] ) {
				$where .= $wpdb->prepare( " AND {$wpdb->posts}.post_date < %s", gmdate( 'Y-m-d', strtotime( '+1 month', strtotime( $this->args['end_date'] ) ) ) );
			}
		}

		// Grab a snapshot of post IDs, just in case it changes during the export.
		$post_ids = $wpdb->get_col( "SELECT ID FROM {$wpdb->posts} $join WHERE $where" );

		/*
		 * Get the requested terms ready, empty unless posts filtered by category
		 * or all content.
		 */
		$cats  = array();
		$tags  = array();
		$terms = array();
		if ( isset( $term ) && $term ) {
			$cat  = get_term( $term['term_id'], 'category' );
			$cats = array( $cat->term_id => $cat );
			unset( $term, $cat );
		} elseif ( 'all' === $this->args['content'] ) {
			$categories = (array) get_categories( array( 'get' => 'all' ) );
			$tags       = (array) get_tags( array( 'get' => 'all' ) );

			$custom_taxonomies = get_taxonomies( array( '_builtin' => false ) );
			$custom_terms      = (array) get_terms(
				array(
					'taxonomy' => $custom_taxonomies,
					'get'      => 'all',
				)
			);

			// Put categories in order with no child going before its parent.
			while ( $cat = array_shift( $categories ) ) {
				if ( 0 == $cat->parent || isset( $cats[ $cat->parent ] ) ) {
					$cats[ $cat->term_id ] = $cat;
				} else {
					$categories[] = $cat;
				}
			}

			// Put terms in order with no child going before its parent.
			while ( $t = array_shift( $custom_terms ) ) {
				if ( 0 == $t->parent || isset( $terms[ $t->parent ] ) ) {
					$terms[ $t->term_id ] = $t;
				} else {
					$custom_terms[] = $t;
				}
			}

			unset( $categories, $custom_taxonomies, $custom_terms );
		}

		$this->add_file( 'site/config.json', $this->json_encode( $this->get_blog_details() ) );

		$this->export_authors();
		$this->export_nav_menu_terms();

		foreach ( $cats as $c ) {
			$this->add_file(
				'terms/' . intval( $c->term_id ) . '.json',
				$this->json_encode( array(
					'version' => 1,
					'id' => intval( $c->term_id ),
					'taxonomy' => $c->taxonomy,
					'name' => $c->name,
					'slug' => $c->slug,
					'parent' => $c->parent ? $cats[ $c->parent ]->slug : '',
					'description' => $c->description,
					'termmeta' => $this->termmeta( $c ),
				) )
			);
		}

		foreach ( $tags as $t ) {
			$this->add_file(
				'terms/' . intval( $t->term_id ) . '.json',
				$this->json_encode( array(
					'version' => 1,
					'id' => intval( $t->term_id ),
					'taxonomy' => $t->taxonomy,
					'name' => $t->name,
					'slug' => $t->slug,
					'description' => $t->description,
					'termmeta' => $this->termmeta( $t ),
				) )
			);
		}

		foreach ( $terms as $t ) {
			$this->add_file(
				'terms/' . intval( $t->term_id ) . '.json',
				$this->json_encode( array(
					'version' => 1,
					'id' => intval( $t->term_id ),
					'taxonomy' => $t->taxonomy,
					'name' => $t->name,
					'slug' => $t->slug,
					'parent' => $t->parent ? $terms[ $t->parent ]->slug : '',
					'description' => $t->description,
					'termmeta' => $this->termmeta( $t ),
				) )
			);
		}

		if ( 'all' === $this->args['content'] ) {
			$this->export_nav_menu_terms();
		}

		if ( $post_ids ) {
			/**
			 * @global WP_Query $wp_query WordPress Query object.
			 */
			global $wp_query;

			// Fake being in the loop.
			$wp_query->in_the_loop = true;

			// Fetch 20 posts at a time rather than loading the entire table into memory.
			while ( $next_posts = array_splice( $post_ids, 0, 20 ) ) {
				$where = 'WHERE ID IN (' . implode( ',', $next_posts ) . ')';
				$posts = $wpdb->get_results( "SELECT * FROM {$wpdb->posts} $where" );

				// Begin Loop.
				foreach ( $posts as $post ) {
					setup_postdata( $post );

					/**
					 * Filters the post title used for WXR exports.
					 *
					 * @since 5.7.0
					 *
					 * @param string $post_title Title of the current post.
					 */
					$title = apply_filters( 'the_title_export', $post->post_title );

					/**
					 * Filters the post content used for WXR exports.
					 *
					 * @since 2.5.0
					 *
					 * @param string $post_content Content of the current post.
					 */
					$content = apply_filters( 'the_content_export', $post->post_content );

					/**
					 * Filters the post excerpt used for WXR exports.
					 *
					 * @since 2.6.0
					 *
					 * @param string $post_excerpt Excerpt for the current post.
					 */
					$excerpt = apply_filters( 'the_excerpt_export', $post->post_excerpt );

					$is_sticky = is_sticky( $post->ID ) ? 1 : 0;

					$data = array(
						'version' => 1,
						'title' => $title,
						'author' => get_the_author_meta( 'login' ),
						'status' => $post->post_status,
						'content' => $content,
						'excerpt' => $excerpt,
						'type' => $post->post_type,
						'parent' => $post->post_parent,
						'password' => $post->post_password,
						'comment_status' => $post->comment_status,
						'ping_status' => $post->ping_status,
						'menu_order' => intval( $post->menu_order ),
						'is_sticky' => $is_sticky,
						'date_utc' => $post->post_date_gmt,
						'date_modified_utc' => $post->post_modified_gmt,
						'postmeta' => $this->postmeta( $post->ID ),
					);

					if ( 'attachment' === $post->post_type ) {
						$data['attachment_url'] = wp_get_attachment_url( $post->ID );
					}

					$this->add_file(
						'posts/' . intval( $post->ID ) . '.json',
						$this->json_encode( $data )
					);

				}
			}
		}

		header( 'Content-Description: File Transfer' );
		header( 'Content-Disposition: attachment; filename=' . $this->filename );
		header( 'Content-Type: application/zip; charset=' . get_option( 'blog_charset' ), true );

		$this->output_wxz();
	}

	private function get_blog_details() {
		if ( is_multisite() ) {
			// Multisite: the base URL.
			$base_site_url = network_home_url();
		} else {
			// WordPress (single site): the blog URL.
			$base_site_url = get_bloginfo_rss( 'url' );
		}

		return array(
			'version' => 1,
			'title' => get_bloginfo_rss( 'name' ),
			'link' => get_bloginfo_rss( 'url' ),
			'description' => get_bloginfo_rss( 'description' ),
			'date' => gmdate( 'D, d M Y H:i:s +0000' ),
			'language' => get_bloginfo_rss( 'language' ),
			'base_site_url' => $base_site_url,
			'base_blog_url' => get_bloginfo_rss( 'url' ),
		);
	}

	/**
	 * Export list of authors with posts
	 *
	 * @global wpdb $wpdb WordPress database abstraction object.
	 *
	 * @param int[] $post_ids Optional. Array of post IDs to filter the query by.
	 */
	private function export_authors( array $post_ids = null ) {
		global $wpdb;

		if ( ! empty( $post_ids ) ) {
			$post_ids = array_map( 'absint', $post_ids );
			$and      = 'AND ID IN ( ' . implode( ', ', $post_ids ) . ')';
		} else {
			$and = '';
		}

		$authors = array();
		$results = $wpdb->get_results( "SELECT DISTINCT post_author FROM $wpdb->posts WHERE post_status != 'auto-draft' $and" );
		foreach ( (array) $results as $result ) {
			$authors[] = get_userdata( $result->post_author );
		}

		$authors = array_filter( $authors );

		foreach ( $authors as $author ) {
			$this->add_file(
				'users/' . intval( $author->ID ) . '.json',
				$this->json_encode( array(
					'version' => 1,
					'id' => intval( $author->ID ),
					'username' => $author->user_login,
					'display_name' => $author->display_name,
					'email' => $author->user_email,
				) )
			);
			// echo "\t<wp:author>";
			// echo '<wp:author_id>' . (int) $author->ID . '</wp:author_id>';
			// echo '<wp:author_login>' . wxr_cdata( $author->user_login ) . '</wp:author_login>';
			// echo '<wp:author_email>' . wxr_cdata( $author->user_email ) . '</wp:author_email>';
			// echo '<wp:author_display_name>' . wxr_cdata( $author->display_name ) . '</wp:author_display_name>';
			// echo '<wp:author_first_name>' . wxr_cdata( $author->first_name ) . '</wp:author_first_name>';
			// echo '<wp:author_last_name>' . wxr_cdata( $author->last_name ) . '</wp:author_last_name>';
			// echo "</wp:author>\n";
		}
	}

	/**
	 * Export all navigation menu terms
	 */
	private function export_nav_menu_terms() {
		$nav_menus = wp_get_nav_menus();
		if ( empty( $nav_menus ) || ! is_array( $nav_menus ) ) {
			return;
		}

		foreach ( $nav_menus as $menu ) {
			$this->add_file(
				'terms/' . intval( $menu->term_id ) . '.json',
				$this->json_encode( array(
					'taxonomy' => 'nav_menu',
					'name' => $menu->name,
					'slug' => $menu->slug,
				) )
			);

			// echo "\t<wp:term>";
			// echo '<wp:term_id>' . (int) $menu->term_id . '</wp:term_id>';
			// echo '<wp:term_taxonomy>nav_menu</wp:term_taxonomy>';
			// echo '<wp:term_slug>' . wxr_cdata( $menu->slug ) . '</wp:term_slug>';
			// wxr_term_name( $menu );
			// echo "</wp:term>\n";
		}
	}

	/**
	 * Export list of taxonomy terms, in XML tag format, associated with a post
	 */
	function export_post_taxonomy() {
		$post = get_post();

		$taxonomies = get_object_taxonomies( $post->post_type );
		if ( empty( $taxonomies ) ) {
			return;
		}
		$terms = wp_get_object_terms( $post->ID, $taxonomies );

		foreach ( (array) $terms as $term ) {
			$this->add_file(
				'categories/' . intval( $term->term_id ) . '.json',
				$this->json_encode( array(
					'taxonomy' => $term->taxonomy,
					'name' => $term->name,
					'slug' => $term->slug,
				) )
			);

			// echo "\t\t<category domain=\"{$term->taxonomy}\" nicename=\"{$term->slug}\">" . wxr_cdata( $term->name ) . "</category>\n";
		}
	}

	private function termmeta( $term ) {
		global $wpdb;

		$termmeta = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $wpdb->termmeta WHERE term_id = %d", $term->term_id ) );

		$metadata = array();
		foreach ( $termmeta as $meta ) {
			/**
			 * Filters whether to selectively skip term meta used for WXR exports.
			 *
			 * Returning a truthy value from the filter will skip the current meta
			 * object from being exported.
			 *
			 * @since 4.6.0
			 *
			 * @param bool   $skip     Whether to skip the current piece of term meta. Default false.
			 * @param string $meta_key Current meta key.
			 * @param object $meta     Current meta object.
			 */
			if ( ! apply_filters( 'wxr_export_skip_termmeta', false, $meta->meta_key, $meta ) ) {
				$metadata[ $meta->meta_key ] = $meta->meta_value;
			}
		}

		return $metadata;
	}
	private function postmeta( $id ) {
		global $wpdb;

		$postmeta = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $wpdb->postmeta WHERE post_id = %d", $id ) );
		$metadata = array();
		foreach ( $postmeta as $meta ) {
			/**
			 * Filters whether to selectively skip post meta used for WXR exports.
			 *
			 * Returning a truthy value from the filter will skip the current meta
			 * object from being exported.
			 *
			 * @since 3.3.0
			 *
			 * @param bool   $skip     Whether to skip the current post meta. Default false.
			 * @param string $meta_key Current meta key.
			 * @param object $meta     Current meta object.
			 */
			if ( apply_filters( 'wxr_export_skip_postmeta', false, $meta->meta_key, $meta ) ) {
				continue;
			}
			$metadata[ $meta->meta_key ] = $meta->meta_value;
		}

		return $metadata;
	}
}
