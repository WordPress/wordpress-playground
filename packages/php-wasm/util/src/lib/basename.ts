import { normalizePathsArray } from "./join-paths";

/**
 * Returns the last portion of a path.
 *
 * @param path - The path to extract the basename from.
 * @returns The basename of the path.
 */

export function basename(path: string) {
	if (path === '/') {
		return '/';
	}

	const isAbsolute = path.charAt(0) === '/';
	path = normalizePathsArray(
		path.split('/').filter((p: any) => !!p),
		!isAbsolute
	).join('/');
	path = path.replace(/\/$/, '');

	const lastSlash = path.lastIndexOf('/');
	if (lastSlash === -1) {
		return path;
	}
	return path.substr(lastSlash + 1);
}
