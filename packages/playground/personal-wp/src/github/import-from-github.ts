import type { UniversalPHP } from '@php-wasm/universal';
import { writeFiles } from '@php-wasm/universal';
import { dirname, joinPaths } from '@php-wasm/util';
import {
	activatePlugin,
	activateTheme,
	getLegacyPlaygroundRuntimeWpContentPaths,
	login,
} from '@wp-playground/blueprints';
import type { Files } from '@wp-playground/storage';
import { filesListToObject } from '@wp-playground/storage';

export type ContentType = 'plugin' | 'theme' | 'wp-content' | 'custom-paths';
export function asContentType(value: any): ContentType | undefined {
	if (
		value === 'plugin' ||
		value === 'theme' ||
		value === 'wp-content' ||
		value === 'custom-paths'
	) {
		return value;
	}
}
export async function importFromGitHub(
	php: UniversalPHP,
	gitHubFiles: any[],
	contentType: ContentType,
	repoPath: string,
	pluginOrThemeName: string
) {
	repoPath = repoPath.replace(/^\//, '');
	const playgroundFiles = filesListToObject(gitHubFiles, repoPath);
	if (contentType === 'theme') {
		await importTheme(php, pluginOrThemeName, playgroundFiles);
	} else if (contentType === 'plugin') {
		await importPlugin(php, pluginOrThemeName, playgroundFiles);
	} else if (contentType === 'wp-content') {
		await importWpContent(php, playgroundFiles);
	} else {
		throw new Error(`Unsupported import content type: ${contentType}`);
	}
}

export async function importPlugin(
	php: UniversalPHP,
	pluginName: string,
	files: Files
) {
	const pluginPath = `/wordpress/wp-content/plugins/${pluginName}`;
	await writeFiles(php, pluginPath, files, {
		rmRoot: true,
	});
	await activatePlugin(php, {
		pluginPath,
	});
}

export async function importTheme(
	php: UniversalPHP,
	themeName: string,
	files: Files
) {
	const themePath = `/wordpress/wp-content/themes/${themeName}`;
	await writeFiles(php, themePath, files, {
		rmRoot: true,
	});
	await activateTheme(php, {
		themeFolderName: themeName,
	});
}

export async function importWpContent(php: UniversalPHP, files: Files) {
	const wpContentPath = '/wordpress/wp-content';
	const temporaryWpContentPath = '/tmp/wp-content';
	const currentRuntimePaths = await getLegacyPlaygroundRuntimeWpContentPaths(
		php,
		wpContentPath
	);

	await removePath(php, temporaryWpContentPath);
	let importSucceeded = false;
	try {
		// Back up runtime artifacts supplied by the current Playground.
		for (const relativePath of currentRuntimePaths) {
			const currentPath = joinPaths(wpContentPath, relativePath);
			const temporaryPath = joinPaths(
				temporaryWpContentPath,
				relativePath
			);
			if (await php.fileExists(currentPath)) {
				await php.mkdir(dirname(temporaryPath));
				await php.mv(currentPath, temporaryPath);
			}
		}

		await writeFiles(php, wpContentPath, files, {
			rmRoot: true,
		});

		// Remove runtime artifacts committed by older Playgrounds. A custom db.php
		// has no Playground marker and remains part of the imported site.
		const importedRuntimePaths =
			await getLegacyPlaygroundRuntimeWpContentPaths(php, wpContentPath);
		for (const relativePath of importedRuntimePaths) {
			await removePath(php, joinPaths(wpContentPath, relativePath));
		}
		importSucceeded = true;
	} finally {
		for (const relativePath of currentRuntimePaths) {
			const currentPath = joinPaths(wpContentPath, relativePath);
			const temporaryPath = joinPaths(
				temporaryWpContentPath,
				relativePath
			);
			if (!importSucceeded && (await php.fileExists(temporaryPath))) {
				await removePath(php, currentPath);
			}
			if (
				!(await php.fileExists(currentPath)) &&
				(await php.fileExists(temporaryPath))
			) {
				await php.mkdir(dirname(currentPath));
				await php.mv(temporaryPath, currentPath);
			}
		}

		await removePath(php, temporaryWpContentPath);
	}

	await php.run({
		code: `<?php
            $_GET['step'] = 'upgrade_db';
            require '/wordpress/wp-admin/upgrade.php';
            `,
	});

	await login(php, {});
}

async function removePath(php: UniversalPHP, path: string) {
	if (!(await php.fileExists(path))) {
		return;
	}
	if (await php.isDir(path)) {
		await php.rmdir(path, { recursive: true });
	} else {
		await php.unlink(path);
	}
}
