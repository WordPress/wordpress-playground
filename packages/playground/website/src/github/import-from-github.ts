import { FileEntry, UniversalPHP } from '@php-wasm/universal';
import {
	importWordPressFiles,
	installPlugin,
	installTheme,
	login,
} from '@wp-playground/blueprints';

export type ContentType = 'plugin' | 'theme' | 'wp-content';
export async function importFromGitHub(
	php: UniversalPHP,
	gitHubFiles: AsyncIterable<FileEntry>,
	contentType: ContentType,
	repoPath: string,
	pluginOrThemeName: string
) {
	if (contentType === 'theme') {
		await installTheme(php, {
			files: gitHubFiles,
			// pluginOrThemeName
		});
	} else if (contentType === 'plugin') {
		await installPlugin(php, {
			files: gitHubFiles,
			// pluginOrThemeName
		});
	} else if (contentType === 'wp-content') {
		await importWordPressFiles(php, {
			files: gitHubFiles,
		});
		await login(php, {});
	} else {
		throw new Error(`Unknown content type: ${contentType}`);
	}
}
