<?php
 header( 'Content-Type: ' . get_option( 'html_type' ) . '; charset=' . get_option( 'blog_charset' ) ); if ( ! defined( 'WP_ADMIN' ) ) { require_once __DIR__ . '/admin.php'; } global $title, $hook_suffix, $current_screen, $wp_locale, $pagenow, $update_title, $total_update_count, $parent_file, $typenow; if ( empty( $current_screen ) ) { set_current_screen(); } get_admin_page_title(); $title = strip_tags( $title ); if ( is_network_admin() ) { $admin_title = sprintf( __( 'Network Admin: %s' ), get_network()->site_name ); } elseif ( is_user_admin() ) { $admin_title = sprintf( __( 'User Dashboard: %s' ), get_network()->site_name ); } else { $admin_title = get_bloginfo( 'name' ); } if ( $admin_title === $title ) { $admin_title = sprintf( __( '%s &#8212; WordPress' ), $title ); } else { $screen_title = $title; if ( 'post' === $current_screen->base && 'add' !== $current_screen->action ) { $post_title = get_the_title(); if ( ! empty( $post_title ) ) { $post_type_obj = get_post_type_object( $typenow ); $screen_title = sprintf( __( '%1$s &#8220;%2$s&#8221;' ), $post_type_obj->labels->edit_item, $post_title ); } } $admin_title = sprintf( __( '%1$s &lsaquo; %2$s &#8212; WordPress' ), $screen_title, $admin_title ); } if ( wp_is_recovery_mode() ) { $admin_title = sprintf( __( 'Recovery Mode &#8212; %s' ), $admin_title ); } $admin_title = apply_filters( 'admin_title', $admin_title, $title ); wp_user_settings(); _wp_admin_html_begin(); ?>
<title><?php echo esc_html( $admin_title ); ?></title>
<?php
 wp_enqueue_style( 'colors' ); wp_enqueue_script( 'utils' ); wp_enqueue_script( 'svg-painter' ); $admin_body_class = preg_replace( '/[^a-z0-9_-]+/i', '-', $hook_suffix ); ?>
<script type="text/javascript">
addLoadEvent = function(func){if(typeof jQuery!=='undefined')jQuery(function(){func();});else if(typeof wpOnload!=='function'){wpOnload=func;}else{var oldonload=wpOnload;wpOnload=function(){oldonload();func();}}};
var ajaxurl = '<?php echo esc_js( admin_url( 'admin-ajax.php', 'relative' ) ); ?>',
	pagenow = '<?php echo esc_js( $current_screen->id ); ?>',
	typenow = '<?php echo esc_js( $current_screen->post_type ); ?>',
	adminpage = '<?php echo esc_js( $admin_body_class ); ?>',
	thousandsSeparator = '<?php echo esc_js( $wp_locale->number_format['thousands_sep'] ); ?>',
	decimalPoint = '<?php echo esc_js( $wp_locale->number_format['decimal_point'] ); ?>',
	isRtl = <?php echo (int) is_rtl(); ?>;
</script>
<?php
 do_action( 'admin_enqueue_scripts', $hook_suffix ); do_action( "admin_print_styles-{$hook_suffix}" ); do_action( 'admin_print_styles' ); do_action( "admin_print_scripts-{$hook_suffix}" ); do_action( 'admin_print_scripts' ); do_action( "admin_head-{$hook_suffix}" ); do_action( 'admin_head' ); if ( 'f' === get_user_setting( 'mfold' ) ) { $admin_body_class .= ' folded'; } if ( ! get_user_setting( 'unfold' ) ) { $admin_body_class .= ' auto-fold'; } if ( is_admin_bar_showing() ) { $admin_body_class .= ' admin-bar'; } if ( is_rtl() ) { $admin_body_class .= ' rtl'; } if ( $current_screen->post_type ) { $admin_body_class .= ' post-type-' . $current_screen->post_type; } if ( $current_screen->taxonomy ) { $admin_body_class .= ' taxonomy-' . $current_screen->taxonomy; } $admin_body_class .= ' branch-' . str_replace( array( '.', ',' ), '-', (float) get_bloginfo( 'version' ) ); $admin_body_class .= ' version-' . str_replace( '.', '-', preg_replace( '/^([.0-9]+).*/', '$1', get_bloginfo( 'version' ) ) ); $admin_body_class .= ' admin-color-' . sanitize_html_class( get_user_option( 'admin_color' ), 'fresh' ); $admin_body_class .= ' locale-' . sanitize_html_class( strtolower( str_replace( '_', '-', get_user_locale() ) ) ); if ( wp_is_mobile() ) { $admin_body_class .= ' mobile'; } if ( is_multisite() ) { $admin_body_class .= ' multisite'; } if ( is_network_admin() ) { $admin_body_class .= ' network-admin'; } $admin_body_class .= ' no-customize-support no-svg'; if ( $current_screen->is_block_editor() ) { $admin_body_class .= ' block-editor-page wp-embed-responsive'; } $error_get_last = error_get_last(); if ( $error_get_last && WP_DEBUG && WP_DEBUG_DISPLAY && ini_get( 'display_errors' ) && ( E_NOTICE !== $error_get_last['type'] || 'wp-config.php' !== wp_basename( $error_get_last['file'] ) ) ) { $admin_body_class .= ' php-error'; } unset( $error_get_last ); ?>
</head>
<?php
 $admin_body_classes = apply_filters( 'admin_body_class', '' ); $admin_body_classes = ltrim( $admin_body_classes . ' ' . $admin_body_class ); ?>
<body class="wp-admin wp-core-ui no-js <?php echo $admin_body_classes; ?>">
<script type="text/javascript">
	document.body.className = document.body.className.replace('no-js','js');
</script>

<?php
if ( current_user_can( 'customize' ) ) { wp_customize_support_script(); } ?>

<div id="wpwrap">
<?php require ABSPATH . 'wp-admin/menu-header.php'; ?>
<div id="wpcontent">

<?php
 do_action( 'in_admin_header' ); ?>

<div id="wpbody" role="main">
<?php
unset( $blog_name, $total_update_count, $update_title ); $current_screen->set_parentage( $parent_file ); ?>

<div id="wpbody-content">
<?php
 $current_screen->render_screen_meta(); if ( is_network_admin() ) { do_action( 'network_admin_notices' ); } elseif ( is_user_admin() ) { do_action( 'user_admin_notices' ); } else { do_action( 'admin_notices' ); } do_action( 'all_admin_notices' ); if ( 'options-general.php' === $parent_file ) { require ABSPATH . 'wp-admin/options-head.php'; } 