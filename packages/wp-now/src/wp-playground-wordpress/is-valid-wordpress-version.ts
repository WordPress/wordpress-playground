/**
 * Checks if the given version string is a valid WordPress version.
 *
 * The Regex is based on the releases on https://wordpress.org/download/releases/#betas
 * The version string can be one of the following formats:
 * - "latest"
 * - "x.y" (x and y are integers) e.g. "6.2"
 * - "x.y.z" (x, y and z are integers) e.g. "6.2.1"
 * - "x.y.z-betaN" (N is an integer) e.g. "6.2.1-beta1"
 * - "x.y.z-RCN" (N is an integer) e.g. "6.2-RC1"
 *
 * @param version The version string to check.
 * @returns A boolean value indicating whether the version string is a valid WordPress version.
 */
export function isValidWordPressVersion(version: string): boolean {
	const versionPattern =
		/^latest$|^(?:(\d+)\.(\d+)(?:\.(\d+))?)((?:-beta(?:\d+)?)|(?:-RC(?:\d+)?))?$/;
	return versionPattern.test(version);
}
