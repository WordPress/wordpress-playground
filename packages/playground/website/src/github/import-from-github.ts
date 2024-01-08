import { UniversalPHP } from '@php-wasm/universal';
import {
	importWordPressFiles,
	installPlugin,
	installTheme,
	login,
} from '@wp-playground/blueprints';
import { collectFile, encodeZip } from '@php-wasm/stream-compression';

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
		await importWordPressFiles(php, {
			wordPressFilesZip: await collectFile(
				'wordpress-playground.zip',
				encodeZip(gitHubFiles)
			),
		});
		await login(php, {});
	} else {
		throw new Error(`Unknown content type: ${contentType}`);
	}
}
