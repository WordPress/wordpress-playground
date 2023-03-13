import type { PlaygroundAPI } from './boot-playground';
import { ProgressObserver, consumeAPI } from '@wordpress/php-wasm'
import { login } from './features/login';
import { installThemeFromDirectory } from './features/install-theme-from-directory';
import { installPluginsFromDirectory } from './features/install-plugins-from-directory';

export async function connectToPlayground(iframe: HTMLIFrameElement, url: string) {
	iframe.src = url;
	await new Promise((resolve) => {
		iframe.addEventListener('load', resolve, false);
	});
	return consumeAPI(iframe.contentWindow!) as PlaygroundAPI;
}

export interface Config {
	login?: boolean,
	plugins?: string[],
	theme?: string,
}

export async function setupPlayground(
	playground: PlaygroundAPI,
	config: Config = {},
	progressObserver?: ProgressObserver
) {
	const progressBudgets = {
		login: 0,
		plugins: config.plugins ? Math.min(config.plugins.length * 15, 45) : 0,
		theme: config.theme ? 20 : 0,
	};
	
	const totalFeaturesProgressBudgets = Object.values(progressBudgets).reduce(
		(a, b) => a + b,
		0
	);
	const bootProgressBudget = 100 - totalFeaturesProgressBudgets;
	
	if (progressObserver) {
		await playground.onDownloadProgress(
			progressObserver.partialObserver(
				bootProgressBudget,
				'Preparing WordPress...'
			)
		);
	}

	const needsLogin =
		config.login ||
		config.plugins?.length ||
		config.theme;

	if (needsLogin) {
		await login(playground, 'admin', 'password');
	}

	if (config.theme) {
		await installThemeFromDirectory(
			playground,
			config.theme,
			progressBudgets.theme,
			progressObserver
		);
	}

	if (config.plugins?.length) {
		await installPluginsFromDirectory(
			playground,
			config.plugins,
			progressBudgets.plugins,
			progressObserver
		);
	}
}
