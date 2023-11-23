import { UniversalPHP } from '@php-wasm/universal';
import { StepHandler } from '..';
import { updateFile } from '../common';
import { defineWpConfigConsts } from '../define-wp-config-consts';

/** @ts-ignore */
import transportFetch from './wp-content/mu-plugins/playground-includes/requests_transport_fetch.php?raw';
/** @ts-ignore */
import transportDummy from './wp-content/mu-plugins/playground-includes/requests_transport_dummy.php?raw';
/** @ts-ignore */
import playgroundMuPlugin from './wp-content/mu-plugins/0-playground.php?raw';

/**
 * @private
 */
export interface ApplyWordPressPatchesStep {
	step: 'applyWordPressPatches';
	siteUrl?: string;
	wordpressPath?: string;
	addPhpInfo?: boolean;
	patchSecrets?: boolean;
	disableSiteHealth?: boolean;
	disableWpNewBlogNotification?: boolean;
	makeEditorFrameControlled?: boolean;
	prepareForRunningInsideWebBrowser?: boolean;
	addFetchNetworkTransport?: boolean;
}

export const applyWordPressPatches: StepHandler<
	ApplyWordPressPatchesStep
> = async (php, options) => {
	const patch = new WordPressPatcher(
		php,
		options.wordpressPath || '/wordpress',
		options.siteUrl
	);

	if (options.addPhpInfo === true) {
		await patch.addPhpInfo();
	}
	if (options.siteUrl) {
		await patch.patchSiteUrl();
	}
	if (options.patchSecrets === true) {
		await patch.patchSecrets();
	}
	if (options.disableSiteHealth === true) {
		await patch.disableSiteHealth();
	}
	if (options.disableWpNewBlogNotification === true) {
		await patch.disableWpNewBlogNotification();
	}
	if (options.makeEditorFrameControlled === true) {
		await makeEditorFrameControlled(php, patch.wordpressPath, [
			`${patch.wordpressPath}/wp-includes/js/dist/block-editor.js`,
			`${patch.wordpressPath}/wp-includes/js/dist/block-editor.min.js`,
		]);
	}
	if (options.prepareForRunningInsideWebBrowser === true) {
		await patch.prepareForRunningInsideWebBrowser();
	}
	if (options.addFetchNetworkTransport === true) {
		await patch.addFetchNetworkTransport();
	}
};

class WordPressPatcher {
	php: UniversalPHP;
	scopedSiteUrl?: string;
	wordpressPath: string;

	constructor(
		php: UniversalPHP,
		wordpressPath: string,
		scopedSiteUrl?: string
	) {
		this.php = php;
		this.scopedSiteUrl = scopedSiteUrl;
		this.wordpressPath = wordpressPath;
	}

	async addPhpInfo() {
		await this.php.writeFile(
			`${this.wordpressPath}/phpinfo.php`,
			'<?php phpinfo(); '
		);
	}

	async patchSiteUrl() {
		await defineWpConfigConsts(this.php, {
			consts: {
				WP_HOME: this.scopedSiteUrl,
				WP_SITEURL: this.scopedSiteUrl,
			},
		});
	}

	async patchSecrets() {
		await defineWpConfigConsts(this.php, {
			consts: {
				AUTH_KEY: randomString(40),
				SECURE_AUTH_KEY: randomString(40),
				LOGGED_IN_KEY: randomString(40),
				NONCE_KEY: randomString(40),
				AUTH_SALT: randomString(40),
				SECURE_AUTH_SALT: randomString(40),
				LOGGED_IN_SALT: randomString(40),
				NONCE_SALT: randomString(40),
			},
		});
		await updateFile(
			this.php,
			`${this.wordpressPath}/wp-config.php`,
			(contents) =>
				contents.replaceAll(
					/',\s+'put your unique phrase here'/g,
					"__', ''"
				)
		);
	}

	async disableSiteHealth() {
		await updateFile(
			this.php,
			`${this.wordpressPath}/wp-includes/default-filters.php`,
			(contents) =>
				contents.replace(
					/add_filter[^;]+wp_maybe_grant_site_health_caps[^;]+;/i,
					''
				)
		);
	}

	async disableWpNewBlogNotification() {
		await updateFile(
			this.php,
			`${this.wordpressPath}/wp-config.php`,
			// The original version of this function crashes WASM PHP, let's define an empty one instead.
			(contents) =>
				`${contents} function wp_new_blog_notification(...$args){} `
		);
	}

	async prepareForRunningInsideWebBrowser() {
		// Various tweaks
		await this.php.mkdir(`${this.wordpressPath}/wp-content/mu-plugins`);
		await this.php.writeFile(
			`${this.wordpressPath}/wp-content/mu-plugins/0-playground.php`,
			playgroundMuPlugin
		);
	}

	async addFetchNetworkTransport() {
		await defineWpConfigConsts(this.php, {
			consts: {
				USE_FETCH_FOR_REQUESTS: true,
			},
		});

		// Force the fsockopen and cUrl transports to report they don't work:
		const transports = [
			`${this.wordpressPath}/wp-includes/Requests/Transport/fsockopen.php`,
			`${this.wordpressPath}/wp-includes/Requests/Transport/cURL.php`,
			`${this.wordpressPath}/wp-includes/Requests/src/Transport/Fsockopen.php`,
			`${this.wordpressPath}/wp-includes/Requests/src/Transport/Curl.php`,
		];
		for (const transport of transports) {
			// One of the transports might not exist in the latest WordPress version.
			if (!(await this.php.fileExists(transport))) {
				continue;
			}
			await updateFile(this.php, transport, (contents) =>
				contents.replace(
					'public static function test',
					'public static function test( $capabilities = array() ) { return false; } public static function test2'
				)
			);
		}

		// Add fetch and dummy transports for HTTP requests
		await this.php.mkdir(
			`${this.wordpressPath}/wp-content/mu-plugins/playground-includes`
		);
		await this.php.writeFile(
			`${this.wordpressPath}/wp-content/mu-plugins/playground-includes/requests_transport_fetch.php`,
			transportFetch
		);
		await this.php.writeFile(
			`${this.wordpressPath}/wp-content/mu-plugins/playground-includes/requests_transport_dummy.php`,
			transportDummy
		);
		await this.php.mkdir(`${this.wordpressPath}/wp-content/fonts`);
	}
}

function randomString(length: number) {
	const chars =
		'0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+=-[]/.,<>?';
	let result = '';
	for (let i = length; i > 0; --i)
		result += chars[Math.floor(Math.random() * chars.length)];
	return result;
}

/**
 *
 * Pair the site editor's nested iframe to the Service Worker.
 *
 * Without the patch below, the site editor initiates network requests that
 * aren't routed through the service worker. That's a known browser issue:
 *
 * * https://bugs.chromium.org/p/chromium/issues/detail?id=880768
 * * https://bugzilla.mozilla.org/show_bug.cgi?id=1293277
 * * https://github.com/w3c/ServiceWorker/issues/765
 *
 * The problem with iframes using srcDoc and src="about:blank" as they
 * fail to inherit the root site's service worker.
 *
 * Gutenberg loads the site editor using <iframe srcDoc="<!doctype html">
 * to force the standards mode and not the quirks mode:
 *
 * https://github.com/WordPress/gutenberg/pull/38855
 *
 * This commit patches the site editor to achieve the same result via
 * <iframe src="/doctype.html"> and a doctype.html file containing just
 * `<!doctype html>`. This allows the iframe to inherit the service worker
 * and correctly load all the css, js, fonts, images, and other assets.
 *
 * Ideally this issue would be fixed directly in Gutenberg and the patch
 * below would be removed.
 *
 * See https://github.com/WordPress/wordpress-playground/issues/42 for more details
 */
export async function makeEditorFrameControlled(
	php: UniversalPHP,
	wordpressPath: string,
	blockEditorScripts: string[]
) {
	const controlledIframe = `
	/**
	 * A synchronous function to read a blob URL as text.
	 *
	 * @param {string} url
	 * @returns {string}
	 */
	const __playground_readBlobAsText = function (url) {
		try {
		  let xhr = new XMLHttpRequest();
		  xhr.open('GET', url, false);
		  xhr.overrideMimeType('text/plain;charset=utf-8');
		  xhr.send();
		  return xhr.responseText;
		} catch(e) {
		  return '';
		} finally {
		  URL.revokeObjectURL(url);
		}
	}

	window.__playground_ControlledIframe = window.wp.element.forwardRef(function (props, ref) {
		const source = window.wp.element.useMemo(function () {
			if (props.srcDoc) {
				// WordPress <= 6.2 uses a srcDoc that only contains a doctype.
				return '/wp-includes/empty.html';
			} else if (props.src && props.src.startsWith('blob:')) {
				// WordPress 6.3 uses a blob URL with doctype and a list of static assets.
				// Let's pass the document content to empty.html and render it there.
				return '/wp-includes/empty.html#' + encodeURIComponent(__playground_readBlobAsText(props.src));
			} else {
				// WordPress >= 6.4 uses a plain HTTPS URL that needs no correction.
				return props.src;
			}
		}, [props.src]);
		return (
			window.wp.element.createElement('iframe', {
				...props,
				ref: ref,
				src: source,
				// Make sure there's no srcDoc, as it would interfere with the src.
				srcDoc: undefined
			})
		)
	});`;

	for (const filePath of blockEditorScripts) {
		if (!(await php.fileExists(filePath))) {
			continue;
		}
		await updateFile(
			php,
			filePath,
			// The original version of this function crashes WASM PHP, let's define an empty one instead.
			(contents) =>
				`${controlledIframe} ${contents.replace(
					/\(\s*"iframe",/,
					'(__playground_ControlledIframe,'
				)}`
		);
	}
	await php.writeFile(
		`${wordpressPath}/wp-includes/empty.html`,
		'<!doctype html><script>const hash = window.location.hash.substring(1); if ( hash ) document.write(decodeURIComponent(hash))</script>'
	);
}
