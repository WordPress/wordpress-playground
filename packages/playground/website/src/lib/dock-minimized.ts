/**
 * Reads the `?dock=minimized` Query API parameter. Demos use it to start
 * Playground with the Dock folded into its corner launcher, the same state a
 * user reaches by dragging the Dock past the left edge of the screen.
 */
export function readDockStartsMinimized(
	url: URL = new URL(window.location.href)
): boolean {
	return url.searchParams.get('dock') === 'minimized';
}
