import { pathJoin } from '../runnable-code-snippets/fs-utils';

export default async function enableHMRinWordPress(
	workerThread,
	muPluginsPath
) {
	await workerThread.writeFile(
		pathJoin(muPluginsPath, '_sandbox_hmr.php'),
		`<?php 
			/**
			 * React fast refresh runtime, required for hot reloading. Must be
			 * included before any other scripts.
			 */
			function __sandbox_enqueue_react_fast_refresh() {
					wp_register_script( '__sandbox_react_fast_refresh', '/setup-fast-refresh-runtime.js', false, '1.0.0' );
					wp_enqueue_script( '__sandbox_react_fast_refresh' );
			}
			add_action( 'init', '__sandbox_enqueue_react_fast_refresh', 10000 );

			function __sandbox_override_react_dom($scripts) {
				__sandbox_override_script($scripts, 'react', '/react-17.dev.js');
				__sandbox_override_script($scripts, 'react-dom', '/react-dom-17.dev.js');
			}
			add_action( 'wp_default_scripts', '__sandbox_override_react_dom' );

			function __sandbox_override_script( $scripts, $handle, $src, $deps = array(), $ver = false, $in_footer = false ) {
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
			`
	);
}
