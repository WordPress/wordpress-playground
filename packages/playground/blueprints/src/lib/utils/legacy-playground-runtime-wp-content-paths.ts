import type { UniversalPHP } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import { PLAYGROUND_MANAGED_DB_PHP_MARKER } from '@wp-playground/wordpress';

/**
 * Playground runtime artifacts written under wp-content by older runtimes.
 * Current runtime code lives under /internal/shared and is outside site
 * snapshots.
 *
 * These fixed paths are reserved for Playground. db.php is handled separately
 * because WordPress also supports user-provided database drop-ins there.
 */
const legacyPlaygroundRuntimeWpContentPaths = [
	'mu-plugins/sqlite-database-integration',
	'mu-plugins/playground-includes',
	'mu-plugins/0-playground.php',
	'mu-plugins/0-sqlite.php',
] as const;

/**
 * Returns the paths reserved for legacy runtime artifacts. db.php is included
 * only when the file carries Playground's marker; unmarked user drop-ins
 * remain part of the site snapshot.
 */
export async function getLegacyPlaygroundRuntimeWpContentPaths(
	playground: UniversalPHP,
	wpContentPath: string
): Promise<string[]> {
	const paths: string[] = [...legacyPlaygroundRuntimeWpContentPaths];
	const dbPhpPath = joinPaths(wpContentPath, 'db.php');
	if (
		(await playground.fileExists(dbPhpPath)) &&
		!(await playground.isDir(dbPhpPath)) &&
		(await playground.readFileAsText(dbPhpPath)).includes(
			PLAYGROUND_MANAGED_DB_PHP_MARKER
		)
	) {
		paths.push('db.php');
	}
	return paths;
}
