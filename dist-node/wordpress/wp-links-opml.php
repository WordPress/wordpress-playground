<?php
 require_once __DIR__ . '/wp-load.php'; header( 'Content-Type: text/xml; charset=' . get_option( 'blog_charset' ), true ); $link_cat = ''; if ( ! empty( $_GET['link_cat'] ) ) { $link_cat = $_GET['link_cat']; if ( ! in_array( $link_cat, array( 'all', '0' ), true ) ) { $link_cat = absint( (string) urldecode( $link_cat ) ); } } echo '<?xml version="1.0"?' . ">\n"; ?>
<opml version="1.0">
	<head>
		<title>
		<?php
 printf( __( 'Links for %s' ), esc_attr( get_bloginfo( 'name', 'display' ) ) ); ?>
		</title>
		<dateCreated><?php echo gmdate( 'D, d M Y H:i:s' ); ?> GMT</dateCreated>
		<?php
 do_action( 'opml_head' ); ?>
	</head>
	<body>
<?php
if ( empty( $link_cat ) ) { $cats = get_categories( array( 'taxonomy' => 'link_category', 'hierarchical' => 0, ) ); } else { $cats = get_categories( array( 'taxonomy' => 'link_category', 'hierarchical' => 0, 'include' => $link_cat, ) ); } foreach ( (array) $cats as $cat ) : $catname = apply_filters( 'link_category', $cat->name ); ?>
<outline type="category" title="<?php echo esc_attr( $catname ); ?>">
	<?php
 $bookmarks = get_bookmarks( array( 'category' => $cat->term_id ) ); foreach ( (array) $bookmarks as $bookmark ) : $title = apply_filters( 'link_title', $bookmark->link_name ); ?>
<outline text="<?php echo esc_attr( $title ); ?>" type="link" xmlUrl="<?php echo esc_url( $bookmark->link_rss ); ?>" htmlUrl="<?php echo esc_url( $bookmark->link_url ); ?>" updated="
							<?php
 if ( '0000-00-00 00:00:00' !== $bookmark->link_updated ) { echo $bookmark->link_updated;} ?>
" />
		<?php
 endforeach; ?>
</outline>
	<?php
endforeach; ?>
</body>
</opml>
