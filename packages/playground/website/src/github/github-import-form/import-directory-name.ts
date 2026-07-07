import { basename } from '@php-wasm/util';

const FALLBACK_IMPORT_DIRECTORY = 'github-import';

/**
 * Returns a safe plugin/theme folder name for files imported from GitHub.
 *
 * The repository path itself is left unchanged for fetching; this only chooses
 * the local WordPress directory name used after the files are downloaded.
 */
export function getGitHubImportDirectoryName(
	repoPath: string,
	fallbackRepoName: string
): string {
	const pathName = basename(repoPath);
	if (isSafeDirectoryName(pathName)) {
		return pathName;
	}

	const fallbackName = basename(fallbackRepoName.replace(/\\/g, '/'));
	if (isSafeDirectoryName(fallbackName)) {
		return fallbackName;
	}

	return FALLBACK_IMPORT_DIRECTORY;
}

function isSafeDirectoryName(name: string) {
	return (
		!!name &&
		name !== '.' &&
		name !== '..' &&
		!name.includes('/') &&
		!name.includes('\\') &&
		!name.includes('\0')
	);
}
