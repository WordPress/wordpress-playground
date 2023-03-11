import type { PHP } from '@wordpress/php-wasm';
import { PHPProtocolHandler, PHPServer, PHPBrowser, getPHPLoaderModule } from '@wordpress/php-wasm';
import {
	loadPHP,
	incomingMessageLink,
	setURLScope,
} from '@wordpress/php-wasm/web/worker-thread';
import { DOCROOT, wordPressSiteUrl } from './config';
import { isUploadedFilePath } from './worker-utils';
import { getWordPressModule } from './wp-modules-urls';

const scope = Math.random().toFixed(16);
const scopedSiteUrl = setURLScope(wordPressSiteUrl, scope).toString();

async function startWordPress() {
	// Expect underscore, not a dot. Vite doesn't deal well with the dot in the
	// parameters names passed to the worker via a query string.
	const requestedWPVersion = incomingMessageLink.getOption('dataModule', '6_1').replace('_','.');
	const requestedPHPVersion = incomingMessageLink.getOption('phpVersion', '8_0').replace('_','.');

	const [phpLoaderModule, wpLoaderModule] = await Promise.all([
		getPHPLoaderModule(requestedPHPVersion),
		getWordPressModule(requestedWPVersion),
	]);

	const php = await loadPHP(phpLoaderModule, [wpLoaderModule]);
	WordPressPatcher.patch(php);

	const server = new PHPServer(php, {
		documentRoot: DOCROOT,
		absoluteUrl: scopedSiteUrl,
		isStaticFilePath: isUploadedFilePath,
	});

	const browser = new PHPBrowser(server);
	incomingMessageLink.setHandler(new WordPressProtocolHandler(browser, {
		staticAssetsDirectory: `wp-${requestedWPVersion.replace('_', '.')}`,
		defaultTheme: wpLoaderModule.defaultThemeName,
	}));
}

startWordPress();

type WPDetails = {
	staticAssetsDirectory: string;
	defaultTheme: string;
};
class WordPressProtocolHandler extends PHPProtocolHandler {
	#wpDetails: WPDetails;

	constructor(phpBrowser: PHPBrowser, wpDetails: WPDetails) {
		super(phpBrowser);
		this.#wpDetails = wpDetails;
	}
	
	getWordPressModuleDetails() {
		return this.#wpDetails;
	}
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
	
	static patch(php) {
		php.writeFile('/wordpress/phpinfo.php', '<?php phpinfo(); ');
		new WordPressPatcher(php).patch();
	}

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
