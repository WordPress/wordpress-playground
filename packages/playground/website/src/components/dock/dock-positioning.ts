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
	toolsHeight,
	isCollapsed,
	dockCenter,
	viewportSize,
	isEditorSection,
	isWideSection,
	isFixedHeightSection,
	isPlaygroundsSection,
}: {
	isMobile: boolean;
	dockSize: Size;
	toolsHeight: number;
	isCollapsed: boolean;
	dockCenter: number | null;
	viewportSize: Size;
	isEditorSection: boolean;
	isWideSection: boolean;
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

	const visibleDockHeight = getVisibleDockHeight({
		isMobile,
		dockSize,
		toolsHeight,
		isCollapsed,
	});
	const dockTop = viewportSize.height - visibleDockHeight;
	const center = getDockPaneCenter({
		dockCenter,
		viewportWidth: viewportSize.width,
		isEditorSection,
		isWideSection,
	});
	const availableHeight = Math.max(
		DOCK_PANE_MIN_HEIGHT,
		dockTop - DOCK_PANE_GAP - DOCK_DRAG_EDGE
	);
	const stableHeight = Math.min(LIST_PANE_HEIGHT, availableHeight);
	const maxHeight = isPlaygroundsSection ? stableHeight : availableHeight;

	return {
		left: `${center}px`,
		bottom: `${visibleDockHeight + DOCK_PANE_GAP}px`,
		top: 'auto',
		maxHeight: `${maxHeight}px`,
		...(isFixedHeightSection ? { height: `${stableHeight}px` } : {}),
	};
}

/**
 * Places a global operation toast above an open pane when there's room above it
 * (desktop only). Otherwise — no pane, a full-height pane, or mobile — it sits
 * just above the Dock.
 */
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
	isWideSection,
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
	isWideSection: boolean;
}): CSSProperties | undefined {
	if (!dockSize.height) {
		return undefined;
	}

	const visibleDockHeight = getVisibleDockHeight({
		isMobile,
		dockSize,
		toolsHeight,
		isCollapsed,
	});
	const aboveDock = visibleDockHeight + DOCK_PANE_GAP;
	const roomAbovePane = !isMobile && paneOpen;
	const abovePane = roomAbovePane
		? aboveDock + paneHeight + DOCK_PANE_GAP
		: aboveDock;
	const fitsAbovePane =
		roomAbovePane &&
		abovePane + toastHeight + DOCK_PANE_GAP <= viewportSize.height;
	// Prefer sitting above the pane. When there's no room — a full-height
	// editor pane, or mobile — the toast overlays the pane's lower edge, so
	// lift it a gap off the pane's bottom edge instead of aligning with it.
	const desiredBottom = fitsAbovePane
		? abovePane
		: aboveDock + (paneOpen ? DOCK_PANE_GAP : 0);
	// Final guard so the toast never sits off-screen.
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
				isWideSection,
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
	isWideSection,
}: {
	dockCenter: number | null;
	viewportWidth: number;
	isEditorSection: boolean;
	isWideSection: boolean;
}) {
	const desiredCenter = dockCenter ?? viewportWidth / 2;
	// Half of the .pane / .pane-wide / .pane-editor widths in style.module.css.
	const halfPaneWidth = Math.min(
		isEditorSection ? 560 : isWideSection ? 430 : 300,
		(viewportWidth - 2 * DOCK_DRAG_EDGE) / 2
	);
	return Math.min(
		Math.max(desiredCenter, halfPaneWidth + DOCK_DRAG_EDGE),
		viewportWidth - halfPaneWidth - DOCK_DRAG_EDGE
	);
}

function getVisibleDockHeight({
	isMobile,
	dockSize,
	toolsHeight,
	isCollapsed,
}: {
	isMobile: boolean;
	dockSize: Size;
	toolsHeight: number;
	isCollapsed: boolean;
}): number {
	// Mobile collapse removes the tools from layout, so dockSize is already the
	// visible height. Desktop collapse translates them out without reflowing.
	return isCollapsed && !isMobile
		? Math.max(0, dockSize.height - toolsHeight)
		: dockSize.height;
}
