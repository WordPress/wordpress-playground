import {
	DOCK_PANE_GAP,
	DOCK_PANE_MIN_HEIGHT,
	getDockOperationToastStyle,
	getDockPaneCenter,
	getDockPaneStyle,
} from './dock-positioning';

describe('Dock positioning', () => {
	it('waits for the Dock height before positioning a pane or toast', () => {
		expect(
			getDockPaneStyle({
				isMobile: false,
				dockSize: { width: 800, height: 0 },
				dockCenter: null,
				viewportSize: { width: 1200, height: 800 },
				isEditorSection: false,
				isFixedHeightSection: false,
				isPlaygroundsSection: false,
			})
		).toBeUndefined();
		expect(
			getDockOperationToastStyle({
				isMobile: false,
				dockSize: { width: 800, height: 0 },
				toolsHeight: 60,
				isCollapsed: false,
				dockCenter: null,
				viewportSize: { width: 1200, height: 800 },
				paneHeight: 400,
				toastHeight: 62,
				paneOpen: false,
				isEditorSection: false,
			})
		).toBeUndefined();
	});

	it('uses the minimum desktop pane height when the viewport is too short', () => {
		expect(
			getDockPaneStyle({
				isMobile: false,
				dockSize: { width: 800, height: 80 },
				dockCenter: null,
				viewportSize: { width: 1200, height: 100 },
				isEditorSection: false,
				isFixedHeightSection: false,
				isPlaygroundsSection: false,
			})
		).toMatchObject({ maxHeight: `${DOCK_PANE_MIN_HEIGHT}px` });
	});

	it('passes the measured Dock height to the mobile pane', () => {
		expect(
			getDockPaneStyle({
				isMobile: true,
				dockSize: { width: 390, height: 72 },
				dockCenter: null,
				viewportSize: { width: 390, height: 844 },
				isEditorSection: false,
				isFixedHeightSection: false,
				isPlaygroundsSection: false,
			})
		).toEqual({ '--dock-height': '72px' });
	});

	it('keeps desktop panes above the Dock and inside the viewport', () => {
		expect(
			getDockPaneStyle({
				isMobile: false,
				dockSize: { width: 800, height: 80 },
				dockCenter: 100,
				viewportSize: { width: 1200, height: 800 },
				isEditorSection: false,
				isFixedHeightSection: true,
				isPlaygroundsSection: true,
			})
		).toEqual({
			left: '308px',
			bottom: `${80 + DOCK_PANE_GAP}px`,
			top: 'auto',
			maxHeight: '560px',
			height: '560px',
		});
	});

	it('keeps operation notices visible above an open pane', () => {
		expect(
			getDockOperationToastStyle({
				isMobile: false,
				dockSize: { width: 800, height: 80 },
				toolsHeight: 60,
				isCollapsed: false,
				dockCenter: 100,
				viewportSize: { width: 1200, height: 800 },
				paneHeight: 400,
				toastHeight: 62,
				paneOpen: true,
				isEditorSection: false,
			})
		).toEqual({ bottom: '504px', left: '308px' });
	});

	it('centers operation notices when the viewport is narrower than its gaps', () => {
		expect(
			getDockOperationToastStyle({
				isMobile: false,
				dockSize: { width: 10, height: 80 },
				toolsHeight: 60,
				isCollapsed: false,
				dockCenter: 0,
				viewportSize: { width: 10, height: 800 },
				paneHeight: 0,
				toastHeight: 62,
				paneOpen: false,
				isEditorSection: false,
			})
		).toEqual({ bottom: '92px', left: '5px' });
	});

	it('clamps pane centers at both viewport edges', () => {
		expect(
			getDockPaneCenter({
				dockCenter: 0,
				viewportWidth: 1200,
				isEditorSection: false,
			})
		).toBe(308);
		expect(
			getDockPaneCenter({
				dockCenter: 1200,
				viewportWidth: 1200,
				isEditorSection: false,
			})
		).toBe(892);
	});
});
