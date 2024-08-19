<?php
	/**
	 * This file exists so nginx invokes PHP and custom-redirects.php to give 
	 * us a chance to redirect the URI `/builder` to `/builder/builder.html`.
	 */
?>
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Navigate to the Blueprint Builder</title>
	<!--
		ATTENTION: We do not expect this file to be served.
		We expect the web server to redirect to the Blueprint Builder instead,
		but if it doesn't, this is a fallback.
	-->
	<meta http-equiv="refresh" content="0; url=builder.html">
</head>
<body>
	<a href="builder.html">Navigate to the Blueprint Builder.</a>
</body>
</html>
