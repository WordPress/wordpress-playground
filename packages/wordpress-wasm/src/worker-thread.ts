/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="WebWorker" />

declare const self: WorkerGlobalScope;
declare const require: any;

import { PHPServer, PHPBrowser } from 'php-wasm';
import {
	loadPHPWithProgress,
	initializeWorkerThread,
	setURLScope,
} from 'php-wasm-browser/worker-thread';
import { phpJsCacheBuster, wpJsCacheBuster, wordPressSiteUrl } from './config';
import { isUploadedFilePath } from './utils';

const scope = Math.random().toFixed(16);
const scopedSiteUrl = setURLScope(wordPressSiteUrl, scope).toString();
// Hardcoded in wp.js:
const DOCROOT = '/wordpress';

startWordPress().then((browser) =>
	initializeWorkerThread({
		phpBrowser: browser,
	})
);

async function startWordPress() {
	const [phpLoaderModule, wpLoaderModule] = await Promise.all([
		import(`/php.js?${phpJsCacheBuster}`),
		import(`/wp.js?${wpJsCacheBuster}`),
	]);

	const php = await loadPHPWithProgress(phpLoaderModule, [wpLoaderModule]);

	patchWordPressFiles(php);

	const server = new PHPServer(php, {
		documentRoot: DOCROOT,
		absoluteUrl: scopedSiteUrl,
		isStaticFilePath: isUploadedFilePath,
	});

	return new PHPBrowser(server);
}

function patchWordPressFiles(php) {
	function patchFile(path, callback) {
		php.writeFile(path, callback(php.readFileAsText(path)));
	}

	patchFile(
		`${DOCROOT}/wp-config.php`,
		(contents) =>
			contents +
			`
            define('USE_FETCH_FOR_REQUESTS', false);
            define('WP_HOME', '${JSON.stringify(DOCROOT)}');
            
            // The original version of this function crashes WASM WordPress, let's define an empty one instead.
            function wp_new_blog_notification(...$args){} 
        `
	);

	// Force the site URL to be $scopedSiteUrl:
	// Interestingly, it doesn't work when put in a mu-plugin.
	patchFile(
		`${DOCROOT}/wp-includes/plugin.php`,
		(contents) =>
			contents +
			`
            function _wasm_wp_force_site_url() {
                return ${JSON.stringify(scopedSiteUrl)};
            }
            add_filter( "option_home", '_wasm_wp_force_site_url', 10000 );
            add_filter( "option_siteurl", '_wasm_wp_force_site_url', 10000 );
        `
	);

	// Force the fsockopen and cUrl transports to report they don't work:
	const transports = [
		`${DOCROOT}/wp-includes/Requests/Transport/fsockopen.php`,
		`${DOCROOT}/wp-includes/Requests/Transport/cURL.php`,
	];
	for (const transport of transports) {
		patchFile(transport, (contents) =>
			contents.replace(
				'public static function test',
				'public static function test( $capabilities = array() ) { return false; } public static function test2'
			)
		);
	}

	// Disable site health:
	patchFile(`${DOCROOT}/wp-includes/default-filters.php`, (contents) =>
		contents.replace(
			/add_filter[^;]+wp_maybe_grant_site_health_caps[^;]+;/i,
			''
		)
	);

	// Add fetch() transport for HTTP requests
	php.mkdirTree(`${DOCROOT}/wp-content/mu-plugins`);
	php.writeFile(
		`${DOCROOT}/wp-content/mu-plugins/requests_transport_fetch.php`,
		require('./requests_transport_fetch.php')
	);
}
