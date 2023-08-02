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
	const isAbsolute = path.charAt(0) === '/';
	const trailingSlash = path.substring(path.length - 1) === '/';
	path = normalizePathsArray(
		path.split('/').filter((p: any) => !!p),
		!isAbsolute
	).join('/');
	if (!path && !isAbsolute) {
		path = '.';
	}
	if (path && trailingSlash) {
		path += '/';
	}
	return (isAbsolute ? '/' : '') + path;
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
function normalizePathsArray(parts: string[], allowAboveRoot: boolean) {
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
