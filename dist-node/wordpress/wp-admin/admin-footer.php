<?php
 if ( ! defined( 'ABSPATH' ) ) { die( '-1' ); } global $hook_suffix; ?>

<div class="clear"></div></div><!-- wpbody-content -->
<div class="clear"></div></div><!-- wpbody -->
<div class="clear"></div></div><!-- wpcontent -->

<div id="wpfooter" role="contentinfo">
	<?php
 do_action( 'in_admin_footer' ); ?>
	<p id="footer-left" class="alignleft">
		<?php
 $text = sprintf( __( 'Thank you for creating with <a href="%s">WordPress</a>.' ), __( 'https://wordpress.org/' ) ); echo apply_filters( 'admin_footer_text', '<span id="footer-thankyou">' . $text . '</span>' ); ?>
	</p>
	<p id="footer-upgrade" class="alignright">
		<?php
 echo apply_filters( 'update_footer', '' ); ?>
	</p>
	<div class="clear"></div>
</div>
<?php
 do_action( 'admin_footer', '' ); do_action( "admin_print_footer_scripts-{$hook_suffix}" ); do_action( 'admin_print_footer_scripts' ); do_action( "admin_footer-{$hook_suffix}" ); if ( function_exists( 'get_site_option' ) && false === get_site_option( 'can_compress_scripts' ) ) { compression_test(); } ?>

<div class="clear"></div></div><!-- wpwrap -->
<script type="text/javascript">if(typeof wpOnload==='function')wpOnload();</script>
</body>
</html>
