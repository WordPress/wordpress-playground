document.addEventListener( 'DOMContentLoaded', function() {
	// Prevent aggressive iframe caching in Firefox
	var statsIframe = document.getElementById( 'stats-iframe' );
	if ( statsIframe ) {
		statsIframe.contentWindow.location.href = statsIframe.src;
	}
} );