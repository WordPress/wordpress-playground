export type DockToolsScrollMetrics = {
	clientWidth: number;
	scrollLeft: number;
	scrollWidth: number;
};

const SCROLL_EDGE_TOLERANCE = 1;

/** Reports which horizontal edges have more Dock destinations beyond them. */
export function getDockToolsOverflow({
	clientWidth,
	scrollLeft,
	scrollWidth,
}: DockToolsScrollMetrics) {
	const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
	// Elastic scrolling can briefly report positions outside the real range.
	const clampedScrollLeft = Math.min(
		Math.max(0, scrollLeft),
		maxScrollLeft
	);

	return {
		canScrollBackward: clampedScrollLeft > SCROLL_EDGE_TOLERANCE,
		canScrollForward:
			maxScrollLeft - clampedScrollLeft > SCROLL_EDGE_TOLERANCE,
	};
}
