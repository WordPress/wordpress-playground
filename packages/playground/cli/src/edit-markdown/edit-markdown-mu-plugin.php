<?php
/**
 * Plugin Name: Playground CLI — Edit Markdown
 * Description: Points wp_posts / wp_postmeta at a directory tree of `.md`
 *   files via sqlite-markdown virtual tables registered by a PHP.wasm
 *   extension loaded before PHP starts.
 *   PHP never enumerates the file tree — SQLite is the boundary that reads
 *   and writes Markdown.
 *
 * Architecture:
 *
 *   disk: /markdown-root/**\/*.md
 *        ↕ (sqlite-markdown registered via sqlite3_auto_extension; provides
 *           markdown_posts / markdown_postmeta virtual tables)
 *   SQLite engine inside Playground's PHP
 *        ↕
 *   wp_posts and wp_postmeta — CREATE VIRTUAL TABLE … USING markdown_posts
 *        ↕
 *   WordPress (sees plain wp_posts rows; the editor stores blocks; the
 *   filters below convert blocks → markdown on write and markdown → blocks
 *   on read so the on-disk files stay human-editable Markdown)
 *
 * The mu-plugin's only responsibility is to swap the regular wp_posts /
 * wp_postmeta tables for the virtual ones once, and translate post_content
 * between Markdown and block markup at the editor boundary using
 * wp-php-toolkit/markdown.
 */

if ( ! defined( 'EDIT_MD_ROOT' ) ) {
	define( 'EDIT_MD_ROOT', '/markdown-root' );
}
if ( ! defined( 'EDIT_MD_TOOLKIT_AUTOLOAD' ) ) {
	define(
		'EDIT_MD_TOOLKIT_AUTOLOAD',
		'/internal/shared/php-toolkit/vendor/autoload.php'
	);
}

/**
 * Load the php-toolkit composer autoloader. Returns true on success.
 */
function edit_md_load_toolkit() {
	if ( class_exists( '\\WordPress\\Markdown\\MarkdownConsumer' ) ) {
		return true;
	}
	if ( is_readable( EDIT_MD_TOOLKIT_AUTOLOAD ) ) {
		require_once EDIT_MD_TOOLKIT_AUTOLOAD;
	}
	return class_exists( '\\WordPress\\Markdown\\MarkdownConsumer' );
}

/**
 * Return true when $content already contains WordPress block delimiters.
 * Used to guard against double-conversion when content passes through
 * multiple hooks (e.g. `the_post` then `rest_prepare_page`).
 */
function edit_md_looks_like_blocks( $content ) {
	return strpos( (string) $content, '<!-- wp:' ) !== false;
}

/**
 * Convert a Markdown string to block markup via php-toolkit's MarkdownConsumer.
 */
function edit_md_markdown_to_blocks( $markdown ) {
	if ( ! edit_md_load_toolkit() ) {
		return '<!-- wp:html -->' . $markdown . '<!-- /wp:html -->';
	}
	$consumer = new \WordPress\Markdown\MarkdownConsumer( (string) $markdown );
	$result   = $consumer->consume();
	return $result->get_block_markup();
}

/**
 * Convert block markup back to Markdown via php-toolkit's MarkdownProducer.
 */
function edit_md_blocks_to_markdown( $blocks ) {
	if ( ! edit_md_load_toolkit() ) {
		return preg_replace( '/<!--\s*\/?wp:[^>]*-->/', '', (string) $blocks );
	}
	$bwm = new \WordPress\DataLiberation\DataFormatConsumer\BlocksWithMetadata(
		(string) $blocks,
		array()
	);
	$producer = new \WordPress\Markdown\MarkdownProducer( $bwm );
	return $producer->produce();
}

/**
 * Replace the regular wp_posts / wp_postmeta tables with the virtual
 * ones backed by the markdown root.
 *
 * The sqlite-markdown PHP.wasm extension is loaded through the CLI's
 * phpExtension manifest before PHP starts. Its MINIT registers the SQLite
 * extension via sqlite3_auto_extension, so by the time this mu-plugin runs
 * the markdown_posts / markdown_postmeta modules are already known to the
 * SDI PDO handle; we just have to flip the persistent rowstore tables to
 * virtual ones for this connection.
 */
function edit_md_install_virtual_tables() {
	if ( ! empty( $GLOBALS['edit_md_sqlite_ready'] ) ) {
		return;
	}
	$pdo = isset( $GLOBALS['@pdo'] ) ? $GLOBALS['@pdo'] : null;
	if ( ! $pdo instanceof PDO ) {
		return;
	}

	global $table_prefix;
	$prefix = $table_prefix ?: 'wp_';
	$root   = EDIT_MD_ROOT;
	$quoted = "'" . str_replace( "'", "''", $root ) . "'";

	try {
		$pdo->exec( "DROP TABLE IF EXISTS {$prefix}posts" );
		$pdo->exec( "DROP TABLE IF EXISTS {$prefix}postmeta" );
		$pdo->exec(
			"CREATE VIRTUAL TABLE {$prefix}posts USING markdown_posts(root = {$quoted})"
		);
		$pdo->exec(
			"CREATE VIRTUAL TABLE {$prefix}postmeta USING markdown_postmeta(root = {$quoted})"
		);
		$GLOBALS['edit_md_sqlite_ready'] = true;
		delete_option( 'edit_md_last_error' );
	} catch ( Throwable $e ) {
		update_option(
			'edit_md_last_error',
			'CREATE VIRTUAL TABLE failed: ' . $e->getMessage() .
				' (did the sqlite-markdown PHP.wasm extension load?)'
		);
		error_log( '[edit-markdown] CREATE VIRTUAL TABLE failed: ' . $e->getMessage() );
	}
}

// SDI initializes the PDO during muplugins_loaded. Run our bootstrap right
// after, before WordPress core touches wp_posts.
add_action( 'plugins_loaded', 'edit_md_install_virtual_tables', 0 );
add_action( 'init', 'edit_md_install_virtual_tables', 0 );

/**
 * Convert the markdown stored on disk into block markup before WordPress
 * sees `post_content` for the editor.
 */
add_action( 'the_post', 'edit_md_decode_post_content_for_render', 0 );
function edit_md_decode_post_content_for_render( $post ) {
	if ( ! $post instanceof WP_Post ) {
		return;
	}
	if ( $post->post_type !== 'post' && $post->post_type !== 'page' ) {
		return;
	}
	if ( ! empty( $post->_edit_md_decoded ) ) {
		return;
	}
	if ( ! edit_md_looks_like_blocks( $post->post_content ) ) {
		$post->post_content = edit_md_markdown_to_blocks( $post->post_content );
	}
	$post->_edit_md_decoded = 1;
}

/**
 * Convert block markup back to Markdown right before WordPress writes the
 * row. The virtual table stores whatever string we hand it, so the disk
 * file ends up containing the Markdown the user expects to see.
 */
add_filter( 'wp_insert_post_data', 'edit_md_encode_post_content_for_storage', 0 );
function edit_md_encode_post_content_for_storage( $data ) {
	if ( empty( $data['post_content'] ) ) {
		return $data;
	}
	/* Only convert when the editor has sent real block markup. If the content
	 * is already plain Markdown (e.g. a programmatic insert with no block
	 * delimiters), leave it as-is so we don't double-encode. */
	if ( edit_md_looks_like_blocks( $data['post_content'] ) ) {
		$data['post_content'] = edit_md_blocks_to_markdown( $data['post_content'] );
	}
	return $data;
}

/**
 * Convert the on-disk Markdown to block markup in REST API responses so that
 * the Gutenberg editor receives proper blocks (paragraphs, headings, etc.)
 * rather than raw Markdown wrapped in a single `wp:html` fence.
 *
 * Only fires for `context=edit` requests — the view context is handled by the
 * `the_content` filter through the normal template loop.
 */
add_filter( 'rest_prepare_page', 'edit_md_rest_prepare_response', 10, 3 );
add_filter( 'rest_prepare_post', 'edit_md_rest_prepare_response', 10, 3 );
function edit_md_rest_prepare_response( $response, $post, $request ) {
	if ( $request->get_param( 'context' ) !== 'edit' ) {
		return $response;
	}
	$data = $response->get_data();
	if ( isset( $data['content']['raw'] ) && ! edit_md_looks_like_blocks( $data['content']['raw'] ) ) {
		$data['content']['raw'] = edit_md_markdown_to_blocks( $data['content']['raw'] );
		$response->set_data( $data );
	}
	return $response;
}

/**
 * Default newly imported posts to the `page` post_type so the directory
 * hierarchy from `markdown_posts` shows up in wp-admin under Pages.
 */
add_filter( 'wp_insert_post_data', 'edit_md_default_post_type_to_page', 5 );
function edit_md_default_post_type_to_page( $data ) {
	if ( isset( $data['post_type'] ) && $data['post_type'] === 'post' ) {
		$data['post_type'] = 'page';
	}
	return $data;
}

add_action( 'admin_notices', 'edit_md_welcome_notice' );
function edit_md_welcome_notice() {
	if ( empty( $GLOBALS['edit_md_sqlite_ready'] ) ) {
		$err = get_option( 'edit_md_last_error', '' );
		echo '<div class="notice notice-error"><p><strong>edit-markdown:</strong> ' .
			'virtual tables are not active.</p>' .
			( $err ? '<pre>' . esc_html( $err ) . '</pre>' : '' ) .
			'</div>';
		return;
	}
	echo '<div class="notice notice-info"><p>Playground <strong>edit-markdown</strong> is reading and writing ' .
		'<code>' . esc_html( EDIT_MD_ROOT ) . '</code> through the sqlite-markdown virtual tables. ' .
		'<a href="' . esc_url( admin_url( 'edit.php?post_type=page' ) ) . '">Open Pages →</a></p></div>';
}
