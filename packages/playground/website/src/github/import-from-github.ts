import { activatePlugin, activateTheme } from '@wp-playground/blueprints';
import { Files, overwritePath } from '@wp-playground/storage';
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
