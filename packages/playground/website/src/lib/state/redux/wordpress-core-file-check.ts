/**
 * Check whether the given directory already contains Playground WordPress
 * files.
 *
 * @TODO: Create a shared package like @wp-playground/wordpress for such
 * utilities and bring in the context detection logic from wp-now – only
 * express it in terms of either abstract FS operations or isomorphic PHP FS
 * operations. (we can't just use Node.js require('fs') in the browser, for
 * example)
 *
 * @TODO: Reuse the isWordPressInstalled logic implemented in the boot protocol.
 *        Perhaps mount the stored directory first, and only then check for the
 *        WordPress installation? Or, if not, perhaps implement a shared file
 *        access abstraction that can be used both with the PHP module and OPFS
 *        directory handles?
 */
export async function storedDirectoryHasPlaygroundFiles(
	dirHandle: FileSystemDirectoryHandle
) {
	// Run this loop just to trigger an exception if the directory handle is no
	// good.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	for await (const _ of dirHandle.keys()) {
		break;
	}

	try {
		/**
		 * Assume it's a Playground directory if these files exist:
		 * - wp-config.php
		 * - wp-content/database/.ht.sqlite
		 */
		await dirHandle.getFileHandle('wp-config.php', { create: false });
		const wpContent = await dirHandle.getDirectoryHandle('wp-content', {
			create: false,
		});
		const database = await wpContent.getDirectoryHandle('database', {
			create: false,
		});
		await database.getFileHandle('.ht.sqlite', { create: false });
	} catch (error) {
		if (isMissingFileSystemEntryError(error)) {
			return false;
		}
		throw error;
	}
	return true;
}

/**
 * Whether a stored Playground directory still holds the WordPress core files a
 * boot fatally depends on.
 *
 * `storedDirectoryHasPlaygroundFiles` only proves a site was *started* here
 * (wp-config.php and the SQLite database exist); it can't tell a complete copy
 * from a partial one. A save interrupted mid-copy can keep wp-config.php while
 * dropping core files, and the next boot then fatals on the first missing
 * `require()` (the reported case was `wp-includes/sodium_compat/autoload.php`).
 * Sampling load-bearing files catches that partial state. It's a heuristic (a
 * partial copy could in principle retain all of these), but a false negative
 * just falls back to the generic boot-error view, while the checked files are
 * broad enough to avoid false positives for older WordPress versions.
 */
export async function storedDirectoryHasWordPressCoreFiles(
	dirHandle: FileSystemDirectoryHandle,
	wpVersion: string | false | undefined
): Promise<boolean> {
	try {
		const wpIncludes = await dirHandle.getDirectoryHandle('wp-includes', {
			create: false,
		});
		await Promise.all([
			dirHandle.getFileHandle('wp-settings.php', { create: false }),
			wpIncludes.getFileHandle('version.php', { create: false }),
		]);
		if (shouldRequireSodiumCompatForWordPressVersion(wpVersion)) {
			const sodiumCompat = await wpIncludes.getDirectoryHandle(
				'sodium_compat',
				{ create: false }
			);
			await sodiumCompat.getFileHandle('autoload.php', {
				create: false,
			});
		}
	} catch (error) {
		if (isMissingFileSystemEntryError(error)) {
			return false;
		}
		throw error;
	}
	return true;
}

export function isMissingFileSystemEntryError(error: unknown): boolean {
	const name = getFileSystemErrorName(error);
	return name === 'NotFoundError' || name === 'TypeMismatchError';
}

export function isFileSystemPermissionError(error: unknown): boolean {
	return getFileSystemErrorName(error) === 'NotAllowedError';
}

function getFileSystemErrorName(error: unknown): string | undefined {
	return error instanceof DOMException || error instanceof Error
		? error.name
		: undefined;
}

export function shouldRequireSodiumCompatForWordPressVersion(
	wpVersion: string | false | undefined
): boolean {
	if (wpVersion === false) {
		return false;
	}
	if (!wpVersion) {
		return true;
	}
	const numericVersion = /^(\d+)(?:\.(\d+))?/.exec(wpVersion);
	if (!numericVersion) {
		return true;
	}
	const major = Number(numericVersion[1]);
	const minor = Number(numericVersion[2] ?? 0);
	return major > 5 || (major === 5 && minor >= 2);
}
