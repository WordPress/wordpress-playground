/**
 * Give each app build its own helper document URL.
 *
 * For example, a browser can still run release A's WordPress worker after
 * release B is deployed. A's helper HTML names A's script, which B may no longer
 * serve. Including B's buildVersion in the helper path lets that request reach
 * the server, so the deployed helper can load its script and update the worker
 * before PHP startup finishes.
 */
export function getWordPressBridgePath(buildVersion: string): string {
	return `/wordpress-bridge-${buildVersion}.html`;
}

/**
 * Recognize the unversioned /wordpress-bridge.html and its build-version aliases.
 * Servers map every alias to the deployed release's wordpress-bridge.html file;
 * the version cannot select a historical release, an app document, or PHP.
 * Git builds use a hexadecimal commit ID; builds outside Git use a timestamp.
 */
export function isWordPressBridgePath(pathname: string): boolean {
	return (
		pathname === '/wordpress-bridge.html' ||
		/^\/wordpress-bridge-[a-f0-9]+\.html$/.test(pathname)
	);
}
