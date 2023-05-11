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

export const DEFAULT_OPTIONS: WPNowOptions = {
	phpVersion: DEFAULT_PHP_VERSION,
	documentRoot: '/var/www/html',
	projectPath: process.cwd(),
	wordPressVersion: DEFAULT_WORDPRESS_VERSION,
};

type WPNowMode = 'plugin' | 'theme' | 'core' | 'index' | 'auto';

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

async function parseWpEnvConfig(path: string): Promise<WPNowOptions> {
	try {
		return JSON.parse(fs.readFileSync(path, 'utf8'));
	} catch (error) {
		return {};
	}
}

async function fromWpEnv(cwd: string = process.cwd()): Promise<WPNowOptions> {
	const wpEnvConfig = await parseWpEnvConfig(path.join(cwd, WP_ENV_FILE));
	const wpOverrideEnvConfig = await parseWpEnvConfig(
		path.join(cwd, WP_ENV_OVERRIDE_FILE)
	);
	return {
		...wpEnvConfig,
		...wpOverrideEnvConfig,
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

	return {
		...DEFAULT_OPTIONS,
		...wpEnvToNowConfig,
		...optionsFromCli,
	};
}
