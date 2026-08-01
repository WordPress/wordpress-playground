import type { CSSProperties } from 'react';

export const DOCK_DRAG_EDGE = 8;
export const DOCK_PANE_GAP = 12;
export const DOCK_PANE_MIN_HEIGHT = 160;
export const DOCK_OPERATION_TOAST_MIN_HEIGHT = 62;

const LIST_PANE_HEIGHT = 560;
const OPERATION_TOAST_WIDTH = 520;

type Size = { width: number; height: number };

/** Positions one pane above its Dock, or full-screen above the mobile bar. */
export function getDockPaneStyle({
	isMobile,
	dockSize,
	dockCenter,
	viewportSize,
	isEditorSection,
	isFixedHeightSection,
	isPlaygroundsSection,
}: {
	isMobile: boolean;
	dockSize: Size;
	dockCenter: number | null;
	viewportSize: Size;
	isEditorSection: boolean;
	isFixedHeightSection: boolean;
	isPlaygroundsSection: boolean;
}): CSSProperties | undefined {
	if (!dockSize.height) {
		return undefined;
	}
	if (isMobile) {
		return {
			'--dock-height': `${dockSize.height}px`,
		} as CSSProperties;
	}

	const dockTop = viewportSize.height - dockSize.height;
	const center = getDockPaneCenter({
		dockCenter,
		viewportWidth: viewportSize.width,
		isEditorSection,
	});
	const availableHeight = Math.max(
		DOCK_PANE_MIN_HEIGHT,
		dockTop - DOCK_PANE_GAP - DOCK_DRAG_EDGE
	);
	const stableHeight = Math.min(LIST_PANE_HEIGHT, availableHeight);
	const maxHeight = isPlaygroundsSection ? stableHeight : availableHeight;

	return {
		left: `${center}px`,
		bottom: `${dockSize.height + DOCK_PANE_GAP}px`,
		top: 'auto',
		maxHeight: `${maxHeight}px`,
		...(isFixedHeightSection ? { height: `${stableHeight}px` } : {}),
	};
}

/** Keeps a global operation failure with the visible Dock surface. */
export function getDockOperationToastStyle({
	isMobile,
	dockSize,
	toolsHeight,
	isCollapsed,
	dockCenter,
	viewportSize,
	paneHeight,
	toastHeight,
	paneOpen,
	isEditorSection,
}: {
	isMobile: boolean;
	dockSize: Size;
	toolsHeight: number;
	isCollapsed: boolean;
	dockCenter: number | null;
	viewportSize: Size;
	paneHeight: number;
	toastHeight: number;
	paneOpen: boolean;
	isEditorSection: boolean;
}): CSSProperties | undefined {
	if (!dockSize.height) {
		return undefined;
	}

	// Mobile collapse removes the tools from layout, so dockSize is already the
	// visible height. Desktop collapse translates them out without reflowing.
	const visibleDockHeight =
		isCollapsed && !isMobile
			? Math.max(0, dockSize.height - toolsHeight)
			: dockSize.height;
	const desiredBottom =
		visibleDockHeight +
		DOCK_PANE_GAP +
		(!isMobile && paneOpen ? paneHeight + DOCK_PANE_GAP : 0);
	// Editor panes and mobile panes can consume all available space. Keep the
	// toast reachable at the viewport edge instead of placing it off-screen.
	const maxBottom = Math.max(
		DOCK_PANE_GAP,
		viewportSize.height - DOCK_PANE_GAP - toastHeight
	);
	const toastWidth = Math.min(
		OPERATION_TOAST_WIDTH,
		Math.max(0, viewportSize.width - 2 * DOCK_PANE_GAP)
	);
	const halfToastWidth = toastWidth / 2;
	const desiredCenter = isMobile
		? viewportSize.width / 2
		: getDockPaneCenter({
				dockCenter,
				viewportWidth: viewportSize.width,
				isEditorSection,
			});
	const minCenter = halfToastWidth + DOCK_PANE_GAP;
	const maxCenter = viewportSize.width - halfToastWidth - DOCK_PANE_GAP;
	const center =
		maxCenter < minCenter
			? viewportSize.width / 2
			: Math.min(Math.max(desiredCenter, minCenter), maxCenter);

	return {
		bottom: `${Math.min(desiredBottom, maxBottom)}px`,
		left: `${center}px`,
	};
}

/** Centers a pane over a moved Dock without letting it cross the viewport. */
export function getDockPaneCenter({
	dockCenter,
	viewportWidth,
	isEditorSection,
}: {
	dockCenter: number | null;
	viewportWidth: number;
	isEditorSection: boolean;
}) {
	const desiredCenter = dockCenter ?? viewportWidth / 2;
	const halfPaneWidth = Math.min(
		isEditorSection ? 560 : 300,
		(viewportWidth - 2 * DOCK_DRAG_EDGE) / 2
	);
	return Math.min(
		Math.max(desiredCenter, halfPaneWidth + DOCK_DRAG_EDGE),
		viewportWidth - halfPaneWidth - DOCK_DRAG_EDGE
	);
}
