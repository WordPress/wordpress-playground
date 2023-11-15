import { UniversalPHP } from '@php-wasm/universal';
import { activatePlugin, activateTheme } from '@wp-playground/blueprints';
import {
	Files,
	filesListToObject,
	overwritePath,
} from '@wp-playground/storage';
import { ContentType } from './analyze-github-url';

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
	const restorePaths = [
		'wp-content/plugins/sqlite-database-integration',
		'wp-content/database',
		'wp-content/themes',
		'wp-content/mu-plugins',
		'wp-content/db.php',
		'wp-config.php',
	];
	// Backup the required Playground PHP files
	for (const restorePath of restorePaths) {
		const parentPath = restorePath.split('/').slice(0, -1).join('/');
		await php.mkdir(`/tmp/${parentPath}`);
		await php.mv(`/wordpress/${restorePath}`, `/tmp/${restorePath}`);
	}

	await overwritePath(php, '/wordpress/wp-content', files);

	// Restore the required php files
	const muPlugins = await php.listFiles('/tmp/mu-plugins');
	for (const fileName of muPlugins) {
		await php.mv(
			`/tmp/mu-plugins/${fileName}`,
			`/wordpress/wp-content/mu-plugins/${fileName}`
		);
	}
	for (const restorePath of restorePaths) {
		if (!(await php.fileExists(`/wordpress/${restorePath}`))) {
			await php.mv(`/tmp/${restorePath}`, `/wordpress/${restorePath}`);
		}
	}

	await php.run({
		code: `<?php
            $_GET['step'] = 'upgrade_db';
            require '/wordpress/wp-admin/upgrade.php';
            `,
	});
}
