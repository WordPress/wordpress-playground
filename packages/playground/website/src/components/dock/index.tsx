import classNames from 'classnames';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CSSTransition } from 'react-transition-group';
import {
	Icon,
	chevronDown,
	close,
	grid,
	list,
	page,
	pencil,
	plus,
	share,
	wordpress,
} from '@wordpress/icons';
import type { SiteManagerSection } from '../../lib/state/redux/slice-ui';
import {
	setDockFullWidth,
	setShareExportOpen,
	setSiteManagerOpen,
	setSiteManagerSection,
} from '../../lib/state/redux/slice-ui';
import { writeDockFullWidth } from '../../lib/dock-full-width';
import {
	getActiveClientInfo,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { isSiteSavingDisabled } from '../../lib/state/url/router';
import { useInlineRename } from '../../lib/hooks/use-inline-rename';
import { SiteManager } from '../site-manager';
import AddressBar from '../address-bar';
import { SaveStatusIndicator } from '../browser-chrome/save-status-indicator';
import { AutosaveNudge } from './autosave-nudge';
import css from './style.module.css';

const isSavingDisabled = isSiteSavingDisabled();

type DockSection = Exclude<
	SiteManagerSection,
	'sidebar' | 'site-details' | 'blueprints'
>;

const DRAG_EDGE = 8;
// Pointer travel (px) before a press on the header band becomes a drag instead
// of a click — keeps a normal collapse tap from nudging the dock sideways.
const DRAG_THRESHOLD = 4;
const PANE_GAP = 12;
// Shared desktop height for the New and Your Playgrounds panes so they match;
// a touch taller than the list felt before. Both clamp to the available space.
const LIST_PANE_HEIGHT = 560;

/**
 * Cylinder mark for the Database tool. @wordpress/icons has no database glyph,
 * so we draw one here, matching the local-SVG pattern used elsewhere in the app.
 */
function DatabaseIcon() {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<ellipse
				cx="12"
				cy="6"
				rx="6.25"
				ry="2.75"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
			/>
			<path
				d="M5.75 6v12c0 1.52 2.8 2.75 6.25 2.75s6.25-1.23 6.25-2.75V6"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
			/>
			<path
				d="M5.75 12c0 1.52 2.8 2.75 6.25 2.75s6.25-1.23 6.25-2.75"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
			/>
		</svg>
	);
}

/**
 * Curly-braces mark for the Blueprint tool. Blueprints are JSON, so `{}` reads
 * truer than the angle-bracket `<>` glyph, which connotes HTML/markup.
 */
function BracesIcon() {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M10 4Q7 4 7 8Q7 11 5 12Q7 13 7 16Q7 20 10 20" />
			<path d="M14 4Q17 4 17 8Q17 11 19 12Q17 13 17 16Q17 20 14 20" />
		</svg>
	);
}

/**
 * Horizontal expand/contract arrows for the full-width toggle. Arrows point out
 * to the edges to offer "stretch the dock full width"; they point in toward the
 * centre to offer "shrink back to a floating bar".
 */
function DockWidthIcon({ full }: { full: boolean }) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{full ? (
				<>
					<path d="M3 12h7" />
					<path d="M7 8.5 10.5 12 7 15.5" />
					<path d="M21 12h-7" />
					<path d="M17 8.5 13.5 12 17 15.5" />
				</>
			) : (
				<>
					<path d="M10 12H3" />
					<path d="M6.5 8.5 3 12l3.5 3.5" />
					<path d="M14 12h7" />
					<path d="M17.5 8.5 21 12l-3.5 3.5" />
				</>
			)}
		</svg>
	);
}

type DockItem = {
	section: DockSection;
	label: string;
	ariaLabel: string;
	icon: JSX.Element;
	isPrimary?: boolean;
};

const DOCK_ITEMS: DockItem[] = [
	{
		section: 'new',
		label: 'New',
		ariaLabel: 'New Playground',
		icon: <Icon icon={plus} size={24} />,
		isPrimary: true,
	},
	{
		section: 'playgrounds',
		label: 'Playgrounds',
		ariaLabel: 'Your Playgrounds',
		icon: <Icon icon={grid} size={22} />,
	},
	{
		section: 'blueprint',
		label: 'Blueprint',
		ariaLabel: 'Current Blueprint',
		icon: <BracesIcon />,
	},
	{
		section: 'settings',
		label: 'Site details',
		ariaLabel: 'Site details',
		icon: <Icon icon={wordpress} size={24} />,
	},
	{
		section: 'database',
		label: 'Database',
		ariaLabel: 'Database',
		icon: <DatabaseIcon />,
	},
	{
		section: 'files',
		label: 'Files',
		ariaLabel: 'Files',
		icon: <Icon icon={page} size={24} />,
	},
	{
		section: 'logs',
		label: 'Logs',
		ariaLabel: 'Logs',
		icon: <Icon icon={list} size={24} />,
	},
	{
		section: 'share',
		label: 'Share',
		ariaLabel: 'Share and export',
		icon: <Icon icon={share} size={24} />,
	},
];

const PANE_COPY: Record<DockSection, { title: string; description: string }> = {
	new: {
		title: 'New Playground',
		description: 'Spin up a fresh Playground or start from a Blueprint.',
	},
	playgrounds: {
		title: 'Your Playgrounds',
		description: 'Switch between your recent and saved Playgrounds.',
	},
	blueprint: {
		title: 'Blueprint',
		description:
			'Review and edit the Blueprint that describes this Playground.',
	},
	settings: {
		title: 'Site details',
		description:
			'Change this Playground’s WordPress, PHP, language, and network settings.',
	},
	database: {
		title: 'Database',
		description:
			'Inspect and edit the SQLite database behind this Playground.',
	},
	files: {
		title: 'Files',
		description: 'Browse and edit the active Playground filesystem.',
	},
	logs: {
		title: 'Logs',
		description: 'PHP, WordPress, and Playground runtime messages.',
	},
	share: {
		title: 'Share and export',
		description: '',
	},
	save: {
		title: 'Store permanently',
		description: '',
	},
};

// At/below this width the dock becomes a full-width bottom bar with full-screen
// panels (the mobile-app pattern), and free-floating drag is turned off. Set to
// cover phones and portrait tablets, where a floating pane would crowd or
// overflow the viewport.
const MOBILE_QUERY = '(max-width: 1024px)';

function useIsMobile() {
	const [isMobile, setIsMobile] = useState(
		() =>
			typeof window !== 'undefined' &&
			window.matchMedia(MOBILE_QUERY).matches
	);
	useEffect(() => {
		const mediaQuery = window.matchMedia(MOBILE_QUERY);
		const update = () => setIsMobile(mediaQuery.matches);
		update();
		mediaQuery.addEventListener('change', update);
		return () => mediaQuery.removeEventListener('change', update);
	}, []);
	return isMobile;
}

export function Dock() {
	const dispatch = useAppDispatch();
	const siteManagerIsOpen = useAppSelector(
		(state) => state.ui.siteManagerIsOpen
	);
	const activeModal = useAppSelector((state) => state.ui.activeModal);
	const activeSection = useAppSelector(
		(state) => state.ui.siteManagerSection
	);
	const activeSite = useActiveSite();
	const clientInfo = useAppSelector(getActiveClientInfo);
	const shareExportOpen = useAppSelector((state) => state.ui.shareExportOpen);
	const autosaveNudge = useAppSelector((state) => state.ui.autosaveNudge);
	const autosaveNudgeMuted = useAppSelector(
		(state) => state.ui.autosaveNudgeMuted
	);
	const dockFullWidth = useAppSelector((state) => state.ui.dockFullWidth);
	// A restorable recent autosave surfaces as a dot on the Playgrounds tool and
	// (on first detection) a panel anchored to it. The dot persists until the
	// user restores or mutes; muting hides the proactive cues entirely.
	const showAutosaveCue = !!autosaveNudge && !autosaveNudgeMuted;
	// The Playgrounds tool element, captured so the autosave panel can anchor to
	// it (it's the home for recovery — opening it lists the autosaves).
	const [playgroundsToolEl, setPlaygroundsToolEl] =
		useState<HTMLButtonElement | null>(null);
	const paneRef = useRef<HTMLElement>(null);
	const dockRef = useRef<HTMLDivElement>(null);
	const dockBodyRef = useRef<HTMLDivElement>(null);
	// Remembers what was focused before a pane opened so focus can return there
	// when it closes (dialog focus management).
	const focusBeforePaneRef = useRef<HTMLElement | null>(null);
	// Tracks whether a pane has ever been open, so the close-branch focus restore
	// only runs on a genuine open->close transition — never on the initial mount.
	const hasBeenOpenRef = useRef(false);
	// The dock's header chevron — always visible (even when collapsed), so it's a
	// reliable focus fallback when the triggering tool isn't focusable on close.
	const collapseToggleRef = useRef<HTMLButtonElement>(null);
	// Bottom-edge drag: the header band doubles as a drag handle. dragRef holds
	// the live gesture's start state (pointer x, the dock's center x, and half the
	// visible width for clamping); draggedRef flips true once the pointer passes
	// the threshold, so the trailing click collapses only on a real tap.
	const dragRef = useRef<{
		startX: number;
		startCenter: number;
		halfWidth: number;
	} | null>(null);
	const draggedRef = useRef(false);
	// Timer that re-enables transitions just after a sharp full-width toggle.
	const modeSwitchTimer = useRef<number | null>(null);
	const inlineRename = useInlineRename();
	const isMobile = useIsMobile();
	const normalizedSection = normalizeSection(activeSection);
	const paneCopy = PANE_COPY[normalizedSection];
	const isEditorSection =
		normalizedSection === 'blueprint' || normalizedSection === 'files';
	// The New pane is tabbed; a fixed height keeps the tab strip from moving as
	// the active tab's content (gallery vs. a short form) changes height.
	const isFixedHeightSection = normalizedSection === 'new';
	const canManageActiveSite = activeSite?.metadata.storage !== 'none';
	// The dock is the only chrome now, so it also carries the active
	// Playground's identity (the old top bar that showed this is gone).
	const playgroundTitle =
		activeSite?.metadata.storage === 'none'
			? 'Unsaved Playground'
			: activeSite?.metadata.name;
	const showPlaygroundShortcuts =
		!!activeSite && normalizedSection === 'settings';
	const showDescription = !isEditorSection && !!paneCopy.description;

	const [dockSize, setDockSize] = useState({ width: 0, height: 0 });
	// The dock body's height (everything below the header band). Collapsing slides
	// the dock down by exactly this, leaving only the header band on the edge.
	const [dockBodyHeight, setDockBodyHeight] = useState(0);
	// Collapsed dock slides down to tuck the tools row off the bottom edge,
	// leaving the drag grip + address row resting on it.
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [viewportHeight, setViewportHeight] = useState(() =>
		typeof window !== 'undefined' ? window.innerHeight : 0
	);
	const [viewportWidth, setViewportWidth] = useState(() =>
		typeof window !== 'undefined' ? window.innerWidth : 0
	);
	// Floating-dock horizontal CENTER (px). null = centered on the viewport (the
	// default); set once the user drags the dock along the bottom edge. Tracking
	// the center (not the left edge) keeps the dock — and the pane that anchors
	// above it — clamped on-screen and landing on the same point.
	const [dockCenter, setDockCenter] = useState<number | null>(null);
	// Drives the grabbing cursor while a drag is in flight.
	const [isDragging, setIsDragging] = useState(false);
	// True briefly while toggling full-width <-> floating, so the dock eases its
	// width and position for the switch. The width transition is off otherwise so
	// it never lags a window resize.
	const [isModeSwitching, setIsModeSwitching] = useState(false);

	// Track the dock + body sizes: dockSize anchors the pane above the dock, and
	// dockBodyHeight is the exact distance the dock slides to collapse.
	useEffect(() => {
		if (typeof ResizeObserver === 'undefined') {
			return;
		}
		const observer = new ResizeObserver(() => {
			// Border-box size (offset*) — contentRect omits padding, which would
			// leave the pane short and overlapping the dock.
			const el = dockRef.current;
			if (el) {
				setDockSize({
					width: el.offsetWidth,
					height: el.offsetHeight,
				});
			}
			const tools = dockBodyRef.current;
			if (el && tools) {
				// Distance from the top of the tools row down to the dock's
				// bottom edge — how far the dock tucks down to hide the tools
				// (and the padding beneath them) on collapse, leaving the grip
				// + address row resting on the edge.
				setDockBodyHeight(el.offsetHeight - tools.offsetTop);
			}
		});
		if (dockRef.current) {
			observer.observe(dockRef.current);
		}
		if (dockBodyRef.current) {
			observer.observe(dockBodyRef.current);
		}
		return () => observer.disconnect();
	}, []);

	// Re-pin the default dock to the bottom edge when the viewport height changes;
	// the width feeds the drag clamp so a dragged dock can't end up off-screen.
	useEffect(() => {
		const onResize = () => {
			setViewportHeight(window.innerHeight);
			setViewportWidth(window.innerWidth);
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	// Keep the dragged dock on-screen when the viewport narrows or the dock's width
	// changes (e.g. a longer Playground name widens the address row). Clamping by
	// the full width keeps the centered notch within the expanded bar's fit area.
	useEffect(() => {
		if (dockCenter === null || !dockSize.width) {
			return;
		}
		const halfWidth = dockSize.width / 2;
		const min = halfWidth + DRAG_EDGE;
		const max = Math.max(min, viewportWidth - halfWidth - DRAG_EDGE);
		const clamped = Math.min(Math.max(dockCenter, min), max);
		if (clamped !== dockCenter) {
			setDockCenter(clamped);
		}
	}, [viewportWidth, dockSize.width, dockCenter]);

	// Publish the dock's visible-from-bottom height so the layout can shrink the
	// WordPress preview to end exactly at the dock's top edge in full-width mode.
	// When collapsed only the header band shows, so the preview reclaims the body.
	useEffect(() => {
		const headerHeight = Math.max(0, dockSize.height - dockBodyHeight);
		const visible = isCollapsed ? headerHeight : dockSize.height;
		const root = document.documentElement;
		if (visible > 0) {
			root.style.setProperty('--dock-docked-height', `${visible}px`);
		}
		return () => {
			root.style.removeProperty('--dock-docked-height');
		};
	}, [dockSize.height, dockBodyHeight, isCollapsed]);

	// Animate the Share pane's height when it swaps between its list and the
	// inline "Export to GitHub" sub-view — a content-driven auto-height change
	// CSS can't transition on its own. FLIP: measure the new height, jump back
	// to the old one, then transition to the new with an ease-out. While it
	// resizes, the content is pinned to the pane's anchored edge (the bottom,
	// when the pane opens above the dock) so it sits in its final spot and the
	// pane's far edge does the moving — the content never slides.
	const shareHeightRef = useRef<number | null>(null);
	useLayoutEffect(() => {
		const el = paneRef.current;
		// The FLIP height animation only applies to the desktop pane that sizes to
		// its content. The mobile pane is a full-screen flex column pinned top:0 /
		// bottom:dock-height; forcing a pixel height there over-constrains it and
		// collapses it to content height, so skip the animation on mobile.
		if (isMobile || normalizedSection !== 'share' || !el) {
			shareHeightRef.current = null;
			return;
		}
		el.style.transition = 'none';
		el.style.height = '';
		const newHeight = el.offsetHeight;
		const oldHeight = shareHeightRef.current;
		shareHeightRef.current = newHeight;
		if (oldHeight === null || oldHeight === newHeight) {
			el.style.transition = '';
			return;
		}
		// When the pane opens above the dock it's bottom-anchored (top: auto);
		// pin the content to the bottom so it doesn't ride the moving top edge.
		const bottomAnchored = el.style.top === 'auto';
		if (bottomAnchored) {
			el.style.display = 'flex';
			el.style.flexDirection = 'column';
			el.style.justifyContent = 'flex-end';
		}
		el.style.height = `${oldHeight}px`;
		void el.offsetHeight; // commit the old height before transitioning
		el.style.transition = 'height 320ms cubic-bezier(0.33, 1, 0.68, 1)';
		el.style.height = `${newHeight}px`;
		let finished = false;
		const finish = () => {
			if (finished) {
				return;
			}
			finished = true;
			el.style.height = '';
			el.style.transition = '';
			el.style.display = '';
			el.style.flexDirection = '';
			el.style.justifyContent = '';
			el.removeEventListener('transitionend', finish);
		};
		el.addEventListener('transitionend', finish);
		const timer = window.setTimeout(finish, 420);
		return () => {
			window.clearTimeout(timer);
			finish();
		};
	}, [shareExportOpen, normalizedSection, isMobile]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || activeModal || !siteManagerIsOpen) {
				return;
			}
			// This listener is capture-phase, so it would beat the inline-rename
			// field's own bubble-phase handler. Let an in-progress rename cancel
			// itself first instead of closing the whole pane.
			const target = event.target as HTMLElement | null;
			if (target?.closest('input[aria-label="Rename Playground"]')) {
				return;
			}
			// Let an open popover (the row actions menu, the address
			// quick-nav) or modal (the Blueprint editor's multiline string
			// editor) take the first Escape; only a second press closes the
			// dock pane itself.
			if (
				document.querySelector(
					'.components-popover:not(.components-tooltip), .components-modal__screen-overlay'
				)
			) {
				return;
			}
			// The inline "Export to GitHub" sub-view has its own back affordance;
			// the first Escape returns to the Share list rather than closing the
			// whole dock.
			if (normalizedSection === 'share' && shareExportOpen) {
				dispatch(setShareExportOpen(false));
				return;
			}
			dispatch(setSiteManagerOpen(false));
		};
		document.addEventListener('keydown', handleKeyDown, true);
		return () => {
			document.removeEventListener('keydown', handleKeyDown, true);
		};
	}, [
		activeModal,
		dispatch,
		siteManagerIsOpen,
		normalizedSection,
		shareExportOpen,
	]);

	// Dialog focus management: when a pane opens, remember the trigger and move
	// focus into the pane (unless an editor pane already grabbed it); when it
	// closes, return focus to the control that opened it.
	useEffect(() => {
		if (siteManagerIsOpen) {
			hasBeenOpenRef.current = true;
			focusBeforePaneRef.current =
				document.activeElement as HTMLElement | null;
			const timer = window.setTimeout(() => {
				const pane = paneRef.current;
				if (pane && !pane.contains(document.activeElement)) {
					pane.focus();
				}
			}, 120);
			return () => window.clearTimeout(timer);
		}
		// Only restore focus on a real open->close transition. On the initial
		// mount the pane was never open, so skip — otherwise the body-fallback
		// below would steal focus to the collapse toggle on every page load.
		if (!hasBeenOpenRef.current) {
			return;
		}
		const previouslyFocused = focusBeforePaneRef.current;
		focusBeforePaneRef.current = null;
		if (previouslyFocused && document.contains(previouslyFocused)) {
			previouslyFocused.focus();
		}
		// If the trigger couldn't take focus (e.g. its tools row was collapsed
		// to visibility:hidden while the pane was open), focus didn't land — fall
		// back to the always-visible collapse toggle so it never drops to <body>.
		if (
			document.activeElement === document.body ||
			document.activeElement === null
		) {
			collapseToggleRef.current?.focus();
		}
	}, [siteManagerIsOpen]);

	const openSection = (section: DockSection) => {
		if (siteManagerIsOpen && normalizedSection === section) {
			dispatch(setSiteManagerOpen(false));
			return;
		}
		// Switching sections while the pane is already open doesn't re-run the
		// open effect (siteManagerIsOpen stays true), so update the restore target
		// to the tool the user just activated — otherwise closing returns focus to
		// the first-opened tool, not the last one.
		if (siteManagerIsOpen) {
			focusBeforePaneRef.current =
				document.activeElement as HTMLElement | null;
		}
		// A pane anchors above the expanded dock, so make sure it isn't collapsed.
		setIsCollapsed(false);
		dispatch(setSiteManagerSection(section));
		dispatch(setSiteManagerOpen(true));
	};

	// The dock can be dragged horizontally only while it floats: in full-width
	// mode it already spans the edge, and on mobile it's a fixed bottom bar.
	const canDrag = !isMobile && !dockFullWidth;

	// The header band doubles as the drag handle. A press that travels past the
	// threshold drags the dock along the bottom edge; a press that doesn't is a
	// plain tap and falls through to the click handler (collapse/expand).
	const handleHeaderPointerDown = (event: React.PointerEvent) => {
		if (!canDrag || event.button !== 0) {
			return;
		}
		const dock = dockRef.current;
		if (!dock) {
			return;
		}
		const rect = dock.getBoundingClientRect();
		dragRef.current = {
			startX: event.clientX,
			startCenter: rect.left + rect.width / 2,
			// The dock keeps its full width even when collapsed (only the clip
			// hides part of it), so clamp by the full width — the centered notch
			// then stays within the area where the expanded bar also fits.
			halfWidth: dock.offsetWidth / 2,
		};
		draggedRef.current = false;
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const handleHeaderPointerMove = (event: React.PointerEvent) => {
		const drag = dragRef.current;
		if (!drag) {
			return;
		}
		const dx = event.clientX - drag.startX;
		if (!draggedRef.current && Math.abs(dx) < DRAG_THRESHOLD) {
			return;
		}
		draggedRef.current = true;
		setIsDragging(true);
		const min = drag.halfWidth + DRAG_EDGE;
		const max = Math.max(
			min,
			window.innerWidth - drag.halfWidth - DRAG_EDGE
		);
		setDockCenter(Math.min(Math.max(drag.startCenter + dx, min), max));
	};

	const handleHeaderPointerUp = (event: React.PointerEvent) => {
		if (!dragRef.current) {
			return;
		}
		try {
			event.currentTarget.releasePointerCapture(event.pointerId);
		} catch {
			// The pointer may already be released; ignore.
		}
		dragRef.current = null;
		setIsDragging(false);
	};

	const toggleFullWidth = () => {
		const next = !dockFullWidth;
		// Suppress dock transitions for the moment of the switch so it snaps
		// (sharp) instead of easing, then re-enable them right after — keeping the
		// collapse-notch animation intact for later.
		setIsModeSwitching(true);
		if (modeSwitchTimer.current !== null) {
			window.clearTimeout(modeSwitchTimer.current);
		}
		modeSwitchTimer.current = window.setTimeout(() => {
			setIsModeSwitching(false);
			modeSwitchTimer.current = null;
		}, 60);
		dispatch(setDockFullWidth(next));
		writeDockFullWidth(next);
	};

	useEffect(
		() => () => {
			if (modeSwitchTimer.current !== null) {
				window.clearTimeout(modeSwitchTimer.current);
			}
		},
		[]
	);

	// The dock is welded to the bottom edge by CSS; JS feeds it the body height
	// (the collapse slide distance) and, when dragged, the chosen center offset.
	const dockStyle = {
		...(dockBodyHeight ? { '--dock-body-h': `${dockBodyHeight}px` } : {}),
		...(dockCenter !== null ? { '--dock-center': `${dockCenter}px` } : {}),
	} as React.CSSProperties;

	// Anchor the pane centered above the flush dock, clamped to the viewport.
	// (A pane only opens while the dock is expanded, so dockSize.height is the
	// full two-row height the pane needs to clear.)
	let paneStyle: React.CSSProperties | undefined;
	if (isMobile) {
		// Full-screen panel above the bottom bar: CSS handles the inset; it just
		// needs to know how tall the dock currently is.
		paneStyle = {
			'--dock-height': `${dockSize.height}px`,
		} as React.CSSProperties;
	} else if (dockSize.height) {
		const dockTop = viewportHeight - dockSize.height;
		// Follow the dock's center so a dragged dock keeps its pane overhead,
		// instead of the pane always snapping to the middle of the screen.
		const centerX = dockCenter ?? window.innerWidth / 2;
		const halfWidth = Math.min(
			isEditorSection ? 560 : 300,
			(window.innerWidth - 2 * DRAG_EDGE) / 2
		);
		const clampedCenter = Math.min(
			Math.max(centerX, halfWidth + DRAG_EDGE),
			window.innerWidth - halfWidth - DRAG_EDGE
		);
		const available = Math.max(160, dockTop - PANE_GAP - DRAG_EDGE);
		// Fixed-height panes get a stable height (capped) so they don't resize
		// between tabs; everything else stays content-sized via max-height.
		const fixedHeight = isFixedHeightSection
			? Math.min(LIST_PANE_HEIGHT, available)
			: undefined;
		// Your Playgrounds matches the New pane's height so the two read alike.
		const maxHeight =
			normalizedSection === 'playgrounds'
				? Math.min(LIST_PANE_HEIGHT, available)
				: available;
		paneStyle = {
			left: `${clampedCenter}px`,
			maxHeight: `${maxHeight}px`,
			...(fixedHeight ? { height: `${fixedHeight}px` } : {}),
			bottom: `${dockSize.height + PANE_GAP}px`,
			top: 'auto',
		};
	}

	return (
		<>
			<CSSTransition
				nodeRef={paneRef}
				in={siteManagerIsOpen}
				timeout={240}
				classNames={{
					enter: css.paneEnter,
					enterActive: css.paneEnterActive,
					exit: css.paneExit,
					exitActive: css.paneExitActive,
				}}
				unmountOnExit
			>
				<section
					ref={paneRef}
					className={classNames(css.pane, css.overlayCompat, {
						[css.paneEditor]: isEditorSection,
						[css.paneFixedHeight]: isFixedHeightSection,
						[css.paneCompact]:
							normalizedSection === 'save' ||
							normalizedSection === 'settings' ||
							normalizedSection === 'share',
					})}
					style={paneStyle}
					role="dialog"
					// Not aria-modal: even on mobile the dock bar (tool buttons,
					// address bar) stays interactive beside/below the pane, so we
					// can't honestly trap focus to the pane alone. The obscured
					// WordPress preview is removed from the a11y tree via `inert`
					// (see layout). Focus is moved into the pane on open and
					// restored to the triggering control on close (effect below).
					tabIndex={-1}
					aria-label={`${paneCopy.title} pane`}
				>
					{/* On mobile the pane is full-screen, so the tap-outside scrim
					    is covered — every panel needs a visible way back to the
					    preview. This X is shown only on mobile (CSS). */}
					<button
						type="button"
						className={css.paneClose}
						aria-label="Close"
						title="Close"
						onClick={() => dispatch(setSiteManagerOpen(false))}
					>
						<Icon icon={close} size={24} />
					</button>
					{!isEditorSection &&
						!(normalizedSection === 'share' && shareExportOpen) && (
							<div className={css.paneHeader}>
								<div className={css.paneHeaderMain}>
									<h2>{paneCopy.title}</h2>
									{showPlaygroundShortcuts ? (
										<div className={css.settingsIdentity}>
											{activeSite &&
											inlineRename.isEditing(
												activeSite.slug
											) ? (
												<input
													className={
														css.settingsNameInput
													}
													{...inlineRename.getInputProps(
														activeSite
													)}
												/>
											) : (
												<>
													<span
														className={
															css.settingsName
														}
													>
														{playgroundTitle}
													</span>
													{canManageActiveSite &&
														activeSite && (
															<button
																type="button"
																className={
																	css.settingsRename
																}
																aria-label="Rename Playground"
																title="Rename"
																onClick={() =>
																	inlineRename.start(
																		activeSite
																	)
																}
															>
																<Icon
																	icon={
																		pencil
																	}
																	size={16}
																/>
															</button>
														)}
												</>
											)}
										</div>
									) : (
										showDescription && (
											<p className={css.paneDescription}>
												{paneCopy.description}
											</p>
										)
									)}
								</div>
								{normalizedSection === 'playgrounds' && (
									<button
										type="button"
										className={css.paneHeaderAction}
										onClick={() =>
											dispatch(
												setSiteManagerSection('new')
											)
										}
									>
										<Icon icon={plus} size={20} />
										New Playground
									</button>
								)}
							</div>
						)}
					<div className={css.paneBody}>
						<SiteManager />
					</div>
				</section>
			</CSSTransition>
			<nav
				ref={dockRef}
				className={classNames(css.dock, {
					[css.dockCollapsed]: isCollapsed,
					[css.dockFull]: !isMobile && dockFullWidth,
					[css.dockSwitching]: isModeSwitching,
					[css.dockDragged]:
						!isMobile && !dockFullWidth && dockCenter !== null,
				})}
				style={dockStyle}
				aria-label="Playground tools"
			>
				{/* A quiet drag grip for nudging the floating dock along the bottom
				    edge. Slim on purpose so it doesn't imply the dock moves anywhere
				    — collapsing now lives on a button in the row below. */}
				<div
					className={classNames(css.dockGrip, {
						[css.dockGripDraggable]: canDrag,
						[css.dockGripDragging]: isDragging,
					})}
					onPointerDown={handleHeaderPointerDown}
					onPointerMove={handleHeaderPointerMove}
					onPointerUp={handleHeaderPointerUp}
					aria-hidden="true"
				>
					<span className={css.dockGripBar} />
				</div>
				<div className={css.dockBody}>
					<div className={css.dockTopRow}>
						<div className={css.dockAddress}>
							<AddressBar
								url={clientInfo?.url}
								onUpdate={
									clientInfo
										? (newUrl) =>
												clientInfo.client.goTo(newUrl)
										: undefined
								}
								disabled={!clientInfo}
							/>
						</div>
						<div className={css.dockStatus}>
							{playgroundTitle && (
								<span
									className={css.dockSiteName}
									aria-label="Playground title"
									title={playgroundTitle}
								>
									{playgroundTitle}
								</span>
							)}
							{!isSavingDisabled && <SaveStatusIndicator />}
						</div>
						{/* Toggle between the floating dock and a full-width docked
						    bar that the preview ends above. Desktop-only (CSS hides
						    it on the mobile bottom bar). */}
						<button
							type="button"
							className={css.dockWidthToggle}
							aria-label={
								dockFullWidth
									? 'Float the dock'
									: 'Dock to full width'
							}
							aria-pressed={dockFullWidth}
							title={
								dockFullWidth
									? 'Float the dock'
									: 'Dock to full width'
							}
							onClick={toggleFullWidth}
						>
							<DockWidthIcon full={dockFullWidth} />
						</button>
						{/* Collapse just the tools row, leaving the address bar
						    reachable. The chevron flips to point up when collapsed. */}
						<button
							type="button"
							ref={collapseToggleRef}
							className={css.dockCollapseToggle}
							aria-label={
								isCollapsed ? 'Expand dock' : 'Collapse dock'
							}
							aria-expanded={!isCollapsed}
							title={isCollapsed ? 'Show tools' : 'Hide tools'}
							onClick={() =>
								setIsCollapsed((collapsed) => !collapsed)
							}
						>
							<Icon icon={chevronDown} size={20} />
						</button>
					</div>
					<div className={css.dockTools} ref={dockBodyRef}>
						{DOCK_ITEMS.map((item, index) => {
							const isActive =
								siteManagerIsOpen &&
								normalizedSection === item.section;
							const isPlaygrounds =
								item.section === 'playgrounds';
							const showDot = isPlaygrounds && showAutosaveCue;
							const ariaLabel = showDot
								? `${item.ariaLabel} — recent autosave available`
								: getDockItemAriaLabel(item);
							return (
								<span
									key={item.section}
									className={classNames({
										[css.withSeparator]: index === 2,
									})}
								>
									<button
										type="button"
										ref={
											isPlaygrounds
												? setPlaygroundsToolEl
												: undefined
										}
										className={classNames(css.dockItem, {
											[css.dockItemPrimary]:
												item.isPrimary,
											[css.dockItemActive]: isActive,
										})}
										aria-label={ariaLabel}
										aria-pressed={isActive}
										onClick={() =>
											openSection(item.section)
										}
										data-cy={
											item.section === 'share'
												? 'dropdown-menu'
												: undefined
										}
									>
										<span
											className={css.dockIcon}
											aria-hidden="true"
										>
											{item.icon}
										</span>
										<span className={css.dockLabel}>
											{item.label}
										</span>
										{showDot && (
											<span
												className={css.dockItemDot}
												aria-hidden="true"
											/>
										)}
									</button>
								</span>
							);
						})}
					</div>
				</div>
			</nav>
			<AutosaveNudge anchor={playgroundsToolEl} />
		</>
	);
}

function normalizeSection(section: SiteManagerSection): DockSection {
	if (section === 'site-details' || section === 'sidebar') {
		return 'settings';
	}
	if (section === 'blueprints') {
		return 'new';
	}
	return section;
}

function getDockItemAriaLabel(item: DockItem) {
	// Open/closed state is conveyed by aria-pressed on every tool; encoding it
	// again in a toggled verb label (as the settings tool used to) double-speaks
	// the state to screen readers, so keep a stable name for all tools.
	return item.ariaLabel;
}
