import React from 'react';
import { createRoot } from 'react-dom/client';
import { toZipName } from './features/common';
import { ProgressObserver } from '@wordpress/php-wasm';
import { login } from './features/login';
import { installThemeFromDirectory } from './features/install-theme-from-directory';
import { installPluginsFromDirectory } from './features/install-plugins-from-directory';
import { PlaygroundAPI } from './boot-playground';
import PlaygroundViewport from './components/playground-viewport';
import ExportButton from './components/export-button';
import ImportButton from './components/import-button';

const query = new URL(document.location.href).searchParams;
const isSeamless = (query.get('mode') || 'browser') === 'seamless';

const root = createRoot(document.getElementById('root')!);
root.render(
	<PlaygroundViewport
		isSeamless={isSeamless}
		setupPlayground={setupPlayground}
        toolbarButtons={[
            <ImportButton key="export" />,
            <ExportButton key="export" />
        ]}
	/>
);

export async function setupPlayground(
	playground: PlaygroundAPI,
	progressObserver?: ProgressObserver
) {
	const config = {
		initialUrl: query.get('url'),
		login: query.has('login'),
		pluginEditor: query.has('ide'),
		plugins: query.getAll('plugin').map(toZipName),
		theme: toZipName(query.get('theme')),
		importExport: !query.has('disableImportExport'),
	};

	const progressBudgets = {
		login: 0,
		plugins: Math.min(config.plugins.length * 15, 45),
		theme: config.theme ? 20 : 0,
	};

	const totalFeaturesProgressBudgets = sumValues(progressBudgets);
	const bootProgressBudget = 100 - totalFeaturesProgressBudgets;

	if (progressObserver) {
		await playground.onDownloadProgress(
			progressObserver.partialObserver(
				bootProgressBudget,
				'Preparing WordPress...'
			)
		);
	}

	await playground.isReady();

	const needsLogin =
		config.login ||
		config.importExport ||
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

function sumValues(obj: Record<string, number>) {
	return Object.values(obj).reduce((a, b) => a + b, 0);
}
