<?php
/**
 * Add a notice to wp-login.php offering the username and password.
 */

add_action(
	'login_message',
	function() {
		return <<<EOT
<div class="message info">
	<strong>username:</strong> <code>admin</code><br /><strong>password</strong>: <code>password</code>
</div>
EOT;
	}
);
