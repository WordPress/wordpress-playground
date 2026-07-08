import { basename } from '@php-wasm/util';

/**
 * Converts the user-editable GitHub path field into the relative path expected
 * by GitHub's contents API. Parent traversal is invalid here: the path is a
 * repository path, not a filesystem path, and allowing `..` would later produce
 * unsafe plugin/theme folder names such as `/wordpress/wp-content/plugins/..`.
 */
export function normalizeGitHubImportPath(path: string): string {
	if (path.includes('\0')) {
		throw new Error('Repository path cannot contain null bytes.');
	}
	const parts = path
		.trim()
		.replace(/\\/g, '/')
		.split('/')
		.filter((part) => part.length > 0 && part !== '.');
	if (parts.some((part) => part === '..')) {
		throw new Error('Repository path cannot contain ".." segments.');
	}
	return parts.join('/');
}

export function getGitHubImportDirectoryName(
	repoPath: string,
	fallbackRepoName: string
): string {
	const name = basename(repoPath);
	if (isSafeDirectoryName(name)) {
		return name;
	}
	const fallbackName = basename(fallbackRepoName.replace(/\\/g, '/'));
	if (isSafeDirectoryName(fallbackName)) {
		return fallbackName;
	}
	return 'github-import';
}

function isSafeDirectoryName(name: string) {
	return !!name && name !== '.' && name !== '..' && !name.includes('\0');
}
