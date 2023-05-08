import { WPNowOptions } from '../wp-now';
import { ConfigProviderInterface, DEFAULT_OPTIONS } from './providers/ConfigProvider';

export interface ConfigMergerInterface {
	merge: () => Promise<WPNowOptions> | null;
	addProvider: (reader: ConfigProviderInterface) => void;
}

class ConfigMerger implements ConfigMergerInterface {
	#providers: ConfigProviderInterface[];

	constructor(providers: ConfigProviderInterface[] | null) {
		this.#providers = [];
		if (providers) {
			providers.forEach((provider) => {
				this.addProvider(provider);
			});
		}
	}

	public async merge(): Promise<WPNowOptions> {
		const mergedConfig: WPNowOptions = {};

		this.#providers.sort((a, b) => a.priority - b.priority);

		for (const configProvider of this.#providers) {
			const config = await configProvider.getConfig();

			for (const key in config) {
				if (!mergedConfig[key]) {
					mergedConfig[key] = config[key];
				}
			}
		}

		for (const [key, value] of Object.entries(DEFAULT_OPTIONS)) {
			if (!mergedConfig[key]) {
				mergedConfig[key] = value;
			}
		}

		return mergedConfig;
	}

	addProvider(configProvider: ConfigProviderInterface): void {
		if (configProvider.configExists()) {
			this.#providers.push(configProvider);
		}
	}
}

export default ConfigMerger;
