/**
 * The functions in this module are mostly copied from the generated
 * Emscripten PHP module. This enables features like filesystem journaling,
 * which use some low-level Emscripten APIs and need access to the
 * same path helpers.
 */

/**
 * Joins paths together.
 *
 * For example:
 *
 * > joinPaths('wordpress', 'wp-content')
 * 'wordpress/wp-content'
 *
 * Use this for all PHP paths and **do not** use path.join().
 * This is important because Emscripten paths are **always**
 * POSIX-style paths. Imagine joining paths on Windows:
 *
 * > path.join('wordpress', 'wp-content')
 * '\\wordpress\\wp-content'  // invalid in PHP.wasm
 *
 * See the path.join issue for more details:
 *
 * https://github.com/WordPress/playground-tools/issues/11#issuecomment-1579074763
 *
 * @param paths Paths segments to join
 * @returns A joined path
 */
export function joinPaths(...paths: string[]) {
	let path = paths.join('/');
	const isAbsolute = path[0] === '/';
	const trailingSlash = path.substring(path.length - 1) === '/';
	path = normalizePath(path);
	if (!path && !isAbsolute) {
		path = '.';
	}
	if (path && trailingSlash) {
		path += '/';
	}
	return path;
}

/**
 * Returns the directory name of a path.
 *
 * @param path
 * @returns
 */
export function dirname(path: string) {
	if (path === '/') {
		return '/';
	}

	path = normalizePath(path);

	const lastSlash = path.lastIndexOf('/');
	if (lastSlash === -1) {
		return '';
	} else if (lastSlash === 0) {
		return '/';
	}
	return path.substr(0, lastSlash);
}

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

	path = normalizePath(path);

	const lastSlash = path.lastIndexOf('/');
	if (lastSlash === -1) {
		return path;
	}
	return path.substr(lastSlash + 1);
}

/**
 * Normalizes a path.
 *
 * For example:
 *
 * > normalizePath('wordpress/wp-content/../')
 * 'wordpress'
 *
 * @param path
 * @returns
 */
export function normalizePath(path: string) {
	const isAbsolute = path[0] === '/';
	path = normalizePathsArray(
		path.split('/').filter((p: any) => !!p),
		!isAbsolute
	).join('/');
	return (isAbsolute ? '/' : '') + path.replace(/\/$/, '');
}

/**
 * Normalizes paths.
 *
 * For example:
 *
 * > normalizePathsArray(['wordpress', 'wp-content', '..', '', '.', 'wp-includes'])
 * ['wordpress', 'wp-includes']
 *
 * @param parts parts of the path to normalize
 * @param allowAboveRoot allow paths above the root
 * @returns normalized paths
 */
export function normalizePathsArray(parts: string[], allowAboveRoot: boolean) {
	let up = 0;
	for (let i = parts.length - 1; i >= 0; i--) {
		const last = parts[i];
		if (last === '.') {
			parts.splice(i, 1);
		} else if (last === '..') {
			parts.splice(i, 1);
			up++;
		} else if (up) {
			parts.splice(i, 1);
			up--;
		}
	}
	if (allowAboveRoot) {
		for (; up; up--) {
			parts.unshift('..');
		}
	}
	return parts;
}

/**
 * Checks if the given parent path is an ancestor of the given child path.
 *
 * @param parent The parent path to check.
 * @param child The child path to verify against the parent.
 * @returns Whether the `parent` path is an ancestor of the `child` path.
 */
export function isParentOf(parent: string, child: string) {
	if (parent === '/') {
		return true;
	}
	parent = normalizePath(parent);
	child = normalizePath(child);
	return child.startsWith(parent + '/') || child === parent;
}
