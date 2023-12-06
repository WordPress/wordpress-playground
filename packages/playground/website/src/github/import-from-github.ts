import { UniversalPHP } from '@php-wasm/universal';
import { dirname, joinPaths } from '@php-wasm/util';
import {
	activatePlugin,
	activateTheme,
	login,
	wpContentFilesExcludedFromExport,
} from '@wp-playground/blueprints';
import {
	Files,
	filesListToObject,
	overwritePath,
} from '@wp-playground/storage';

export type ContentType = 'plugin' | 'theme' | 'wp-content';
export async function importFromGitHub(
	php: UniversalPHP,
	gitHubFiles: any[],
	contentType: ContentType,
	repoPath: string,
	pluginOrThemeName: string
) {
	repoPath = repoPath.replace(/^\//, '');
	const playgroundFiles = filesListToObject(gitHubFiles, repoPath);
	console.log({ contentType });
	if (contentType === 'theme') {
		await importTheme(php, pluginOrThemeName, playgroundFiles);
	} else if (contentType === 'plugin') {
		await importPlugin(php, pluginOrThemeName, playgroundFiles);
	} else if (contentType === 'wp-content') {
		await importWpContent(php, playgroundFiles);
	} else {
		throw new Error(`Unknown content type: ${contentType}`);
	}
}

export async function importPlugin(
	php: UniversalPHP,
	pluginName: string,
	files: Files
) {
	const pluginPath = `/wordpress/wp-content/plugins/${pluginName}`;
	await overwritePath(php, pluginPath, files);
	await activatePlugin(php, {
		pluginPath,
	});
}

export async function importTheme(
	php: UniversalPHP,
	themeName: string,
	files: Files
) {
	await overwritePath(
		php,
		`/wordpress/wp-content/themes/${themeName}`,
		files
	);
	await activateTheme(php, {
		themeFolderName: themeName,
	});
}

export async function importWpContent(php: UniversalPHP, files: Files) {
	const restorePaths = wpContentFilesExcludedFromExport.map((path) =>
		joinPaths('wp-content', path)
	);

	// Backup the required Playground PHP files
	for (const restorePath of restorePaths) {
		if (await php.fileExists(`/wordpress/${restorePath}`)) {
			await php.mkdir(`/tmp/${dirname(restorePath)}`);
			await php.mv(`/wordpress/${restorePath}`, `/tmp/${restorePath}`);
		}
	}

	await overwritePath(php, '/wordpress/wp-content', files);

	for (const restorePath of restorePaths) {
		if (
			(await php.fileExists(`/tmp/${restorePath}`)) &&
			!(await php.fileExists(`/wordpress/${restorePath}`))
		) {
			await php.mkdir(`/wordpress/${dirname(restorePath)}`);
			await php.mv(`/tmp/${restorePath}`, `/wordpress/${restorePath}`);
		}
	}

	await php.run({
		code: `<?php
            $_GET['step'] = 'upgrade_db';
            require '/wordpress/wp-admin/upgrade.php';
            `,
	});

	await login(php, {});
}
