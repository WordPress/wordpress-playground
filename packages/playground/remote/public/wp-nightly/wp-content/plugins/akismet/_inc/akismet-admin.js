jQuery( function ( $ ) {
	$( document ).ready(function() {		
		// Main settings form - enable submit button when something in the form is changed
		var submitButton = $( '#akismet-settings-form #submit' );

		submitButton.prop( 'disabled', true );
		
		$( '#akismet-settings-form input' ).change( function() {
			submitButton.prop( 'disabled', false );
		} );
		
		$( '#akismet-settings-form input[type="text"]' ).keyup( function() {
			submitButton.prop( 'disabled', false );
		} );

		// Prevent aggressive iframe caching in Firefox
		var statsIframe = document.getElementById( 'stats-iframe' );
		if ( statsIframe ) {
			statsIframe.contentWindow.location.href = statsIframe.src;
		}
	});	 
} );