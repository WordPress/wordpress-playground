/**
 * Converts a zip file name to a nice, human-readable name.
 *
 * @example	`hello-dolly.zip` -> `Hello dolly`
 *
 * @param zipName A zip filename.
 * @returns A nice, human-readable name.
 */
export function zipNameToHumanName(zipName: string) {
	const mixedCaseName = zipName.split('.').shift()!.replace(/-/g, ' ');
	return (
		mixedCaseName.charAt(0).toUpperCase() +
		mixedCaseName.slice(1).toLowerCase()
	);
}
