import { SupportedPHPVersion } from '@php-wasm/universal';
import path from 'path';
import * as fs from 'fs';

const WP_ENV_FILE = '.wp-env.json';
const WP_ENV_OVERRIDE_FILE = '.wp-env.override.json';

import { DEFAULT_PHP_VERSION, DEFAULT_WORDPRESS_VERSION } from './constants';

export interface CliOptions {
	php: string;
	path: string;
	wp: string;
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
}

export const DEFAULT_OPTIONS: WPNowOptions = {
	phpVersion: DEFAULT_PHP_VERSION,
	wordPressVersion: DEFAULT_WORDPRESS_VERSION,
	documentRoot: '/var/www/html',
	mode: WPNowMode.AUTO,
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
	const optionsFromCli: WPNowOptions = {
		phpVersion: args.php as SupportedPHPVersion,
		projectPath: args.path as string,
		wordPressVersion: args.wp as string,
	};

	const wpEnvToNowConfig = await fromWpEnv(optionsFromCli.projectPath);

	const mergedConfig: WPNowOptions = {} as WPNowOptions;

	[optionsFromCli, wpEnvToNowConfig, DEFAULT_OPTIONS].forEach((config) => {
		for (const key in config) {
			if (!mergedConfig[key]) {
				mergedConfig[key] = config[key];
			}
		}
	});

	return mergedConfig;
}
