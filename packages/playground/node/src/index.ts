/**
 * Early draft of a Node.js playground package.
 * This is meant to streamline the Node.js workflow
 * and make it easier to build things like VS Code extensions,
 * Express servers, and CLI tools
 */

import {
	Blueprint,
	compileBlueprint,
	defineSiteUrl,
	runBlueprintSteps,
} from '@wp-playground/blueprints';
import { NodePHP } from '@php-wasm/node';
import { PHPRequestHandler, UniversalPHP } from '@php-wasm/universal';
import { collectPhpLogs, logger } from '@php-wasm/logger';

export interface NodePlaygroundOptions {
	blueprint?: Blueprint;
	wordpressPathOnHost: string;
	serverUrl: string;
}

export async function startPlaygroundNode(
	options: NodePlaygroundOptions
): Promise<NodePHP> {
	/**
	 * @TODO figure out how to handle:
	 * * WordPress installation? There are no wp.data files like in the web version
	 * * Managing WordPress versions
	 * * Existing WordPress installations
	 * * Mounting existing themes, plugins, and core WP files
	 *
	 * Perhaps there is too much custom logic to be able to even have
	 * a generic "startPlaygroundNode" function?
	 *
	 * @TODO use this workflow to compile WordPress for the web
	 */
	const compiled = compileBlueprint(options.blueprint || {});
	const requestHandler = new PHPRequestHandler({
		phpFactory: () => NodePHP.load(compiled.versions.php),
		absoluteUrl: options.serverUrl,
		documentRoot: options.wordpressPathOnHost,
	});
	const playground = await requestHandler.getPrimaryPhp();

	collectPhpLogs(logger, playground);

	await defineSiteUrl(playground, {
		siteUrl: options.serverUrl,
	});

	await allowWpOrgHosts(playground, options.wordpressPathOnHost);

	await runBlueprintSteps(compiled, playground);
	return playground;
}

export async function allowWpOrgHosts(
	php: UniversalPHP,
	wordpressPath: string
) {
	await php.mkdir(`${wordpressPath}/wp-content/mu-plugins`);
	await php.writeFile(
		`${wordpressPath}/wp-content/mu-plugins/0-allow-wp-org.php`,
		`<?php
		// Needed because gethostbyname( 'wordpress.org' ) returns
		// a private network IP address for some reason.
		add_filter( 'allowed_redirect_hosts', function( $deprecated = '' ) {
			return array(
				'wordpress.org',
				'api.wordpress.org',
				'downloads.wordpress.org',
			);
		} );`
	);
}
