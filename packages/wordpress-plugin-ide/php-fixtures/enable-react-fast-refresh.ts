const PLAYGROUND_HMR_PHP = `<?php 

/**
 * React fast refresh runtime, required for hot reloading. Must be
 * included before any other scripts.
 */
function __playground_enqueue_react_fast_refresh() {
		wp_register_script( '__playground_react_fast_refresh', '/setup-fast-refresh-runtime.js', false, '1.0.0' );
		wp_enqueue_script( '__playground_react_fast_refresh' );
}
add_action( 'init', '__playground_enqueue_react_fast_refresh', 10000 );

function __playground_override_react_dom($scripts) {
	__playground_override_script($scripts, 'react', '/react.development.js');
	__playground_override_script($scripts, 'react-dom', '/react-dom.development.js');
}
add_action( 'wp_default_scripts', '__playground_override_react_dom' );

function __playground_override_script( $scripts, $handle, $src, $deps = array(), $ver = false, $in_footer = false ) {
	$in_footer = 'wp-i18n' === $handle ? false : $in_footer;
	$script = $scripts->query( $handle, 'registered' );
	
	if ( $script ) {
		$script->src  = $src;
		$script->deps = $deps;
		$script->ver  = $ver;
		$script->args = $in_footer ? 1 : null;
	} else {
		$scripts->add( $handle, $src, $deps, $ver, ( $in_footer ? 1 : null ) );
	}
}
`;

export default {
	name: 'react-fast-refresh',
	files: [{ fileName: 'index.php', contents: PLAYGROUND_HMR_PHP }],
};
