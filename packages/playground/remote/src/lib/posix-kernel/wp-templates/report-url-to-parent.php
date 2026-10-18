<?php
/**
 * Reports the current URL to the parent frame for Playground's browser
 * --experimental-posix-kernel mode. Mirrors playground_report_url_to_parent()
 * in the classic 0-playground.php mu-plugin. Document-Isolation-Policy
 * blocks the parent from reading the iframe's location.href.
 */
function playground_report_url_to_parent() {
	?>
	<script>
		if (window.parent !== window) {
			window.parent.postMessage(
				JSON.stringify({
					type: 'playground-url-change',
					url: window.location.href
				}),
				'*'
			);
		}
	</script>
	<?php
}
add_action('wp_head', 'playground_report_url_to_parent');
add_action('admin_head', 'playground_report_url_to_parent');
