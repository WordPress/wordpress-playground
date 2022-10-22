
import { PHPServer, PHPBrowser } from 'php-wasm';
import { initializeWorkerThread } from 'php-wasm-browser';
import { phpWasmCacheBuster, wpDataCacheBuster, phpWebWasmSize, wpDataSize } from './config';
import { isUploadedFilePath } from './';

// Hardcoded in wp.js. @TODO make this configurable.
const DOCROOT = '/wordpress';

initializeWorkerThread({
    assetsSizes: {
        'php.wasm': phpWebWasmSize,
        'wp.data': wpDataSize,
    },
    locateFile: (file) => {
        if (
            file.endsWith('php.wasm') ||
            file.endsWith('php-web.js') ||
            file.endsWith('php-webworker.js')
        ) {
            return `${file}?${phpWasmCacheBuster}`;
        } else if (
            file.endsWith('wp.data') ||
            file.endsWith('wp.js')
        ) {
            return `${file}?${wpDataCacheBuster}`;
        }
        return file;
    },
    bootBrowser: async ({ php, workerEnv, message }) => {
        await loadWordPress({ php, workerEnv });
        patchWordPressFiles(php, message.absoluteUrl);

        const server = new PHPServer(php, {
            documentRoot: DOCROOT,
            absoluteUrl: message.absoluteUrl,
            isStaticFilePath: isUploadedFilePath,
            beforeRequest: () => `
                define('USE_FETCH_FOR_REQUESTS', false);
                define('WP_HOME', '${DOCROOT}');
                // The original version of this function crashes WASM WordPress, let's define an empty one instead.
                function wp_new_blog_notification(...$args){} 
            `
        });
        
        return new PHPBrowser(server);
    },
});

async function loadWordPress({ php, workerEnv }) {
    // The name PHPModule is baked into wp.js
    globalThis.PHPModule = php.PHPModule;
    // eslint-disable-next-line no-undef
    workerEnv.importScripts('/wp.js');
    await php.awaitDataDependencies();
}

function patchWordPressFiles(php, absoluteUrl) {
    // @TODO: do this via JavaScript
    const result = php.run(`<?php
    file_put_contents( "${DOCROOT}/.absolute-url", "${absoluteUrl}" );
    if ( ! file_exists( "${DOCROOT}/.wordpress-patched" ) ) {
        // Patching WordPress in the worker provides a faster feedback loop than
        // rebuilding it every time. Follow the example below to patch WordPress
        // before the first request is dispatched:
        //
        // file_put_contents(
        // 	'${DOCROOT}/wp-content/db.php',
        // 	str_replace(
        // 		'$exploded_parts = $values_data;',
        // 		'$exploded_parts = array( $values_data );',
        // 		file_get_contents('${DOCROOT}/wp-content/db.php')
        // 	)
        // );

        // WORKAROUND:
        // For some reason, the in-browser WordPress doesn't respect the site
        // URL preset during the installation. Also, it disables the block editing
        // experience by default.
        file_put_contents(
            '${DOCROOT}/wp-includes/plugin.php',
            file_get_contents('${DOCROOT}/wp-includes/plugin.php') . "\n"
            .'add_filter( "option_home", function($url) { return getenv("HOST") ?: file_get_contents(__DIR__ . "/../.absolute-url"); }, 10000 );' . "\n"
            .'add_filter( "option_siteurl", function($url) { return getenv("HOST") ?: file_get_contents(__DIR__."/../.absolute-url"); }, 10000 );' . "\n"
        );

        // DISABLE SITE HEALTH:
        file_put_contents(
            '${DOCROOT}/wp-includes/default-filters.php',
            preg_replace(
                '!add_filter[^;]+wp_maybe_grant_site_health_caps[^;]+;!i',
                '',
                file_get_contents('${DOCROOT}/wp-includes/default-filters.php')
            )
        );

        // WORKAROUND:
        // The fsockopen transport erroneously reports itself as a working transport. Let's force
        // it to report it won't work.
        file_put_contents(
            '${DOCROOT}/wp-includes/Requests/Transport/fsockopen.php',
            str_replace(
                'public static function test',
                'public static function test( $capabilities = array() ) { return false; } public static function test2',
                file_get_contents( '${DOCROOT}/wp-includes/Requests/Transport/fsockopen.php' )
            )
        );
        file_put_contents(
            '${DOCROOT}/wp-includes/Requests/Transport/cURL.php',
            str_replace(
                'public static function test',
                'public static function test( $capabilities = array() ) { return false; } public static function test2',
                file_get_contents( '${DOCROOT}/wp-includes/Requests/Transport/cURL.php' )
            )
        );
        
        mkdir( '${DOCROOT}/wp-content/mu-plugins' );
        file_put_contents(
            '${DOCROOT}/wp-content/mu-plugins/requests_transport_fetch.php',
<<<'PATCH'
<?php
class Requests_Transport_Fetch implements Requests_Transport { public $headers = ''; public function __construct() { } public function __destruct() { } public function request( $url, $headers = array(), $data = array(), $options = array() ) { if ( str_contains( $url, '/wp-cron.php' ) ) { return false; } $headers = Requests::flatten( $headers ); if ( ! empty( $data ) ) { $data_format = $options['data_format']; if ( $data_format === 'query' ) { $url = self::format_get( $url, $data ); $data = ''; } elseif ( ! is_string( $data ) ) { $data = http_build_query( $data, null, '&' ); } } $request = json_encode( json_encode( array( 'headers' => $headers, 'data' => $data, 'url' => $url, 'method' => $options['type'], ) ) );
$js = <<<JAVASCRIPT
const request = JSON.parse({$request});
console.log("Requesting " + request.url);
const xhr = new XMLHttpRequest();
xhr.open(
request.method,
request.url,
false // false makes the xhr synchronous
);
xhr.withCredentials = false;
for ( var name in request.headers ) {
if(name.toLowerCase() !== "content-type") {
// xhr.setRequestHeader(name, request.headers[name]);
}
}
xhr.send(request.data);

[
"HTTP/1.1 " + xhr.status + " " + xhr.statusText,
xhr.getAllResponseHeaders(),
"",
xhr.responseText
].join("\\\\r\\\\n");
JAVASCRIPT;
$this->headers = vrzno_eval( $js ); return $this->headers; } public function request_multiple( $requests, $options ) { $responses = array(); $class = get_class( $this ); foreach ( $requests as $id => $request ) { try { $handler = new $class(); $responses[ $id ] = $handler->request( $request['url'], $request['headers'], $request['data'], $request['options'] ); $request['options']['hooks']->dispatch( 'transport.internal.parse_response', array( &$responses[ $id ], $request ) ); } catch ( Requests_Exception $e ) { $responses[ $id ] = $e; } if ( ! is_string( $responses[ $id ] ) ) { $request['options']['hooks']->dispatch( 'multiple.request.complete', array( &$responses[ $id ], $id ) ); } } return $responses; } protected static function format_get( $url, $data ) { if ( ! empty( $data ) ) { $query = ''; $url_parts = parse_url( $url ); if ( empty( $url_parts['query'] ) ) { $url_parts['query'] = ''; } else { $query = $url_parts['query']; } $query .= '&' . http_build_query( $data, null, '&' ); $query = trim( $query, '&' ); if ( empty( $url_parts['query'] ) ) { $url .= '?' . $query; } else { $url = str_replace( $url_parts['query'], $query, $url ); } } return $url; } public static function test( $capabilities = array() ) { if ( ! function_exists( 'vrzno_eval' ) ) { return false; } if ( vrzno_eval( "typeof XMLHttpRequest;" ) !== 'function' ) {  return false; } return true; } }

if(defined('USE_FETCH_FOR_REQUESTS') && USE_FETCH_FOR_REQUESTS) {
Requests::add_transport( 'Requests_Transport_Fetch' );
}
PATCH
        );

        if ( false ) {
            // Activate the development plugin.
            $file_php_path = '${DOCROOT}/wp-includes/functions.php';
            $file_php = file_get_contents($file_php_path);

            if (strpos($file_php, "start-test-snippet") !== false) {
                $file_php = substr($file_php, 0, strpos($file_php, "// start-test-snippet"));
            }

            $file_php .= <<<'ADMIN'
                // start-test-snippet
                add_action('init', function() {
                    require_once '${DOCROOT}/wp-admin/includes/plugin.php';
                    $plugin = 'my-plugin/my-plugin.php';
                    if(!is_plugin_active($plugin)) {
                        $result = activate_plugin( $plugin, '', is_network_admin() );
                        if ( is_wp_error( $result ) ) {
                            if ( 'unexpected_output' === $result->get_error_code() ) {
                                var_dump($result->get_error_data());
                                die();
                            } else {
                                wp_die( $result );
                            }
                        }
                    }
                });
                // end-test-snippet
ADMIN;

            file_put_contents(
                $file_php_path,
                $file_php
            );
        }
        touch("${DOCROOT}/.wordpress-patched");
    }
`);
    if (result.exitCode !== 0) {
        throw new Error(
            {
                message: 'WordPress setup failed',
                result,
            },
            result.exitCode
        );
    }
}
