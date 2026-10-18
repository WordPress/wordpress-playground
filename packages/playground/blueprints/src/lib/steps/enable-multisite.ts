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
	// WP multisite only sees what $_SERVER values the Playground host
	// sets (HTTP_HOST is forced to url.hostname below); the port in the
	// iframe URL never reaches PHP. On loopback hosts the port is
	// always a dev-server artifact, so reject only public hosts.
	const isLoopback =
		url.hostname === 'localhost' ||
		url.hostname === '127.0.0.1' ||
		url.hostname === '[::1]';
	if (url.port !== '' && !isLoopback) {
		throw new Error(
			`The current host is ${url.host}, but WordPress multisites do not support custom ports.`
		);
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

	// Set $_SERVER['HTTP_HOST'] in wp-config.php for multisite support.
	// https://make.wordpress.org/cli/handbook/guides/common-issues/#php-notice-undefined-index-on-_server-superglobal
	const docRoot = await playground.documentRoot;
	const wpConfigPath = `${docRoot}/wp-config.php`;
	const wpConfig = await playground.readFileAsText(wpConfigPath);
	let newWpConfig = wpConfig;
	if (!wpConfig.includes("$_SERVER['HTTP_HOST']")) {
		newWpConfig = wpConfig.replace(
			/^<\?php\s*/i,
			`<?php\n$_SERVER['HTTP_HOST'] = ${phpVar(url.hostname)};\n`
		);
	}
	await playground.writeFile(wpConfigPath, newWpConfig);
};
