import { ProgressObserver } from '@wp-playground/php-wasm-progress';
import type { PlaygroundClient } from '@wp-playground/playground-client';

import {
  login,
  installThemeFromDirectory,
  installPluginsFromDirectory,
} from '@wp-playground/playground-client';

const query = new URL(document.location.href).searchParams;

export async function setupPlayground(
  playground: PlaygroundClient,
  progressObserver?: ProgressObserver
) {
  const config = {
    initialUrl: query.get('url'),
    login: query.has('login'),
    pluginEditor: query.has('ide'),
    plugins: query.getAll('plugin').map(toZipName),
    theme: query.has('theme') ? toZipName(query.get('theme')!) : undefined,
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

export function toZipName(rawInput: string) {
  if (!rawInput) {
    return rawInput;
  }
  if (rawInput.endsWith('.zip')) {
    return rawInput;
  }
  return rawInput + '.latest-stable.zip';
}
