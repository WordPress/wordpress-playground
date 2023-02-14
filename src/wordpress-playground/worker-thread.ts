declare const self: WorkerGlobalScope;
declare const require: any;

import { PHPServer, PHPBrowser } from '../php-wasm';
import type { PHP } from '../php-wasm';
import {
	initializeWorkerThread,
	loadPHPWithProgress,
	currentBackend,
	setURLScope,
} from '../php-wasm-browser/worker-thread/worker-library';
import { phpJsCacheBuster, wpJsCacheBuster, wordPressSiteUrl } from './config';
import { isUploadedFilePath } from './worker-utils';

const scope = Math.random().toFixed(16);
const scopedSiteUrl = setURLScope(wordPressSiteUrl, scope).toString();
// Hardcoded in wp.js:
const DOCROOT = '/wordpress';

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
	const [phpLoaderModule, wpLoaderModule] = await Promise.all([
		import(`/${getRequestedPHPModule()}?${phpJsCacheBuster}`),
		import(`/${getRequestedDataModule()}.js?${wpJsCacheBuster}`),
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
		staticAssetsDirectory: getRequestedDataModule(),
	};
}

function getRequestedPHPModule() {
	const phpVersions = {
		'5.6': 'php-5.6.js',
		'7.0': 'php-7.0.js',
		'7.1': 'php-7.1.js',
		'7.2': 'php-7.2.js',
		'7.3': 'php-7.3.js',
		'7.4': 'php-7.4.js',
		'8.0': 'php-8.0.js',
		'8.1': 'php-8.1.js',
		'8.2': 'php-8.2.js',
	};
	const requestedVersion = currentBackend.getOptions().phpVersion || '8.0';
	if (!(requestedVersion in phpVersions)) {
		throw new Error(`Unsupported PHP version: ${requestedVersion}`);
	}
	return phpVersions[requestedVersion];
}

function getRequestedDataModule() {
	const allowedWpModules = {
		'5.9': 'wp-5.9',
		'6.0': 'wp-6.0',
		'6.1': 'wp-6.1',
		nightly: 'wp-nightly',
	};
	const requestedDataModule = currentBackend.getOptions().dataModule || '6.1';
	if (!(requestedDataModule in allowedWpModules)) {
		throw new Error(`Unsupported WordPress module: ${requestedDataModule}`);
	}
	return allowedWpModules[requestedDataModule];
}

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
			require('./mu-plugins/includes/requests_transport_fetch.php')
		);
		this.#php.writeFile(
			`${DOCROOT}/wp-content/mu-plugins/includes/requests_transport_dummy.php`,
			require('./mu-plugins/includes/requests_transport_dummy.php')
		);
		this.#php.writeFile(
			`${DOCROOT}/wp-content/mu-plugins/add_requests_transport.php`,
			require('./mu-plugins/add_requests_transport.php')
		);
		// Various random hacks
		this.#php.writeFile(
			`${DOCROOT}/wp-content/mu-plugins/my-hacks.php`,
			require('./mu-plugins/my-hacks.php')
		);
	}
	#patchFile(path, callback) {
		this.#php.writeFile(path, callback(this.#php.readFileAsText(path)));
	}
}
