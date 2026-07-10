import { describe, expect, it } from 'vitest';
import {
	isValidPosixPathSegment,
	pathContainsPath,
	remapPathAfterMove,
	resolvePathAtOrUnder,
} from './file-tree-paths';

describe('file tree path mutations', () => {
	it('matches and remaps the exact moved path', () => {
		expect(pathContainsPath('/workspace', '/workspace')).toBe(true);
		expect(remapPathAfterMove('/workspace', '/workspace', '/project')).toBe(
			'/project'
		);
	});

	it('matches and remaps descendants of the moved path', () => {
		expect(pathContainsPath('/workspace', '/workspace/src/index.php')).toBe(
			true
		);
		expect(
			remapPathAfterMove(
				'/workspace/src/index.php',
				'/workspace',
				'/project'
			)
		).toBe('/project/src/index.php');
	});

	it('does not match a path that only shares a string prefix', () => {
		const candidate = '/workspace-old/index.php';
		expect(pathContainsPath('/workspace', candidate)).toBe(false);
		expect(remapPathAfterMove(candidate, '/workspace', '/project')).toBe(
			candidate
		);
	});

	it('preserves backslashes as filename bytes', () => {
		const candidate = '/workspace/a\\b.php';
		expect(pathContainsPath('/workspace', candidate)).toBe(true);
		expect(remapPathAfterMove(candidate, '/workspace', '/project')).toBe(
			'/project/a\\b.php'
		);
	});

	it('accepts only literal POSIX filename segments', () => {
		expect(isValidPosixPathSegment('back\\slash.php')).toBe(true);
		expect(isValidPosixPathSegment('two words.txt')).toBe(true);
		expect(isValidPosixPathSegment('')).toBe(false);
		expect(isValidPosixPathSegment('.')).toBe(false);
		expect(isValidPosixPathSegment('..')).toBe(false);
		expect(isValidPosixPathSegment('../escaped.txt')).toBe(false);
		expect(isValidPosixPathSegment('nested/file.txt')).toBe(false);
		expect(isValidPosixPathSegment('null\0byte.txt')).toBe(false);
	});

	it('resolves only the root and absolute-style descendants', () => {
		expect(resolvePathAtOrUnder('/wordpress/', '/wordpress')).toBe(
			'/wordpress'
		);
		expect(
			resolvePathAtOrUnder(
				'/wordpress/wp-content/../index.php',
				'/wordpress'
			)
		).toBe('/wordpress/index.php');
		expect(resolvePathAtOrUnder('wordpress/index.php', '/wordpress')).toBe(
			'/wordpress/index.php'
		);
		expect(resolvePathAtOrUnder('index.php', '/wordpress')).toBeUndefined();
	});

	it('rejects escapes, prefix matches, and null bytes', () => {
		expect(
			resolvePathAtOrUnder('/wordpress/../../escape.php', '/wordpress')
		).toBeUndefined();
		expect(
			resolvePathAtOrUnder('/wordpress-backup/file.php', '/wordpress')
		).toBeUndefined();
		expect(
			resolvePathAtOrUnder('/wordpress/null\0byte.php', '/wordpress')
		).toBeUndefined();
		expect(
			resolvePathAtOrUnder('/wordpress/index.php', '/wordpress\0')
		).toBeUndefined();
	});
});
