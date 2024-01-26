import { phpVar } from '@php-wasm/util';
import { StepHandler } from '.';
import { defineWpConfigConsts } from './define-wp-config-consts';
import { login } from './login';
import { request } from './request';
import { setSiteOptions } from './site-data';
import { activatePlugin } from './activate-plugin';
import { getURLScope } from '@php-wasm/scopes';

/**
 * @inheritDoc enableMultisite
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "enableMultisite",
 * }
 * </code>
 */
export interface EnableMultisiteStep {
	step: 'enableMultisite';
}

/**
 * Defines constants in a wp-config.php file.
 *
 * This step can be called multiple times, and the constants will be merged.
 *
 * @param playground The playground client.
 * @param enableMultisite
 */
export const enableMultisite: StepHandler<EnableMultisiteStep> = async (
	playground
) => {
	// Ensure we're logged in
	await login(playground, {});

	await defineWpConfigConsts(playground, {
		consts: {
			WP_ALLOW_MULTISITE: 1,
		},
	});

	const url = new URL(await playground.absoluteUrl);
	const sitePath = url.pathname.replace(/\/$/, '') + '/';
	const siteUrl = `${url.protocol}//${url.host}${sitePath}`;
	await setSiteOptions(playground, {
		options: {
			siteurl: siteUrl,
			home: siteUrl,
		},
	});

	const docroot = await playground.documentRoot;

	// Deactivate all the plugins as required by the multisite installation.
	const result = await playground.run({
		code: `<?php
define( 'WP_ADMIN', true );
require_once(${phpVar(docroot)} . "/wp-load.php");
require_once(${phpVar(docroot)} . "/wp-admin/includes/plugin.php");
$plugins_root = ${phpVar(docroot)} . "/wp-content/plugins";
$plugins = glob($plugins_root . "/*");

$deactivated_plugins = [];
foreach($plugins as $plugin_path) {
	if (!is_dir($plugin_path)) {
		deactivate_plugins($plugin_path);
		continue;
	}
	// Find plugin entry file
	foreach ( ( glob( $plugin_path . '/*.php' ) ?: array() ) as $file ) {
		$info = get_plugin_data( $file, false, false );
		if ( ! empty( $info['Name'] ) ) {
			deactivate_plugins( $file );
			$deactivated_plugins[] = substr($file, strlen($plugins_root) + 1);
			break;
		}
	}
}
echo json_encode($deactivated_plugins);
`,
	});
	const deactivatedPlugins = result.json;

	// Extract nonce for multisite form submission
	const networkForm = await request(playground, {
		request: {
			url: '/wp-admin/network.php',
		},
	});
	const nonce = networkForm.text.match(
		/name="_wpnonce"\s+value="([^"]+)"/
	)?.[1];

	// @TODO: Extract nonce using wp_create_nonce() instead
	//        of an HTTP request.
	//        Unfortunately, the code snippet below does not
	//        yield a nonce that WordPress would accept:
	/*
    const nonce = (await playground.run({
	  	code: `<?php
	  	require '/wordpress/wp-load.php';
	  	wp_set_current_user(1);
	  	echo wp_create_nonce('install-network-1');
	  	`,
    })).text;
    */

	await request(playground, {
		request: {
			url: '/wp-admin/network.php',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: jsonToUrlEncoded({
				_wpnonce: nonce,
				_wp_http_referer: sitePath + 'wp-admin/network.php',
				sitename: 'My WordPress Website Sites',
				email: 'admin@localhost.com',
				submit: 'Install',
			}),
		},
	});

	await defineWpConfigConsts(playground, {
		consts: {
			SUNRISE: 'on',
			MULTISITE: true,
			SUBDOMAIN_INSTALL: false,
			SITE_ID_CURRENT_SITE: 1,
			BLOG_ID_CURRENT_SITE: 1,
			DOMAIN_CURRENT_SITE: url.hostname,
			PATH_CURRENT_SITE: sitePath,
		},
	});

	// Create a sunrise.php file to tell WordPress which site to load
	// by default. Without this, requiring `wp-load.php` will result in
	// a redirect to the main site.
	const wpInstallationFolder =
		'scope:' + getURLScope(new URL(await playground.absoluteUrl));
	await playground.writeFile(
		`${await playground.documentRoot}/wp-content/sunrise.php`,
		`<?php
	if ( !defined( 'BLOG_ID_CURRENT_SITE' ) ) {
		define( 'BLOG_ID_CURRENT_SITE', 1 );
	}
	$folder = ${phpVar(wpInstallationFolder)};
	if (strpos($_SERVER['REQUEST_URI'],"/$folder") === false) {
		$_SERVER['HTTP_HOST'] = 'playground.test';
		$_SERVER['REQUEST_URI'] = "/$folder/" . ltrim($_SERVER['REQUEST_URI'], '/');
	}
`
	);
	await login(playground, {});

	// Reactivate any previously deactivated plugins
	for (const plugin of deactivatedPlugins) {
		await activatePlugin(playground, {
			pluginPath: plugin,
		});
	}
};

function jsonToUrlEncoded(json: Record<string, string>) {
	return Object.keys(json)
		.map(
			(key) =>
				encodeURIComponent(key) + '=' + encodeURIComponent(json[key])
		)
		.join('&');
}
