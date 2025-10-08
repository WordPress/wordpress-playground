// This is a placeholder for a constant build version
// which will be inserted here during a production build.
export const buildVersion = getDevelopmentBuildVersion();

function getDevelopmentBuildVersion() {
	// We use a time-based build version during development,
	// so the version will be different for each load.
	return Date.now().toString();
}

// Export this function so it can be used by Vite during production build.
export async function getProductionBuildVersion() {
	// Lazy load `child_process` because it is Node.js-only
	// and the buildVersion export is used in both client and server code.
	const { execSync } = await import('child_process');
	try {
		// Note that this will produce a stable version string across multiple
		// package builds (as long as the build does not change the git HEAD).
		return execSync('git rev-parse HEAD').toString().trim();
	} catch (e) {
		// Within a single production build of all Playground packages,
		// we need the version string to be constant, so we cannot use
		// the current timestamp which will be different for each package build.
		// This assumes `git` is present during production builds,
		// but I think it is a reasonable assumption for this project.
		throw new Error('Failed to get build version: ' + e);
	}
}
