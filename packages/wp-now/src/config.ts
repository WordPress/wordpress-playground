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
import * as fs from 'fs';

const WP_ENV_FILE = '.wp-env.json';
const WP_ENV_OVERRIDE_FILE = '.wp-env.override.json';

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
	return `http://127.0.0.1:${port}`;
}

function getWpContentHomePath(projectPath: string) {
	const basename = path.basename(projectPath);
	const directoryHash = crypto
		.createHash('sha1')
		.update(projectPath)
		.digest('hex');
	return path.join(
		getWpNowPath(),
		'wp-content',
		`${basename}-${directoryHash}`
	);
}

async function parseWpEnvConfig(path: string): Promise<WPEnvOptions> {
	try {
		return JSON.parse(fs.readFileSync(path, 'utf8'));
	} catch (error) {
		return {} as WPEnvOptions;
	}
}

async function fromWpEnv(cwd: string = process.cwd()): Promise<WPNowOptions> {
	const wpEnvConfig = await parseWpEnvConfig(path.join(cwd, WP_ENV_FILE));
	const wpOverrideEnvConfig = await parseWpEnvConfig(
		path.join(cwd, WP_ENV_OVERRIDE_FILE)
	);
	return {
		phpVersion: wpOverrideEnvConfig.phpVersion || wpEnvConfig.phpVersion,
		wordPressVersion: wpOverrideEnvConfig.core || wpEnvConfig.core,
		port: wpOverrideEnvConfig.port || wpEnvConfig.port,
	};
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

	const wpEnvToNowConfig = await fromWpEnv(optionsFromCli.projectPath);

	const options: WPNowOptions = {} as WPNowOptions;

	[optionsFromCli, wpEnvToNowConfig, DEFAULT_OPTIONS].forEach((config) => {
		for (const key in config) {
			if (!options[key]) {
				options[key] = config[key];
			}
		}
	});

	if (!options.wpContentPath) {
		options.wpContentPath = getWpContentHomePath(options.projectPath);
	}
	if (!options.mode || options.mode === 'auto') {
		options.mode = inferMode(options.projectPath);
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
