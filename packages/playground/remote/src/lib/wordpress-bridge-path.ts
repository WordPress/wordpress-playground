/**
 * Give each app build its own helper document URL.
 *
 * An older WordPress worker must not supply helper HTML pointing at JavaScript
 * removed by a newer deployment. A new path reaches the server instead, where
 * the current helper can register the current worker before PHP startup finishes.
 */
export function getWordPressBridgePath(buildVersion: string): string {
	return `/wordpress-bridge-${buildVersion}.html`;
}

/**
 * Recognize only the legacy helper and its build-keyed aliases, never app HTML.
 * Servers map these aliases to the existing built wordpress-bridge.html file.
 * Git builds use a hexadecimal commit ID; builds outside Git use a timestamp.
 */
export function isWordPressBridgePath(pathname: string): boolean {
	return (
		pathname === '/wordpress-bridge.html' ||
		/^\/wordpress-bridge-[a-f0-9]+\.html$/.test(pathname)
	);
}
