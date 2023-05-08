import CliConfigProvider, {
	CliOptions,
} from './providers/CliConfigProvider';
import { WPNowOptions } from './providers/ConfigProvider';
import ConfigMerger from './ConfigMerger';
import WpEnvConfigProvider from './providers/WpEnvConfigProvider';

export interface ConfigFactoryOptions {
	cliOptions?: CliOptions;
}

export interface ConfigFactoryInterface {
	read(options: ConfigFactoryOptions): Promise<WPNowOptions>;
}

class ConfigFactory implements ConfigFactoryInterface {
	#config: WPNowOptions | null;
	static #instance: ConfigFactory;

	private constructor() {}

	public static getInstance(): ConfigFactory {
		if (!ConfigFactory.#instance) {
			ConfigFactory.#instance = new ConfigFactory();
		}
		return ConfigFactory.#instance;
	}
	async read(options: ConfigFactoryOptions) {
		if (this.#config) {
			return this.#config;
		}
		const cliConfigProvider = new CliConfigProvider(
			options.cliOptions
		);
		const wpEnvConfigProvider = new WpEnvConfigProvider(options.cliOptions);

		const configProviders = [cliConfigProvider, wpEnvConfigProvider];

		const configMerger = new ConfigMerger(configProviders);
		this.#config = await configMerger.merge();
		return this.#config;
	}
}

export default ConfigFactory;
