import { PHPServer, PHPBrowser } from '@wordpress/php-wasm';
import * as phpModulesUrls from '@wordpress/php-wasm/build/web/vite-loaders.js';
import {
	initializeWorkerThread,
	loadPHPWithProgress,
	currentBackend,
	setURLScope,
} from '@wordpress/php-wasm/build/web/worker-thread';
import { DOCROOT, wordPressSiteUrl } from './config';
import { isUploadedFilePath } from './worker-utils';
import { getWordPressModuleUrl } from './wp-modules-urls';

const scope = Math.random().toFixed(16);
const scopedSiteUrl = setURLScope(wordPressSiteUrl, scope).toString();
	
startWordPress().then(({ browser, wpLoaderModule, staticAssetsDirectory }) =>
	initializeWorkerThread({
		phpBrowser: browser,
		middleware: (message, next) => {
			if (message.type === 'getWordPressModuleDetails') {
				return {
					staticAssetsDirectory,
					defaultTheme: wpLoaderModule.defaultThemeName,
				};
			}
			return next(message);
		},
	})
);

async function startWordPress() {
	// Expect underscore, not a dot. Vite doesn't deal well with the dot in the
	// parameters names passed to the worker via a query string.
	const requestedWPVersion = currentBackend.getOptions().dataModule || '6_1';
	const requestedPHPVersion = currentBackend.getOptions().phpVersion || '8_0';

	const [phpLoaderModule, wpLoaderModule] = await Promise.all([
		/**
		 * Vite is extremely stubborn and refuses to load the PHP loader modules
		 * when the import path is static. It fails with this error:
		 *
		 * [vite:worker] Invalid value "iife" for option "output.format" - UMD and IIFE output formats are not supported for code-splitting builds.
		 *
		 * It only works with a dynamic import, but then Vite complains that it
		 * can't find the module. So we have to use @vite-ignore to suppress the
		 * error.
		 */
		import(/* @vite-ignore */ getPHPModuleUrl(requestedPHPVersion)),
		import(/* @vite-ignore */ getWordPressModuleUrl(requestedWPVersion)),
	]);

	const php = await loadPHPWithProgress(phpLoaderModule, [wpLoaderModule]);

	new WordPressPatcher(php).patch();
	php.writeFile('/wordpress/phpinfo.php', '<?php phpinfo(); ');

	const server = new PHPServer(php, {
		documentRoot: DOCROOT,
		absoluteUrl: scopedSiteUrl,
		isStaticFilePath: isUploadedFilePath,
	});

	return {
		browser: new PHPBrowser(server),
		wpLoaderModule,
		staticAssetsDirectory: `wp-${requestedWPVersion.replace('_', '.')}`,
	};
}

function getPHPModuleUrl(version) {
	const key = 'php' + version;
	if (!(key in phpModulesUrls)) {
		throw new Error(`Unsupported PHP module: ${version}`);
	}
	return phpModulesUrls[key];
}

// @ts-ignore
import transportFetch from './mu-plugins/includes/requests_transport_fetch.php?raw';
// @ts-ignore
import transportDummy from './mu-plugins/includes/requests_transport_dummy.php?raw';
// @ts-ignore
import addRequests from './mu-plugins/add_requests_transport.php?raw';
// @ts-ignore
import showAdminCredentialsOnWpLogin from './mu-plugins/1-show-admin-credentials-on-wp-login.php?raw';

class WordPressPatcher {
	#php: PHP;
	constructor(php) {
		this.#php = php;
	}
	patch() {
		this.#adjustPathsAndUrls();
		this.#disableSiteHealth();
		this.#disableWpNewBlogNotification();
		this.#replaceRequestsTransports();
	}
	#adjustPathsAndUrls() {
		this.#patchFile(
			`${DOCROOT}/wp-config.php`,
			(contents) =>
				`${contents} define('WP_HOME', '${JSON.stringify(DOCROOT)}');`
		);

		// Force the site URL to be $scopedSiteUrl:
		// Interestingly, it doesn't work when put in a mu-plugin.
		this.#patchFile(
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
	}
	#disableSiteHealth() {
		this.#patchFile(
			`${DOCROOT}/wp-includes/default-filters.php`,
			(contents) =>
				contents.replace(
					/add_filter[^;]+wp_maybe_grant_site_health_caps[^;]+;/i,
					''
				)
		);
	}
	#disableWpNewBlogNotification() {
		this.#patchFile(
			`${DOCROOT}/wp-config.php`,
			// The original version of this function crashes WASM WordPress, let's define an empty one instead.
			(contents) =>
				`${contents} function wp_new_blog_notification(...$args){} `
		);
	}
	#replaceRequestsTransports() {
		this.#patchFile(
			`${DOCROOT}/wp-config.php`,
			(contents) => `${contents} define('USE_FETCH_FOR_REQUESTS', false);`
		);

		// Force the fsockopen and cUrl transports to report they don't work:
		const transports = [
			`${DOCROOT}/wp-includes/Requests/Transport/fsockopen.php`,
			`${DOCROOT}/wp-includes/Requests/Transport/cURL.php`,
		];
		for (const transport of transports) {
			// One of the transports might not exist in the latest WordPress version.
			if (!this.#php.fileExists(transport)) continue;
			this.#patchFile(transport, (contents) =>
				contents.replace(
					'public static function test',
					'public static function test( $capabilities = array() ) { return false; } public static function test2'
				)
			);
		}

		// Add fetch and dummy transports for HTTP requests
		this.#php.mkdirTree(`${DOCROOT}/wp-content/mu-plugins/includes`);
		this.#php.writeFile(
			`${DOCROOT}/wp-content/mu-plugins/includes/requests_transport_fetch.php`,
			transportFetch
		);
		this.#php.writeFile(
			`${DOCROOT}/wp-content/mu-plugins/includes/requests_transport_dummy.php`,
			transportDummy
		);
		this.#php.writeFile(
			`${DOCROOT}/wp-content/mu-plugins/add_requests_transport.php`,
			addRequests
		);

		// Various tweaks
		this.#php.writeFile(
			`${DOCROOT}/wp-content/mu-plugins/1-show-admin-credentials-on-wp-login.php`,
			showAdminCredentialsOnWpLogin
		);		
	}
	#patchFile(path, callback) {
		this.#php.writeFile(path, callback(this.#php.readFileAsText(path)));
	}
}
