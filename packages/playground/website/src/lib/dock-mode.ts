export type DockMode =
	| 'minimized'
	| 'collapsed'
	| 'expanded'
	| 'full-width'
	| 'full-width-collapsed';

/** Reads the initial Dock mode, leaving unknown values to the saved preference. */
export function readDockMode(
	url: URL = new URL(window.location.href)
): DockMode | undefined {
	const mode = url.searchParams.get('dock');
	switch (mode) {
		case 'minimized':
		case 'collapsed':
		case 'expanded':
		case 'full-width':
		case 'full-width-collapsed':
			return mode;
		default:
			return undefined;
	}
}
