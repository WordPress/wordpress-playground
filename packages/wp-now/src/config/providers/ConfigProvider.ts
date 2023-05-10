import { SupportedPHPVersion } from '@php-wasm/universal';
import {
	DEFAULT_PHP_VERSION,
	DEFAULT_WORDPRESS_VERSION,
} from '../../constants';

export const DEFAULT_OPTIONS: WPNowOptions = {
	phpVersion: DEFAULT_PHP_VERSION,
	documentRoot: '/var/www/html',
	projectPath: process.cwd(),
	wordPressVersion: DEFAULT_WORDPRESS_VERSION,
	mode: 'auto',
};

export interface ConfigProviderInterface {
	priority: number;
	getConfig(): Promise<WPNowOptions>;
	configExists(): boolean;
}

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
