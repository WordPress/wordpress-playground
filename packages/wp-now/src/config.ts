import {
	SupportedPHPVersion,
	SupportedPHPVersionsList,
} from '@php-wasm/universal';
import crypto from 'crypto';
import { inferMode } from './wp-now';
import { portFinder } from './port-finder';
import { isValidWordPressVersion } from './wp-playground-wordpress';
import getWpNowPath from './get-wp-now-path';

import path from 'path';

import { DEFAULT_PHP_VERSION, DEFAULT_WORDPRESS_VERSION } from './constants';

export interface CliOptions {
	php?: string;
	path?: string;
	wp?: string;
	port?: number;
}

export const enum WPNowMode {
	PLUGIN = 'plugin',
	THEME = 'theme',
	WORDPRESS = 'wordpress',
	WORDPRESS_DEVELOP = 'wordpress-develop',
	INDEX = 'index',
	WP_CONTENT = 'wp-content',
	PLAYGROUND = 'playground',
	AUTO = 'auto',
}

export interface WPNowOptions {
	phpVersion?: SupportedPHPVersion;
	documentRoot?: string;
	absoluteUrl?: string;
	mode?: WPNowMode;
	port?: number;
	projectPath?: string;
	wpContentPath?: string;
	wordPressVersion?: string;
	numberOfPhpInstances?: number;
}

export const DEFAULT_OPTIONS: WPNowOptions = {
	phpVersion: DEFAULT_PHP_VERSION,
	wordPressVersion: DEFAULT_WORDPRESS_VERSION,
	documentRoot: '/var/www/html',
	projectPath: process.cwd(),
	mode: WPNowMode.AUTO,
	numberOfPhpInstances: 1,
};

export interface WPEnvOptions {
	core: string | null;
	phpVersion: SupportedPHPVersion | null;
	plugins: string[];
	themes: string[];
	port: number;
	testsPort: number;
	config: Object;
	mappings: Object;
}

async function getAbsoluteURL() {
	const port = await portFinder.getOpenPort();
	return `http://localhost:${port}`;
}

function getWpContentHomePath(projectPath: string, mode: string) {
	const basename = path.basename(projectPath);
	const directoryHash = crypto
		.createHash('sha1')
		.update(projectPath)
		.digest('hex');
	const projectDirectory =
		mode === WPNowMode.PLAYGROUND
			? 'playground'
			: `${basename}-${directoryHash}`;
	return path.join(getWpNowPath(), 'wp-content', projectDirectory);
}

export default async function getWpNowConfig(
	args: CliOptions
): Promise<WPNowOptions> {
	const port = args.port || (await portFinder.getOpenPort());
	const optionsFromCli: WPNowOptions = {
		phpVersion: args.php as SupportedPHPVersion,
		projectPath: args.path as string,
		wordPressVersion: args.wp as string,
		port,
	};

	const options: WPNowOptions = {} as WPNowOptions;

	[optionsFromCli, DEFAULT_OPTIONS].forEach((config) => {
		for (const key in config) {
			if (!options[key]) {
				options[key] = config[key];
			}
		}
	});

	if (!options.mode || options.mode === 'auto') {
		options.mode = inferMode(options.projectPath);
	}
	if (!options.wpContentPath) {
		options.wpContentPath = getWpContentHomePath(
			options.projectPath,
			options.mode
		);
	}
	if (!options.absoluteUrl) {
		options.absoluteUrl = await getAbsoluteURL();
	}
	if (!isValidWordPressVersion(options.wordPressVersion)) {
		throw new Error(
			'Unrecognized WordPress version. Please use "latest" or numeric versions such as "6.2", "6.0.1", "6.2-beta1", or "6.2-RC1"'
		);
	}
	if (
		options.phpVersion &&
		!SupportedPHPVersionsList.includes(options.phpVersion)
	) {
		throw new Error(
			`Unsupported PHP version: ${
				options.phpVersion
			}. Supported versions: ${SupportedPHPVersionsList.join(', ')}`
		);
	}
	return options;
}
