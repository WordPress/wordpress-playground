<?php
 _deprecated_file( sprintf( __( 'Theme without %s' ), basename( __FILE__ ) ), '3.0.0', null, sprintf( __( 'Please include a %s template in your theme.' ), basename( __FILE__ ) ) ); ?>

<hr />
<div id="footer" role="contentinfo">
<!-- If you'd like to support WordPress, having the "powered by" link somewhere on your blog is the best way; it's our only promotion or advertising. -->
	<p>
		<?php
 printf( __( '%1$s is proudly powered by %2$s' ), get_bloginfo( 'name' ), '<a href="https://wordpress.org/">WordPress</a>' ); ?>
	</p>
</div>
</div>

<!-- Gorgeous design by Michael Heilemann - http://binarybonsai.com/ -->
<?php  ?>

		<?php wp_footer(); ?>
</body>
</html>
