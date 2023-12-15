import { UniversalPHP } from '@php-wasm/universal';
import {
	importWordPressFiles,
	installPlugin,
	installTheme,
	login,
} from '@wp-playground/blueprints';
import { collectBytes, zipFiles } from '@wp-playground/stream-compression';

export type ContentType = 'plugin' | 'theme' | 'wp-content';
export async function importFromGitHub(
	php: UniversalPHP,
	gitHubFiles: AsyncIterable<File>,
	contentType: ContentType,
	repoPath: string,
	pluginOrThemeName: string
) {
	if (contentType === 'theme') {
		await installTheme(php, {
			themeZipFile: new File([], pluginOrThemeName),
			files: gitHubFiles,
		});
	} else if (contentType === 'plugin') {
		await installPlugin(php, {
			pluginZipFile: new File([], pluginOrThemeName),
			files: gitHubFiles,
		});
	} else if (contentType === 'wp-content') {
		const zipBytes = await collectBytes(zipFiles(gitHubFiles));
		const zipFile = new File([zipBytes], 'wordpress-playground.zip');
		await importWordPressFiles(php, {
			wordPressFilesZip: zipFile,
		});
		await login(php, {});
	} else {
		throw new Error(`Unknown content type: ${contentType}`);
	}
}
