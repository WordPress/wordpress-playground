<?php
 define( 'XMLRPC_REQUEST', true ); $_COOKIE = array(); if ( ! isset( $HTTP_RAW_POST_DATA ) ) { $HTTP_RAW_POST_DATA = file_get_contents( 'php://input' ); } if ( isset( $HTTP_RAW_POST_DATA ) ) { $HTTP_RAW_POST_DATA = trim( $HTTP_RAW_POST_DATA ); } require_once __DIR__ . '/wp-load.php'; if ( isset( $_GET['rsd'] ) ) { header( 'Content-Type: text/xml; charset=' . get_option( 'blog_charset' ), true ); echo '<?xml version="1.0" encoding="' . get_option( 'blog_charset' ) . '"?' . '>'; ?>
<rsd version="1.0" xmlns="http://archipelago.phrasewise.com/rsd">
	<service>
		<engineName>WordPress</engineName>
		<engineLink>https://wordpress.org/</engineLink>
		<homePageLink><?php bloginfo_rss( 'url' ); ?></homePageLink>
		<apis>
			<api name="WordPress" blogID="1" preferred="true" apiLink="<?php echo site_url( 'xmlrpc.php', 'rpc' ); ?>" />
			<api name="Movable Type" blogID="1" preferred="false" apiLink="<?php echo site_url( 'xmlrpc.php', 'rpc' ); ?>" />
			<api name="MetaWeblog" blogID="1" preferred="false" apiLink="<?php echo site_url( 'xmlrpc.php', 'rpc' ); ?>" />
			<api name="Blogger" blogID="1" preferred="false" apiLink="<?php echo site_url( 'xmlrpc.php', 'rpc' ); ?>" />
			<?php
 do_action( 'xmlrpc_rsd_apis' ); ?>
		</apis>
	</service>
</rsd>
	<?php
 exit; } require_once ABSPATH . 'wp-admin/includes/admin.php'; require_once ABSPATH . WPINC . '/class-IXR.php'; require_once ABSPATH . WPINC . '/class-wp-xmlrpc-server.php'; $post_default_title = ''; $wp_xmlrpc_server_class = apply_filters( 'wp_xmlrpc_server_class', 'wp_xmlrpc_server' ); $wp_xmlrpc_server = new $wp_xmlrpc_server_class; $wp_xmlrpc_server->serve_request(); exit; function logIO( $io, $msg ) { _deprecated_function( __FUNCTION__, '3.4.0', 'error_log()' ); if ( ! empty( $GLOBALS['xmlrpc_logging'] ) ) { error_log( $io . ' - ' . $msg ); } } 