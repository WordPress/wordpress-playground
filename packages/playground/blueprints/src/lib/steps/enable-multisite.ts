import { phpVar } from '@php-wasm/util';
import type { StepHandler } from '.';
import { defineWpConfigConsts } from './define-wp-config-consts';
import { setSiteOptions } from './site-data';
import { assertWpCli, wpCLI } from './wp-cli';

/**
 * @inheritDoc enableMultisite
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "enableMultisite"
 * }
 * </code>
 */
export interface EnableMultisiteStep {
	step: 'enableMultisite';
	/** wp-cli.phar path */
	wpCliPath?: string;
}

/**
 * Defines the [Multisite](https://developer.wordpress.org/advanced-administration/multisite/create-network/) constants in a `wp-config.php` file.
 *
 * This step can be called multiple times, and the constants will be merged.
 *
 * @param playground The playground client.
 * @param enableMultisite
 */
export const enableMultisite: StepHandler<EnableMultisiteStep> = async (
	playground,
	{ wpCliPath }
) => {
	await assertWpCli(playground, wpCliPath);

	await defineWpConfigConsts(playground, {
		consts: {
			WP_ALLOW_MULTISITE: 1,
		},
	});

	const url = new URL(await playground.absoluteUrl);
	if (url.port !== '') {
		let errorMessage = `The current host is ${url.host}, but WordPress multisites do not support custom ports.`;
		if (url.hostname === 'localhost') {
			errorMessage += ` For development, you can set up a playground.test domain using the instructions at https://wordpress.github.io/wordpress-playground/contributing/code.`;
		}
		throw new Error(errorMessage);
	}
	const sitePath = url.pathname.replace(/\/$/, '') + '/';
	const siteUrl = `${url.protocol}//${url.hostname}${sitePath}`;
	await setSiteOptions(playground, {
		options: {
			siteurl: siteUrl,
			home: siteUrl,
		},
	});

	await wpCLI(playground, {
		command: `wp core multisite-convert --base="${sitePath}"`,
	});

	// Set $_SERVER['HTTP_HOST'] and $_SERVER['REQUEST_URI'] in wp-config.php for multisite support.
	// When WordPress runs in a non-request context (e.g. runPHP, activatePlugin, or other
	// blueprint steps that load wp-load.php directly), multisite bootstrap needs both
	// HTTP_HOST and REQUEST_URI to locate the current site in get_site_by_path().
	// https://make.wordpress.org/cli/handbook/guides/common-issues/#php-notice-undefined-index-on-_server-superglobal
	const docRoot = await playground.documentRoot;
	const wpConfigPath = `${docRoot}/wp-config.php`;
	const wpConfig = await playground.readFileAsText(wpConfigPath);
	let newWpConfig = wpConfig;
	const serverDefaults: string[] = [];
	if (!wpConfig.includes("$_SERVER['HTTP_HOST']")) {
		serverDefaults.push(`$_SERVER['HTTP_HOST'] = ${phpVar(url.hostname)};`);
	}
	if (!wpConfig.includes("$_SERVER['REQUEST_URI']")) {
		serverDefaults.push(
			`if (empty($_SERVER['REQUEST_URI'])) {\n\t$_SERVER['REQUEST_URI'] = ${phpVar(
				sitePath
			)};\n}`
		);
	}
	if (serverDefaults.length > 0) {
		newWpConfig = wpConfig.replace(
			/^<\?php\s*/i,
			`<?php\n${serverDefaults.join('\n')}\n`
		);
		await playground.writeFile(wpConfigPath, newWpConfig);
	}
};
