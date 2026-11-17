/**
 * Build-version URL used by development and portable builds for the WordPress
 * bridge (wordpress-bridge.html), the hidden iframe that relays HTTP to PHP.
 * Production builds with release directories use /releases/<id>/wordpress-bridge.html.
 *
 * PRE_RELEASE_HELPER_URL_COMPAT: root aliases are legacy on production hosts.
 * Before release directories, an installed worker could return bridge HTML that
 * named a script the next deployment removed. A new build's URL must reach the
 * server so it gets the deployed bridge and updates the worker before PHP starts.
 * Keep these URLs for development and portable builds when retiring old production aliases.
 */
export function getWordPressBridgePath(buildVersion: string): string {
	return `/wordpress-bridge-${buildVersion}.html`;
}

/**
 * Recognize the unversioned /wordpress-bridge.html and its build-version aliases.
 * PRE_RELEASE_HELPER_URL_COMPAT: old managed-host clients use these aliases;
 * portable and development builds still generate them as their current URLs.
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
