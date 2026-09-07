<?php
// PHP < 5.3 doesn't support anonymous functions (closures) at all,
// and WordPress < 3.0 can't handle them as hook callbacks. Skip this
// mu-plugin entirely for either.
if (version_compare(PHP_VERSION, '5.3', '<')
	|| (isset($GLOBALS['wp_version']) && version_compare($GLOBALS['wp_version'], '3.0', '<'))) {
	return;
}

/**
 * Add a notice to wp-login.php offering the username and password.
 */
add_filter(
	'login_message',
	function ( $message ) {
		return $message . <<<EOT
<div class="message info">
	<strong>username:</strong> <code>admin</code><br><strong>password</strong>: <code>password</code>
</div>
EOT;
	}
);

/**
 * Because the in-browser Playground doesn't have access to the internet,
 * network-dependent features like directories don't work. Normally, you'll
 * see a confusing message like "An unexpected error occurred." This mu-plugin
 * makes it more clear that the feature is not yet supported.
 *
 * https://github.com/WordPress/wordpress-playground/issues/498
 *
 * Added styling to hide the Popular tags section of the Plugins page
 * and the nonfunctional Try Again button (both Plugins and Themes) that's
 * appended when the message is displayed.
 *
 * https://github.com/WordPress/wordpress-playground/issues/927
 *
 */
add_action('admin_head', function () {
	echo '<style>
				:is(.plugins-popular-tags-wrapper:has(div.networking_err_msg),
				button.button.try-again) {
						display: none;
				}
		</style>';
});

/**
 * Opt Playground pages into browser-native cross-document View Transitions.
 *
 * This lets the browser keep the outgoing page visible until the incoming page
 * is ready, without intercepting clicks or emulating navigation.
 * The rules are intentionally low-specificity and printed early, so themes,
 * plugins, and user code can override them with ordinary CSS.
 */
function playground_enable_view_transitions() {
	if ( playground_has_wordpress_view_transitions() ) {
		return;
	}

	?>
	<style>
		@media (prefers-reduced-motion: no-preference) {
			@view-transition {
				navigation: auto;
			}

			::view-transition-group(root),
			::view-transition-old(root),
			::view-transition-new(root) {
				animation-delay: 0s;
				animation-duration: 0s;
			}

			::view-transition-old(root),
			::view-transition-new(root) {
				mix-blend-mode: normal;
			}
		}
	</style>
	<?php
}

/**
 * Checks whether WordPress already owns View Transitions for this request.
 *
 * The Playground fallback avoids named transitions, but it should still step
 * aside when Core or the feature plugin can define its own root transition.
 */
function playground_has_wordpress_view_transitions() {
	// The standalone View Transitions feature plugin defines these globally.
	if ( defined( 'VIEW_TRANSITIONS_VERSION' )
		|| function_exists( 'plvt_load_view_transitions' ) ) {
		return true;
	}

	if ( ! function_exists( 'is_admin' ) || ! is_admin() ) {
		return false;
	}

	// Core exposes these helpers while its admin View Transitions are available.
	if ( function_exists( 'wp_get_view_transitions_admin_css' )
		|| function_exists( 'wp_enqueue_view_transitions_admin_css' ) ) {
		return true;
	}

	return function_exists( 'wp_style_is' )
		&& (
			wp_style_is( 'wp-view-transitions-admin', 'enqueued' )
			|| wp_style_is( 'wp-view-transitions-admin', 'done' )
		);
}
add_action( 'wp_head', 'playground_enable_view_transitions', 0 );
add_action( 'admin_print_styles', 'playground_enable_view_transitions', 0 );
add_action( 'login_head', 'playground_enable_view_transitions', 0 );

add_action('init', 'networking_disabled');
function networking_disabled() {
	$networking_err_msg = '<div class="networking_err_msg">Network access is an <a href="https://github.com/WordPress/wordpress-playground/issues/85" target="_blank">experimental, opt-in feature</a>, which means you need to enable it to allow Playground to access the Plugins/Themes directories.
	<p>There are two alternative methods to enable global networking support:</p>
	<ol>
	<li>Using the <a href="https://wordpress.github.io/wordpress-playground/developers/apis/query-api/">Query API</a>: for example, https://playground.wordpress.net/<em>?networking=yes</em> <strong>or</strong>
	<li> Using the <a href="https://wordpress.github.io/wordpress-playground/blueprints/data-format/#features">Blueprint API</a>: add <code>"features": { "networking": true }</code> to the JSON file.
	</li></ol>
	<p>
	When browsing Playground as a standalone instance, you can enable networking via the settings panel: select the option "Network access (e.g. for browsing plugins)" and hit the "Apply changes" button.<p>
	<strong>Please note:</strong> This option is hidden when browsing Playground as an embedded iframe.</p></div>';
	return $networking_err_msg;
}

add_filter('plugins_api_result', function ($res) {
	if ($res instanceof WP_Error) {
		$res = new WP_Error(
			'plugins_api_failed',
			networking_disabled()
		);
	}
	return $res;
});

add_filter('gettext', function ($translation) {
	if( $GLOBALS['pagenow'] === 'theme-install.php') {
		if ($translation === 'An unexpected error occurred. Something may be wrong with WordPress.org or this server&#8217;s configuration. If you continue to have problems, please try the <a href="%s">support forums</a>.') {
			return networking_disabled();
		}
	}
	return $translation;
});

/**
 * Links with target="top" don't work in the playground iframe because of
 * the sandbox attribute. What they really should be targeting is the
 * playground iframe itself (name="playground"). This mu-plugin rewrites
 * all target="_top" links to target="playground" instead.
 *
 * https://github.com/WordPress/wordpress-playground/issues/266
 */
add_action('admin_print_scripts', function () {
	?>
	<script>
		document.addEventListener('click', function (event) {
			if (event.target.tagName === 'A' && ['_parent', '_top'].includes(event.target.target)) {
				event.target.target = 'wordpress-playground';
			}
		});
	</script>
	<?php
});

/**
 * Adds target="_blank" to external links when clicked to open them in a new tab.
 * This prevents users from loading non-Playground pages inside the Playground iframe.
 */
function playground_add_target_blank_to_external_links() {
	// Only run on frontend and admin pages, not during AJAX requests or CLI
	if (empty($_SERVER['REQUEST_URI']) || (function_exists('wp_doing_ajax') && wp_doing_ajax()) || (function_exists('wp_doing_cron') && wp_doing_cron())) {
		return;
	}

	?>
	<script>
		function addTargetBlankToExternalLinks() {
			function addTargetBlank(a) {
				const url = new URL(a.href, location);
				if (url.origin !== location.origin) {
					a.target = '_blank';
				}
			}

			// Set target="_blank" for existing external links – this
			// covers keyboard navigation.
			document.querySelectorAll('a[href]').forEach(a => {
				addTargetBlank(a);
			});

			// Set target="_blank" for external links when clicked.
			// This covers links that are added after the page has loaded.
			document.addEventListener('click', e => {
				// window, document, SVG Text nodes etc. don't have the `closest` method
				if ( !e.target?.closest ) {
					return;
				}
				const a = e.target.closest('a[href]');
				if (!a) return;
				addTargetBlank(a);
			});

			// Also handle focus events to cover keyboard navigation on
			// links that are added after the page has loaded.
			document.addEventListener('focus', e => {
				// window, document, SVG Text nodes etc. don't have the `closest` method
				if ( !e.target?.closest ) {
					return;
				}
				const a = e.target?.closest('a[href]');
				if (!a) return;
				addTargetBlank(a);
			}, true);
		}

		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', addTargetBlankToExternalLinks);
		} else {
			addTargetBlankToExternalLinks();
		}
	</script>

	<?php
}
add_action('wp_head', 'playground_add_target_blank_to_external_links');
add_action('admin_head', 'playground_add_target_blank_to_external_links');

/**
 * Reports the current URL to the parent frame.
 *
 * When Document-Isolation-Policy is enabled, the parent frame can't access
 * the iframe's location.href due to cross-origin restrictions. This script
 * posts a message to the parent frame with the current URL so the address
 * bar can be updated.
 *
 * @see https://github.com/WordPress/wordpress-playground/issues/2954
 */
function playground_report_url_to_parent() {
	?>
	<script>
		if (window.parent !== window) {
			window.parent.postMessage(
				JSON.stringify({
					type: 'playground-url-change',
					url: window.location.href
				}),
				'*'
			);
		}
	</script>
	<?php
}
add_action('wp_head', 'playground_report_url_to_parent');
add_action('admin_head', 'playground_report_url_to_parent');

/**
 * Captures this document when the trusted Playground parent requests a site
 * thumbnail. The renderer is loaded only for a capture, so normal WordPress
 * page loads do not pay its download or execution cost.
 *
 * This must run inside the WordPress document rather than reading the iframe
 * DOM from the remote frame. For example, a plugin may send
 * `Cross-Origin-Embedder-Policy: require-corp` and
 * `Cross-Origin-Opener-Policy: same-origin` on the front page. In browsers
 * that support Document-Isolation-Policy, Playground's service worker rewrites
 * those headers to `Document-Isolation-Policy: isolate-and-require-corp`.
 * Because the remote frame does not have the matching policy, the browser
 * blocks its synchronous access to `iframe.contentDocument`, even though both
 * frames are same-origin. The listener below therefore captures in the
 * WordPress document and returns the thumbnail with `postMessage()`.
 */
function playground_enable_site_thumbnail_capture() {
	?>
	<script>
		(function () {
			if (window.__playgroundSiteThumbnailCaptureEnabled) {
				return;
			}
			window.__playgroundSiteThumbnailCaptureEnabled = true;

			window.addEventListener('message', async function (event) {
				// The origin protects the trust boundary. Checking source as well
				// prevents another same-origin frame from requesting code execution.
				if (
					event.source !== window.parent ||
					event.origin !== window.location.origin ||
					event.data?.type !== 'playground-capture-site-thumbnail'
				) {
					return;
				}

				const request = event.data;
				try {
					if (
						typeof request.moduleUrl !== 'string' ||
						!request.moduleUrl
					) {
						throw new Error('Missing site thumbnail module URL.');
					}
					// Dynamic import executes inside the WordPress document. Accept only
					// the same-origin renderer asset marked by the trusted parent.
					const moduleUrl = new URL(request.moduleUrl);
					const isRendererModule =
						moduleUrl.pathname ===
							'/src/lib/capture-site-thumbnail.ts' ||
						/^\/capture-site-thumbnail-[A-Za-z0-9_-]+\.js$/.test(
							moduleUrl.pathname
						);
					if (
						moduleUrl.origin !== event.origin ||
						!isRendererModule ||
						moduleUrl.searchParams.get(
							'playground-site-thumbnail-module'
						) !== '1'
					) {
						throw new Error('Invalid site thumbnail module URL.');
					}
					await import(moduleUrl.href);
					if (typeof window.__playgroundCaptureSiteThumbnail !== 'function') {
						throw new Error('Site thumbnail renderer did not load.');
					}
					const thumbnail = await window.__playgroundCaptureSiteThumbnail();
					window.parent.postMessage(
						{
							type: 'playground-site-thumbnail-result',
							requestId: request.requestId,
							thumbnail,
						},
						event.origin
					);
				} catch (error) {
					window.parent.postMessage(
						{
							type: 'playground-site-thumbnail-result',
							requestId: request.requestId,
							error:
								error instanceof Error
									? error.message
									: String(error),
						},
						event.origin
					);
				}
			});
		})();
	</script>
	<?php
}
add_action('wp_head', 'playground_enable_site_thumbnail_capture');
add_action('admin_head', 'playground_enable_site_thumbnail_capture');

/**
 * Exposes a WebMCP `modelContext` inside the WordPress document and proxies it
 * to the Playground frame.
 *
 * WordPress runs in a nested, service-worker-served iframe. A browser agent
 * driving the top-level Playground page cannot see tools a plugin registers in
 * that inner document, and the remote frame cannot read the inner document
 * either — under Document-Isolation-Policy synchronous cross-frame DOM access
 * is blocked even between same-origin frames.
 *
 * This script therefore implements the tool registry on the WordPress side and
 * mirrors it over `postMessage()`:
 *
 * * every registration change announces the full tool list to the parent;
 * * the parent asks this document to run a tool and receives the JSON result.
 *
 * The registry is installed as an own property on `document`, shadowing a
 * native implementation if the browser has one. Playground owns the proxy that
 * surfaces these tools to the agent, so the inner document must not register
 * them with the browser behind Playground's back.
 *
 * @see packages/playground/remote/src/lib/webmcp-frame-bridge.ts
 */
function playground_enable_webmcp_bridge() {
	?>
	<script>
		(function () {
			if (window.__playgroundWebmcpBridgeEnabled || window.parent === window) {
				return;
			}
			window.__playgroundWebmcpBridgeEnabled = true;

			var TOOLS_CHANGED = 'playground-webmcp-tools-changed';
			var LIST_TOOLS = 'playground-webmcp-list-tools';
			var CALL_TOOL = 'playground-webmcp-call-tool';
			var CALL_RESULT = 'playground-webmcp-call-result';

			// The remote frame is same-origin with this document.
			var parentOrigin = window.location.origin;
			var tools = new Map();
			var announceScheduled = false;

			/**
			 * Announces the current tool list to the parent frame.
			 *
			 * Batched on a microtask so a plugin registering ten tools in a
			 * row produces one message rather than ten.
			 */
			function announce() {
				if (announceScheduled) {
					return;
				}
				announceScheduled = true;
				Promise.resolve().then(function () {
					announceScheduled = false;
					var described = [];
					tools.forEach(function (tool) {
						described.push({
							name: tool.name,
							description:
								typeof tool.description === 'string'
									? tool.description
									: '',
							inputSchema: toPlainObject(tool.inputSchema),
							annotations: toPlainObject(tool.annotations)
						});
					});
					window.parent.postMessage(
						{ type: TOOLS_CHANGED, tools: described },
						parentOrigin
					);
				});
			}

			/**
			 * Drops anything a structured clone would reject, such as the
			 * functions and class instances a schema builder may leave behind.
			 */
			function toPlainObject(value) {
				if (!value || typeof value !== 'object') {
					return undefined;
				}
				try {
					return JSON.parse(JSON.stringify(value));
				} catch (e) {
					return undefined;
				}
			}

			function addTool(tool, options) {
				if (
					!tool ||
					typeof tool.name !== 'string' ||
					!tool.name ||
					typeof tool.execute !== 'function'
				) {
					throw new TypeError(
						'A WebMCP tool needs a name and an execute() function.'
					);
				}
				tools.set(tool.name, tool);
				var signal = options && options.signal;
				if (signal) {
					if (signal.aborted) {
						tools.delete(tool.name);
					} else {
						signal.addEventListener('abort', function () {
							if (tools.get(tool.name) === tool) {
								tools.delete(tool.name);
								announce();
							}
						});
					}
				}
				announce();
			}

			var modelContext = {
				get tools() {
					return Array.from(tools.values());
				},
				registerTool: function (tool, options) {
					addTool(tool, options);
					return Promise.resolve();
				},
				provideContext: function (context) {
					tools.clear();
					var provided = (context && context.tools) || [];
					for (var i = 0; i < provided.length; i++) {
						addTool(provided[i]);
					}
					announce();
				},
				clearContext: function () {
					tools.clear();
					announce();
				}
			};

			Object.defineProperty(document, 'modelContext', {
				configurable: true,
				value: modelContext
			});

			// Chrome 150 deprecated `navigator.modelContext` in favour of
			// `document.modelContext` but still serves it, so a plugin that
			// has not migrated works there and would break only here. Mirror
			// the platform, warning once, and drop this when Chrome does.
			var warnedAboutNavigator = false;
			Object.defineProperty(navigator, 'modelContext', {
				configurable: true,
				get: function () {
					if (!warnedAboutNavigator) {
						warnedAboutNavigator = true;
						console.warn(
							'navigator.modelContext is deprecated and will be ' +
							'removed. Use document.modelContext instead.'
						);
					}
					return modelContext;
				}
			});

			// A minimal WebMCP client. The agent lives in the top-level page,
			// so this document cannot prompt the user itself.
			var toolClient = {
				requestUserInteraction: function (callback) {
					return Promise.resolve().then(callback);
				}
			};

			function respond(callId, result, error) {
				var message = { type: CALL_RESULT, callId: callId };
				if (error) {
					message.error = error;
				} else {
					try {
						message.resultJson = JSON.stringify(
							result === undefined ? null : result
						);
					} catch (e) {
						message.error =
							'The tool returned a value that cannot be serialized to JSON.';
					}
				}
				window.parent.postMessage(message, parentOrigin);
			}

			window.addEventListener('message', function (event) {
				// The origin marks the trust boundary; checking the source as
				// well keeps another same-origin frame from invoking tools.
				if (
					event.source !== window.parent ||
					event.origin !== parentOrigin ||
					!event.data
				) {
					return;
				}
				if (event.data.type === LIST_TOOLS) {
					announce();
					return;
				}
				if (event.data.type !== CALL_TOOL) {
					return;
				}
				var callId = event.data.callId;
				var tool = tools.get(event.data.name);
				if (!tool) {
					respond(
						callId,
						null,
						'Unknown WebMCP tool: ' + event.data.name
					);
					return;
				}
				Promise.resolve()
					.then(function () {
						return tool.execute(
							event.data.arguments || {},
							toolClient
						);
					})
					.then(
						function (result) {
							respond(callId, result, null);
						},
						function (error) {
							respond(
								callId,
								null,
								error && error.message
									? error.message
									: String(error)
							);
						}
					);
			});

			// Announce right away so the parent replaces the previous
			// document's tools on every navigation, even when this page
			// registers none.
			announce();
		})();
	</script>
	<?php
}
add_action('wp_head', 'playground_enable_webmcp_bridge');
add_action('admin_head', 'playground_enable_webmcp_bridge');

/**
 * The default WordPress requests transports have been disabled
 * at this point. However, the Requests class requires at least
 * one working transport or else it throws warnings and acts up.
 *
 * This mu-plugin provides that transport. It's one of the two:
 *
 * * WP_Http_Fetch – Sends requests using browser's fetch() function.
 * * WP_Http_Dummy – Does not send any requests and only exists to keep
 * 								the Requests class happy.
 */
$__requests_class = class_exists( '\WpOrg\Requests\Requests' ) ? '\WpOrg\Requests\Requests' : ( class_exists( 'Requests' ) ? 'Requests' : null );
if (defined('USE_FETCH_FOR_REQUESTS') && USE_FETCH_FOR_REQUESTS) {
	require(__DIR__ . '/playground-includes/wp_http_fetch.php');
	/**
	 * Force the Fetch transport to be used in Requests.
	 */
	add_action( 'requests-requests.before_request', function( $url, $headers, $data, $type, &$options ) {
		$options['transport'] = 'Wp_Http_Fetch';
	}, 10, 5 );

	/**
	 * Force wp_http_supports() to work, which uses deprecated WP_HTTP methods.
	 * This filter is deprecated, and no longer actively used, but is needed for wp_http_supports().
	 * @see https://core.trac.wordpress.org/ticket/37708
	 */
	add_filter('http_api_transports', function() {
		return array( 'Fetch' );
	});

	/**
	 * Disable signature verification as it doesn't seem to work with
	 * fetch requests:
	 *
	 * https://downloads.wordpress.org/plugin/classic-editor.zip returns no signature header.
	 * https://downloads.wordpress.org/plugin/classic-editor.zip.sig returns 404.
	 *
	 * @TODO Investigate why.
	 */
	add_filter('wp_signature_hosts', function ($hosts) {
		return array();
	});
} else {
	require(__DIR__ . '/playground-includes/wp_http_dummy.php');
	if ( $__requests_class ) {
		$__requests_class::add_transport('Wp_Http_Dummy');
	}

	add_action( 'requests-requests.before_request', function( $url, $headers, $data, $type, &$options ) {
		$options['transport'] = 'Wp_Http_Dummy';
	}, 10, 5 );

	add_filter('http_api_transports', function() {
		return array( 'Dummy' );
	});
}

/**
 * Disable the pattern picker modal to prevent iOS Safari memory crashes.
 * @see https://github.com/WordPress/gutenberg/issues/75019
 */
add_action('init', function() {
	if (defined('PLAYGROUND_ALLOW_PATTERN_PICKER') && PLAYGROUND_ALLOW_PATTERN_PICKER) return;
	if (!function_exists('get_current_user_id')) return;
	$user_id = get_current_user_id();
	if (!$user_id) return;

	$prefs = get_user_meta($user_id, 'wp_persisted_preferences', true) ?: array();
	if (!isset($prefs['core'])) $prefs['core'] = array();
	$prefs['core']['enableChoosePatternModal'] = false;
	update_user_meta($user_id, 'wp_persisted_preferences', $prefs);
});

/**
 * Disable the WP Cron.
 * 
 * Around WordPress 7.0 beta 1, many wp-cron requests in the Playground started
 * taking the full 30 seconds to complete. Since we're running PHP on a single
 * worker, that blocks every other request from running until WP Cron completes.
 */
define('DISABLE_WP_CRON', true);
if(str_ends_with($_SERVER['PHP_SELF'], '/wp-cron.php')) {
	http_response_code(503);
	header('Content-Type: text/plain');
	echo 'WP Cron is temporarily disabled in the Playground.';
	exit;
}
