import { UniversalPHP } from '@php-wasm/universal';
import { activatePlugin, activateTheme } from '@wp-playground/blueprints';
import {
	Files,
	filesListToObject,
	overwritePath,
} from '@wp-playground/storage';

export type ContentType = 'theme' | 'plugin' | 'wp-content';

export async function importFromGitHub(
	php: UniversalPHP,
	gitHubFiles: any[],
	contentType: ContentType,
	repo: string,
	repoPath: string
) {
	repoPath = repoPath.replace(/^\//, '');
	const playgroundFiles = filesListToObject(gitHubFiles, repoPath);
	console.log({
		playgroundFiles,
		repoPath,
	});
	if (contentType === 'theme') {
		const themeName = repoPath.split('/').pop() || repo;
		await importTheme(php, themeName, playgroundFiles);
	} else if (contentType === 'plugin') {
		const pluginName = repoPath.split('/').pop() || repo;
		await importPlugin(php, pluginName, playgroundFiles);
	} else if (contentType === 'wp-content') {
		await importWpContent(php, playgroundFiles);
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
	console.log({ themeName });
	console.log(files);
	console.log(await php.listFiles(`/wordpress/wp-content/themes/`));
	console.log(
		await php.listFiles(`/wordpress/wp-content/themes/${themeName}`)
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
