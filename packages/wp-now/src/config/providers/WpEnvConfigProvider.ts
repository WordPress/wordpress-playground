import * as fs from 'fs';
import path from 'path';
import { CliOptions } from './CliConfigProvider';
import { WPEnvOptions } from './ConfigProvider';
import { ConfigProviderInterface, WPNowOptions } from './ConfigProvider';

const WP_ENV_FILE = '.wp-env.json';
const WP_ENV_OVERRIDE_FILE = '.wp-env.override.json';

const WP_ENV_TO_WP_NOW_MAPPER = {
	phpVersion: 'phpVersion',
	core: 'core',
	port: 'port',
};

class WpEnvConfigProvider implements ConfigProviderInterface {
	priority: 1;

	#options: CliOptions | null;
	constructor(options: CliOptions) {
		this.#options = options;
	}

	#mergeConfigs(
		wpEnvConfig: WPEnvOptions,
		wpOverrideEnvConfig: WPEnvOptions
	): WPNowOptions {
		if (!wpEnvConfig && !wpOverrideEnvConfig) {
			return null;
		}

		if (!wpEnvConfig && wpOverrideEnvConfig) {
			return wpOverrideEnvConfig;
		}

		const config: WPNowOptions = {};
		for (const [key, value] of Object.entries(wpEnvConfig || {})) {
			if (wpOverrideEnvConfig && wpOverrideEnvConfig[key]) {
				config[key] = wpOverrideEnvConfig[key];
				continue;
			}
			config[key] = value;
		}
		return config;
	}

	#getConfigPath(configName: string): string {
		return path.join(
			(this.#options.path as string) || process.cwd(),
			configName
		);
	}

	configExists(): boolean {
		const wpEnvConfigPath = this.#getConfigPath(WP_ENV_FILE);
		const wpEnvOverrideConfigPath =
			this.#getConfigPath(WP_ENV_OVERRIDE_FILE);
		return (
			fs.existsSync(wpEnvConfigPath) ||
			fs.existsSync(wpEnvOverrideConfigPath)
		);
	}

	#toWpNow(wpenvConfig: WPEnvOptions): WPNowOptions {
		if (!wpenvConfig) {
			return null;
		}
		const config: WPNowOptions = {};
		for (const [key, value] of Object.entries(wpenvConfig)) {
			if (WP_ENV_TO_WP_NOW_MAPPER[key]) {
				config[WP_ENV_TO_WP_NOW_MAPPER[key]] = value;
			}
		}
		return config;
	}
	public async getConfig(): Promise<WPNowOptions> {
		if (!this.configExists()) {
			return null;
		}
		let wpEnvConfig = null;
		try {
			wpEnvConfig = this.#toWpNow(
				JSON.parse(
					fs.readFileSync(this.#getConfigPath(WP_ENV_FILE), 'utf8')
				)
			);
			// eslint-disable-next-line no-empty
		} catch (error) {}

		let wpOverrideEnvConfig = null;
		try {
			wpOverrideEnvConfig = this.#toWpNow(
				JSON.parse(
					fs.readFileSync(
						this.#getConfigPath(WP_ENV_OVERRIDE_FILE),
						'utf8'
					)
				)
			);
			// eslint-disable-next-line no-empty
		} catch {}
		return this.#mergeConfigs(wpEnvConfig, wpOverrideEnvConfig);
	}
}

export default WpEnvConfigProvider;
