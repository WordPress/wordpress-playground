import {
	ensureAbsolutePath,
	joinPaths,
	normalizePath,
	resolvePathUnder,
} from '@php-wasm/util';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';

export const LOCAL_DIRECTORY_MOUNTPOINT = '/app' as const;

export type LocalDirectorySiteMode = 'php' | 'wordpress';

/**
 * Persisted boot configuration for a site backed by a selected local directory.
 * The document root stays relative so metadata cannot name a path outside the
 * fixed mountpoint.
 */
export interface LocalDirectoryBootConfiguration {
	mountpoint: typeof LOCAL_DIRECTORY_MOUNTPOINT;
	documentRoot: string;
	siteMode: LocalDirectorySiteMode;
}

/**
 * Resolves a configured document root beneath the fixed local mountpoint.
 *
 * Rejects unexpected mountpoints, site modes, non-canonical paths, and paths
 * that escape the mounted project.
 */
export function getLocalDirectoryDocumentRoot(
	configuration: LocalDirectoryBootConfiguration
): string {
	assertValidLocalDirectorySiteMode(configuration.siteMode);
	if (configuration.mountpoint !== LOCAL_DIRECTORY_MOUNTPOINT) {
		throw new Error('Invalid local directory mountpoint.');
	}
	if (!configuration.documentRoot) {
		return configuration.mountpoint;
	}

	const resolvedPath = resolveRelativeDocumentRoot(
		configuration.documentRoot,
		configuration.mountpoint
	);
	if (!resolvedPath) {
		throw new Error('Invalid local directory document root.');
	}
	return resolvedPath;
}

/**
 * Converts a canonical absolute tree selection into the persisted relative path.
 * The tree root `/` becomes an empty path; non-canonical paths are rejected rather
 * than silently normalized.
 */
export function getRelativeLocalDirectoryDocumentRoot(
	selectedPath: string
): string {
	if (
		normalizePath(selectedPath) !== selectedPath ||
		ensureAbsolutePath(selectedPath) !== selectedPath
	) {
		throw new Error('Invalid local directory tree path.');
	}
	if (selectedPath === '/') {
		return '';
	}

	const relativePath = joinPaths('.', selectedPath);
	if (
		!resolveRelativeDocumentRoot(relativePath, LOCAL_DIRECTORY_MOUNTPOINT)
	) {
		throw new Error('Invalid local directory document root.');
	}
	return relativePath;
}

/**
 * Converts a relative document root into a picker-rooted absolute path.
 * Non-canonical or escaping paths are rejected rather than normalized.
 */
export function getLocalDirectoryPickerPath(documentRoot: string): string {
	if (!documentRoot) {
		return '/';
	}
	if (
		!resolveRelativeDocumentRoot(documentRoot, LOCAL_DIRECTORY_MOUNTPOINT)
	) {
		throw new Error('Invalid local directory document root.');
	}
	return joinPaths('/', documentRoot);
}

/**
 * Classifies only complete SQLite-backed WordPress trees as WordPress sites.
 * Every other directory stays in PHP-only mode, where WordPress boot never runs.
 */
export async function detectLocalDirectorySiteMode(
	filesystem: AsyncWritableFilesystem,
	documentRoot: string
): Promise<LocalDirectorySiteMode> {
	const pickerPath = getLocalDirectoryPickerPath(documentRoot);
	// Listing validates that the selected path is a readable directory. Do not
	// turn permission or missing-directory failures into a generic PHP site.
	await filesystem.listFiles(pickerPath);

	const requiredFiles = [
		joinPaths(pickerPath, 'wp-config.php'),
		joinPaths(pickerPath, 'wp-includes/version.php'),
		joinPaths(pickerPath, 'wp-content/database/.ht.sqlite'),
	];
	for (const path of requiredFiles) {
		if (
			!(await filesystem.fileExists(path)) ||
			(await filesystem.isDir(path))
		) {
			return 'php';
		}
	}
	return 'wordpress';
}

export function isLocalDirectoryPhpApp(
	configuration: LocalDirectoryBootConfiguration | undefined
) {
	return configuration?.siteMode === 'php';
}

/**
 * Resolves only canonical relative paths beneath a mountpoint.
 *
 * Returns undefined so callers can report errors appropriate to their input
 * boundary.
 */
function resolveRelativeDocumentRoot(
	documentRoot: string,
	mountpoint: string
): string | undefined {
	if (
		normalizePath(documentRoot) !== documentRoot ||
		joinPaths('.', documentRoot) !== documentRoot
	) {
		return undefined;
	}
	return resolvePathUnder(documentRoot, mountpoint);
}

function assertValidLocalDirectorySiteMode(
	siteMode: LocalDirectorySiteMode
): void {
	if (siteMode !== 'php' && siteMode !== 'wordpress') {
		throw new Error('Invalid local directory site mode.');
	}
}
