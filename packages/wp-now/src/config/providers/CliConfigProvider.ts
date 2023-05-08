import { SupportedPHPVersion } from '@php-wasm/universal';
import { ConfigProviderInterface } from './ConfigProvider';

export interface CliOptions {
	php: string;
	path: string;
  wp: string;
}

class CliConfigProvider implements ConfigProviderInterface {
	priority: 1;

	#options: CliOptions | null;
	constructor(options: CliOptions) {
		this.#options = options;
	}

	public configExists(): boolean {
		return Boolean(this.#options);
	}

	public async getConfig() {
		if (!this.configExists()) {
			return null;
		}
		return {
			projectPath: this.#options.path as string,
			phpVersion: this.#options.php as SupportedPHPVersion,
		};
	}
}

export default CliConfigProvider;
