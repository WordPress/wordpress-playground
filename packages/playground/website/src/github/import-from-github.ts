import type { UniversalPHP } from '@php-wasm/universal';
import { writeFiles } from '@php-wasm/universal';
import { basename, dirname, joinPaths } from '@php-wasm/util';
import {
	activatePlugin,
	activateTheme,
	login,
	wpContentFilesExcludedFromExport,
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
	assertSingleDirectoryName(pluginName, 'plugin');
	const documentRoot = await getDocumentRoot(php);
	const pluginPath = joinPaths(
		documentRoot,
		'wp-content/plugins',
		pluginName
	);
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
	assertSingleDirectoryName(themeName, 'theme');
	const documentRoot = await getDocumentRoot(php);
	const themePath = joinPaths(documentRoot, 'wp-content/themes', themeName);
	await writeFiles(php, themePath, files, {
		rmRoot: true,
	});
	await activateTheme(php, {
		themeFolderName: themeName,
	});
}

export async function importWpContent(php: UniversalPHP, files: Files) {
	const documentRoot = await getDocumentRoot(php);
	const wpContentPath = joinPaths(documentRoot, 'wp-content');
	const restorePaths = wpContentFilesExcludedFromExport.map((path) =>
		joinPaths('wp-content', path)
	);
	const backupRoot = createWpContentImportBackupRoot();
	const backupPaths = new Map<string, string>();
	let wpContentWriteStarted = false;
	let importError: unknown;

	try {
		// Backup the required Playground PHP files before replacing wp-content.
		for (const restorePath of restorePaths) {
			const currentPath = joinPaths(documentRoot, restorePath);
			if (await php.fileExists(currentPath)) {
				const backupPath = joinPaths(backupRoot, restorePath);
				await php.mkdirTree(dirname(backupPath));
				await php.mv(currentPath, backupPath);
				backupPaths.set(currentPath, backupPath);
			}
		}

		wpContentWriteStarted = true;
		await writeFiles(php, wpContentPath, files, {
			rmRoot: true,
		});
	} catch (error) {
		importError = error;
	}

	const restoreError = await restoreExcludedWpContentFiles(
		php,
		documentRoot,
		restorePaths,
		backupPaths,
		wpContentWriteStarted
	);
	if (restoreError) {
		throw restoreError;
	}
	await removePathIfExists(php, backupRoot);
	if (importError) {
		throw importError;
	}

	await php.run({
		code: `<?php
            $_GET['step'] = 'upgrade_db';
            require '${escapePhpSingleQuotedString(
				joinPaths(documentRoot, 'wp-admin/upgrade.php')
			)}';
            `,
	});

	await login(php, {});
}

let wpContentImportBackupCounter = 0;

function createWpContentImportBackupRoot() {
	wpContentImportBackupCounter++;
	const backupId = `playground-github-import-backup-${Date.now()}-${wpContentImportBackupCounter}`;
	return joinPaths('/tmp', backupId);
}

async function restoreExcludedWpContentFiles(
	php: UniversalPHP,
	documentRoot: string,
	restorePaths: string[],
	backupPaths: Map<string, string>,
	wpContentWriteStarted: boolean
) {
	let firstRestoreError: unknown;
	for (const restorePath of restorePaths) {
		try {
			const currentPath = joinPaths(documentRoot, restorePath);
			const backupPath = backupPaths.get(currentPath);
			if (wpContentWriteStarted) {
				await removePathIfExists(php, currentPath);
			}
			if (backupPath && (await php.fileExists(backupPath))) {
				await php.mkdirTree(dirname(currentPath));
				await php.mv(backupPath, currentPath);
			}
		} catch (error) {
			firstRestoreError ??= error;
		}
	}
	return firstRestoreError;
}

async function getDocumentRoot(php: UniversalPHP) {
	const root = (php as UniversalPHP & { documentRoot?: Promise<string> })
		.documentRoot;
	return root ? await root : '/wordpress';
}

async function removePathIfExists(php: UniversalPHP, path: string) {
	if (!(await pathExists(php, path))) {
		return;
	}
	if (await php.isDir(path)) {
		await php.rmdir(path, { recursive: true });
	} else {
		await php.unlink(path);
	}
}

async function pathExists(php: UniversalPHP, path: string) {
	if (await php.fileExists(path)) {
		return true;
	}
	try {
		return await php.isDir(path);
	} catch {
		return false;
	}
}

function escapePhpSingleQuotedString(value: string) {
	return value.replace(/['\\]/g, '\\$&');
}

function assertSingleDirectoryName(name: string, label: string) {
	const normalizedName = name.replace(/\\/g, '/');
	const safeName = basename(normalizedName);
	if (
		!safeName ||
		safeName.includes('\0') ||
		safeName === '.' ||
		safeName === '..' ||
		safeName !== normalizedName
	) {
		throw new Error(`Invalid ${label} directory name: ${name}`);
	}
}
