import {
	basename,
	dirname,
	ensureAbsolutePath,
	isParentOf,
	joinPaths,
	normalizePath,
	resolvePathUnder,
} from '@php-wasm/util';

/** Remaps a path from one moved subtree to another without slicing strings. */
export function remapPathAfterMove(
	value: string | null,
	from: string,
	to: string
): string | null {
	if (!value) {
		return value;
	}
	const normalizedValue = normalizePath(value);
	const normalizedFrom = normalizePath(from);
	const normalizedTo = normalizePath(to);
	if (normalizedValue === normalizedFrom) {
		return normalizedTo;
	}
	if (!isParentOf(normalizedFrom, normalizedValue)) {
		return value;
	}

	const descendantSegments: string[] = [];
	let current = normalizedValue;
	while (current !== normalizedFrom) {
		descendantSegments.unshift(basename(current));
		const parent = dirname(current);
		if (!parent || parent === current) {
			return value;
		}
		current = parent;
	}
	return joinPaths(normalizedTo, ...descendantSegments);
}

/** Reports whether a candidate path is equal to or below another path. */
export function pathContainsPath(path: string, candidate: string | null) {
	if (!candidate) {
		return false;
	}
	const normalizedPath = normalizePath(path);
	const normalizedCandidate = normalizePath(candidate);
	return (
		normalizedCandidate === normalizedPath ||
		isParentOf(normalizedPath, normalizedCandidate)
	);
}

/**
 * Resolves an absolute-style path only when it is the root or its descendant.
 *
 * Relative-looking inputs keep the existing filesystem-root semantics:
 * `wordpress/file.php` means `/wordpress/file.php`, not `<root>/wordpress/file.php`.
 */
export function resolvePathAtOrUnder(path: string, root: string) {
	if (!path || path.includes('\0') || root.includes('\0')) {
		return undefined;
	}
	const normalizedRoot = ensureAbsolutePath(root);
	const absolutePath = ensureAbsolutePath(path);
	return absolutePath === normalizedRoot
		? normalizedRoot
		: resolvePathUnder(absolutePath, normalizedRoot);
}

/** Reports whether a value is one literal segment of a POSIX filesystem path. */
export function isValidPosixPathSegment(value: string) {
	return Boolean(
		value &&
		value !== '.' &&
		value !== '..' &&
		!value.includes('/') &&
		!value.includes('\0')
	);
}
