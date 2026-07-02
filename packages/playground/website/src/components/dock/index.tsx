import classNames from 'classnames';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CSSTransition } from 'react-transition-group';
import {
	Icon,
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
	dismissAutosaveNudge,
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
import playgroundLogoSvg from '../../playground-logo.svg?raw';
import css from './style.module.css';

const isSavingDisabled = isSiteSavingDisabled();

type DockSection = Exclude<
	SiteManagerSection,
	'sidebar' | 'site-details' | 'blueprints'
>;

const DRAG_EDGE = 8;
// Pointer travel (px) before a press on the bare chrome becomes a drag instead
// of a tap — keeps a small jitter from nudging the dock sideways.
const DRAG_THRESHOLD = 4;
// Presses on buttons arm the same drag (aiming for the thin bare chrome is
// fiddly), but need a touch more travel so a sloppy click on a tool stays a
// click.
const BUTTON_DRAG_THRESHOLD = 6;
// How far past the on-screen clamp the user has to keep pushing the dock toward
// a side edge before releasing tucks it into a corner button there.
const CORNER_OVERDRAG = 36;
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
 * truer than the angle-bracket `<>` glyph, which connotes HTML/markup. The arms
 * curve continuously into the tongue (no straight vertical segments) so it reads
 * as calligraphic braces, not two gray stripes; thin stroke to sit light.
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
			{/* fill="none" per-path so the dock's `.dock-icon svg { fill: currentColor }`
			    rule can't fill these open paths into solid crescents (the gray stripes). */}
			<path
				fill="none"
				d="M9 4C7 4 7 6 6.8 8.5C6.65 10.4 6 11.4 4.5 12C6 12.6 6.65 13.6 6.8 15.5C7 18 7 20 9 20"
			/>
			<path
				fill="none"
				d="M15 4C17 4 17 6 17.2 8.5C17.35 10.4 18 11.4 19.5 12C18 12.6 17.35 13.6 17.2 15.5C17 18 17 20 15 20"
			/>
		</svg>
	);
}

/**
 * Chevron for the toggle pill's left half. It collapses/expands the tools row
 * and flips to point up (via CSS) when the tools are hidden.
 */
function DockCollapseChevron() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M6 9l6 6 6-6" />
		</svg>
	);
}

/**
 * Screen mark for the toggle pill's right half while the dock floats — the
 * "go full width" action: a monitor whose content fills it edge to edge.
 * The glyph itself carries the toggle's state (it swaps with the floating
 * mark below), so the button needs no pressed styling.
 */
function DockFullWidthIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<rect
				x="3"
				y="6"
				width="18"
				height="12"
				rx="2.5"
				stroke="currentColor"
				strokeWidth="1.7"
			/>
			<rect
				x="5.4"
				y="8.4"
				width="13.2"
				height="7.2"
				rx="1.3"
				fill="currentColor"
			/>
		</svg>
	);
}

/**
 * The same screen while the dock is full width — the "back to floating"
 * action: a small window floating inside the monitor.
 */
function DockFloatingIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<rect
				x="3"
				y="6"
				width="18"
				height="12"
				rx="2.5"
				stroke="currentColor"
				strokeWidth="1.7"
			/>
			<rect
				x="7"
				y="9.5"
				width="10"
				height="5"
				rx="1.3"
				fill="currentColor"
			/>
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

function prefersReducedMotion() {
	return (
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
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
	// user restores, opens Your Playgrounds (seeing the list acknowledges it),
	// or mutes; muting hides the proactive cues entirely.
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
	// Whole-surface drag (the hr-11 model, buttons included): any press on the
	// dock — bare chrome or a tool — arms a drag, and it becomes one only past
	// a small travel threshold, so a still press on a button is still a click.
	// The gesture runs on window listeners created at pointerdown (a fast
	// pointer can outrun the dock's own box), so what the release handler needs
	// is mirrored into refs: draggedRef flips true past the threshold (the
	// pressed control's trailing click is then swallowed), dragArmedRef tells
	// the hover-sheen handler to stand down, and dragSideRef mirrors dragSide
	// (the window handler would otherwise read a stale render's state).
	const dragArmedRef = useRef(false);
	const draggedRef = useRef(false);
	const dragSideRef = useRef<'left' | 'right' | null>(null);
	// Dragging the corner launcher back out maximizes the dock — the mirror of
	// dragging the bar into a corner. cornerDragRef holds the gesture's start x;
	// cornerDraggedRef flips true past the threshold so a plain tap still just
	// restores; lastDockWidthRef keeps the bar's last real width for clamping
	// while it's tucked away (its measured width is 0 while display:none).
	const cornerDragRef = useRef<{ startX: number } | null>(null);
	const cornerDraggedRef = useRef(false);
	const lastDockWidthRef = useRef(0);
	// The corner launcher's box at the moment it was clicked — the unfold
	// animation grows the dock out of exactly this spot.
	const cornerRectRef = useRef<DOMRect | null>(null);
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
	// Which side the dock has been pushed to: while a drag is live this previews
	// the corner button; once the drag ends it commits, replacing the bar with a
	// small launcher in that bottom corner.
	const [dragSide, setDragSide] = useState<'left' | 'right' | null>(null);
	// True briefly while toggling full-width <-> floating, so the dock eases its
	// width and position for the switch. The width transition is off otherwise so
	// it never lags a window resize.
	const [isModeSwitching, setIsModeSwitching] = useState(false);
	// Animated fold-into-corner: `isFolding` keeps the bar mounted while it plays
	// its shrink-toward-the-corner animation before committing to the corner
	// launcher; `isUnfolding` pops the restored bar back in when the launcher is
	// clicked. Both clear on the animation's end.
	const [isFolding, setIsFolding] = useState(false);
	const [isUnfolding, setIsUnfolding] = useState(false);
	// While the launcher is being dragged back out, the bar follows the pointer
	// (like a grip drag) and the launcher stays mounted but hidden so it keeps
	// pointer capture through the gesture.
	const [isMaximizing, setIsMaximizing] = useState(false);

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
				// Keep the last non-zero width so a maximize-drag can clamp even
				// though the bar measures 0 while tucked into the corner.
				if (el.offsetWidth > 0) {
					lastDockWidthRef.current = el.offsetWidth;
				}
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
		// Visiting Your Playgrounds acknowledges the autosave cue: the dot is a
		// pointer to the recovery home, not an unread badge, so seeing the list
		// clears it. Autosaves remain restorable from that list regardless.
		if (section === 'playgrounds' && autosaveNudge) {
			dispatch(dismissAutosaveNudge());
		}
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

	// The chrome-anywhere drag must leave real controls alone — presses on the
	// tools, the address bar, or the pill click and type as normal; only the
	// bare dark surface is a grab.
	const isInteractiveTarget = (target: EventTarget | null) =>
		target instanceof Element &&
		!!target.closest(
			'button, a, input, textarea, select, [role="menu"], [role="menuitem"]'
		);

	// The grab affordance: warm light pools along the dock's top edge under the
	// pointer (the hr-11 "sheen"). Written straight to CSS custom properties so
	// tracking the pointer never re-renders the component.
	const setSheen = (opacity: number, clientX?: number) => {
		const dock = dockRef.current;
		if (!dock) {
			return;
		}
		dock.style.setProperty('--sheen-o', String(opacity));
		if (clientX !== undefined) {
			const rect = dock.getBoundingClientRect();
			const x = Math.min(
				Math.max(clientX - rect.left, 12),
				Math.max(rect.width - 12, 12)
			);
			dock.style.setProperty('--sheen-x', `${x}px`);
		}
	};

	// If the dock stops being draggable while lit (full width toggled, viewport
	// crossed the mobile breakpoint), the affordance must not linger.
	useEffect(() => {
		if (!canDrag) {
			dockRef.current?.style.setProperty('--sheen-o', '0');
		}
	}, [canDrag]);

	// Text-editing surfaces keep their native press behavior (caret placement,
	// selection); everything else on the dock — buttons included — can start a
	// drag, so nobody has to aim for the thin bare chrome.
	const isNativePressTarget = (target: EventTarget | null) =>
		target instanceof Element &&
		!!target.closest(
			'input, textarea, select, a, [role="menu"], [role="menuitem"]'
		);

	// Any press on the dock arms a drag; it becomes one only once the pointer
	// travels past the threshold (a touch more over buttons, so a sloppy click
	// stays a click). A real drag swallows the pressed control's trailing
	// click, so a tool never opens because you moved the dock by it.
	const handleDockPointerDown = (event: React.PointerEvent) => {
		if (
			!canDrag ||
			event.button !== 0 ||
			isNativePressTarget(event.target)
		) {
			return;
		}
		const dock = dockRef.current;
		if (!dock) {
			return;
		}
		const rect = dock.getBoundingClientRect();
		const startX = event.clientX;
		const startCenter = rect.left + rect.width / 2;
		// The dock keeps its full width even when collapsed (only the clip
		// hides part of it), so clamp by the full width — the centered notch
		// then stays within the area where the expanded bar also fits.
		const halfWidth = dock.offsetWidth / 2;
		const onButton = isInteractiveTarget(event.target);
		const threshold = onButton ? BUTTON_DRAG_THRESHOLD : DRAG_THRESHOLD;
		const pointerId = event.pointerId;
		// Pointer capture keeps the gesture alive when the cursor crosses into
		// the WordPress preview iframe, whose document would otherwise swallow
		// every pointer event and freeze the drag. Capturing retargets the
		// eventual click though, so a press on a button defers it until the
		// threshold confirms a drag (the click is dead at that point anyway);
		// a press on the bare chrome is an inert tap and captures right away.
		const capturePointer = () => {
			try {
				dockRef.current?.setPointerCapture(pointerId);
			} catch {
				// Synthetic/edge cases where capture isn't available; ignore.
			}
		};
		if (!onButton) {
			capturePointer();
		}
		dragArmedRef.current = true;
		draggedRef.current = false;
		const handleMove = (moveEvent: PointerEvent) => {
			const dx = moveEvent.clientX - startX;
			if (!draggedRef.current) {
				if (Math.abs(dx) < threshold) {
					return;
				}
				draggedRef.current = true;
				setIsDragging(true);
				capturePointer();
			}
			setSheen(1, moveEvent.clientX);
			const min = halfWidth + DRAG_EDGE;
			const max = Math.max(
				min,
				window.innerWidth - halfWidth - DRAG_EDGE
			);
			const desired = startCenter + dx;
			// Keep pushing past the edge and the dock arms to dock into that
			// corner.
			const side =
				desired < min - CORNER_OVERDRAG
					? 'left'
					: desired > max + CORNER_OVERDRAG
						? 'right'
						: null;
			dragSideRef.current = side;
			setDragSide(side);
			setDockCenter(Math.min(Math.max(desired, min), max));
		};
		const handleUp = () => {
			window.removeEventListener('pointermove', handleMove, true);
			window.removeEventListener('pointerup', handleUp, true);
			window.removeEventListener('pointercancel', handleUp, true);
			dragArmedRef.current = false;
			if (!draggedRef.current) {
				// A still press — let the pressed control's click go through.
				return;
			}
			draggedRef.current = false;
			// A real drag: whatever was pressed (often a tool button now) must
			// not also fire its click on release. That click is always the
			// FIRST one after the release, so eat exactly one; the timeout only
			// cleans up when the browser never fired a trailing click at all.
			const eatClick = (clickEvent: MouseEvent) => {
				clickEvent.stopPropagation();
				clickEvent.preventDefault();
			};
			window.addEventListener('click', eatClick, {
				capture: true,
				once: true,
			});
			window.setTimeout(
				() =>
					window.removeEventListener('click', eatClick, {
						capture: true,
					}),
				250
			);
			setIsDragging(false);
			// Keep the sheen only if the pointer actually rests on the dock.
			if (!dockRef.current?.matches(':hover')) {
				setSheen(0);
			}
			// Released while pushed past the edge: fold the bar into a corner
			// launcher. With motion allowed, play the shrink-to-corner animation
			// first (committing to `cornered` on its end); reduced motion snaps
			// straight to the launcher.
			if (dragSideRef.current !== null && !prefersReducedMotion()) {
				setIsCollapsed(false);
				setIsFolding(true);
			}
		};
		// Window-level listeners so a fast pointer can't outrun the dock's box.
		window.addEventListener('pointermove', handleMove, true);
		window.addEventListener('pointerup', handleUp, true);
		window.addEventListener('pointercancel', handleUp, true);
	};

	const handleDockPointerMove = (event: React.PointerEvent) => {
		// A live gesture drives the sheen from its own window listeners; this
		// only runs the hover reveal — full strength over the bare chrome, a
		// whisper over controls so the surface still reads as one.
		if (dragArmedRef.current || !canDrag) {
			return;
		}
		setSheen(isInteractiveTarget(event.target) ? 0.12 : 1, event.clientX);
	};

	const handleDockPointerLeave = () => {
		if (!dragArmedRef.current) {
			setSheen(0);
		}
	};

	// Dragging the corner launcher back out is the inverse of the fold: past the
	// threshold the bar reappears and tracks the pointer along the bottom edge,
	// reusing the same drag + corner-preview machinery as the grip.
	const handleCornerPointerDown = (event: React.PointerEvent) => {
		if (event.button !== 0) {
			return;
		}
		cornerDragRef.current = { startX: event.clientX };
		cornerDraggedRef.current = false;
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {
			// Synthetic/edge cases where capture isn't available; ignore.
		}
	};

	const handleCornerPointerMove = (event: React.PointerEvent) => {
		const drag = cornerDragRef.current;
		if (!drag) {
			return;
		}
		if (
			!cornerDraggedRef.current &&
			Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD
		) {
			return;
		}
		if (!cornerDraggedRef.current) {
			// First real movement: bring the bar back and hand off to a drag. The
			// launcher stays mounted (isMaximizing) so it keeps pointer capture.
			cornerDraggedRef.current = true;
			setIsUnfolding(false);
			setIsCollapsed(false);
			setIsMaximizing(true);
			setIsDragging(true);
		}
		const halfWidth = (lastDockWidthRef.current || 320) / 2;
		const min = halfWidth + DRAG_EDGE;
		const max = Math.max(min, window.innerWidth - halfWidth - DRAG_EDGE);
		const desired = event.clientX;
		// Push it back to an edge and the corner preview re-arms, so releasing
		// there re-minimizes — same behaviour as the grip drag.
		setDragSide(
			desired < min - CORNER_OVERDRAG
				? 'left'
				: desired > max + CORNER_OVERDRAG
					? 'right'
					: null
		);
		setDockCenter(Math.min(Math.max(desired, min), max));
	};

	const handleCornerPointerUp = (event: React.PointerEvent) => {
		if (!cornerDragRef.current) {
			return;
		}
		try {
			event.currentTarget.releasePointerCapture(event.pointerId);
		} catch {
			// The pointer may already be released; ignore.
		}
		cornerDragRef.current = null;
		if (!cornerDraggedRef.current) {
			// A plain tap — let the click handler restore the bar to centre.
			return;
		}
		setIsMaximizing(false);
		setIsDragging(false);
		// Dropped back at an edge → fold straight back into that corner; dropped
		// anywhere else → the bar stays maximized where it was pulled out to.
		if (dragSide !== null && !prefersReducedMotion()) {
			setIsFolding(true);
		}
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

	// Maximize, explained by motion: the restored dock doesn't pop in — it
	// slides out of the corner launcher's exact spot along the bottom edge,
	// swelling as it travels, and unfurls into the bar in place (the genie
	// idea, not the genie warp). Bottom-anchored scaling keeps it welded to
	// the edge the whole way. The keyframes are computed per run because the
	// travel distance depends on which corner it left from.
	useLayoutEffect(() => {
		if (!isUnfolding) {
			return;
		}
		const dock = dockRef.current;
		const source = cornerRectRef.current;
		cornerRectRef.current = null;
		if (!dock || !source || typeof dock.animate !== 'function') {
			setIsUnfolding(false);
			return;
		}
		const target = dock.getBoundingClientRect();
		if (!target.width || !target.height) {
			setIsUnfolding(false);
			return;
		}
		const dx =
			source.left + source.width / 2 - (target.left + target.width / 2);
		const dy = source.bottom - target.bottom;
		const sx = source.width / target.width;
		const sy = source.height / target.height;
		// Pre-scale radius so the tiny starting frame shows the launcher's own
		// rounding, not a scaled-to-nothing sliver of the dock's corners.
		const startRadius = Math.min(480, 13 / Math.max(sx, 0.03));
		dock.style.transformOrigin = '50% 100%';
		const travel = dock.animate(
			[
				{
					transform: `translateX(-50%) translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
					clipPath: `inset(0 round ${startRadius}px)`,
				},
				{
					// Slides out of the corner along the edge first, swelling…
					transform: `translateX(-50%) translate(${dx * 0.45}px, ${
						dy * 0.85
					}px) scale(${sx + (1 - sx) * 0.3}, ${sy + (1 - sy) * 0.34})`,
					clipPath: `inset(0 round ${Math.max(
						24,
						startRadius * 0.4
					)}px)`,
					offset: 0.42,
				},
				{
					// …then unfurls upward into the bar.
					transform: 'translateX(-50%)',
					clipPath: 'inset(0 round 18px 18px 0 0)',
				},
			],
			{ duration: 440, easing: 'cubic-bezier(0.3, 0.9, 0.3, 1)' }
		);
		// The contents stay quiet until the frame is big enough to hold them.
		const body = dock.querySelector<HTMLElement>(`.${css.dockBody}`);
		const contentFade = body?.animate(
			[
				{ opacity: 0 },
				{ opacity: 0, offset: 0.35 },
				{ opacity: 1, offset: 0.85 },
				{ opacity: 1 },
			],
			{ duration: 440, easing: 'linear' }
		);
		let finished = false;
		const finish = () => {
			if (finished) {
				return;
			}
			finished = true;
			dock.style.transformOrigin = '';
			setIsUnfolding(false);
		};
		travel.addEventListener('finish', finish);
		const timer = window.setTimeout(finish, 640);
		return () => {
			window.clearTimeout(timer);
			travel.cancel();
			contentFade?.cancel();
			finish();
		};
	}, [isUnfolding]);

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

	// A drag tucked the dock into a bottom corner: show a small launcher there
	// instead of the full bar. `isFolding` keeps the bar mounted through its
	// shrink animation, so the corner state only commits once that finishes.
	const cornered = dragSide !== null && !isDragging && !isFolding;

	// The fold keyframes run on the nav itself; commit the corner state when
	// they end (ignore animations bubbling up from descendants). The unfold is
	// driven by the Web Animations effect above, which ends itself.
	const handleDockAnimationEnd = (event: React.AnimationEvent) => {
		if (event.target !== dockRef.current) {
			return;
		}
		if (isFolding) {
			setIsFolding(false);
		}
	};

	return (
		<>
			{(cornered || isFolding || isMaximizing) && (
				<button
					type="button"
					className={classNames(css.dockCorner, {
						[css.dockCornerLeft]: dragSide === 'left',
						[css.dockCornerRight]: dragSide === 'right',
						// Hidden (but still capturing the pointer) while it's being
						// dragged out — the reappearing bar is what the user sees move.
						[css.dockCornerDragging]: isMaximizing,
					})}
					aria-label="Show Playground tools"
					title="Drag out or click to show Playground tools"
					// Not clickable until the fold finishes, so a click mid-animation
					// can't kick off an unfold before the launcher has settled.
					disabled={isFolding}
					onPointerDown={handleCornerPointerDown}
					onPointerMove={handleCornerPointerMove}
					onPointerUp={handleCornerPointerUp}
					onClick={(event) => {
						// A drag already handled the restore; ignore the trailing click.
						if (cornerDraggedRef.current) {
							return;
						}
						// Where the growth starts: the launcher's box, captured
						// before the state flip unmounts it.
						cornerRectRef.current =
							event.currentTarget.getBoundingClientRect();
						setDragSide(null);
						setDockCenter(null);
						setIsCollapsed(false);
						if (!prefersReducedMotion()) {
							setIsUnfolding(true);
						}
					}}
				>
					<span
						className={css.dockCornerLogo}
						dangerouslySetInnerHTML={{ __html: playgroundLogoSvg }}
					/>
				</button>
			)}
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
					[css.dockWillCorner]: dragSide !== null && isDragging,
					[css.dockWillCornerLeft]: dragSide === 'left' && isDragging,
					[css.dockWillCornerRight]:
						dragSide === 'right' && isDragging,
					[css.dockFolding]: isFolding,
					[css.dockFoldingLeft]: isFolding && dragSide === 'left',
					[css.dockFoldingRight]: isFolding && dragSide === 'right',
					[css.dockUnfolding]: isUnfolding,
					[css.dockCornered]: cornered,
					[css.dockCanMove]: canDrag,
					[css.dockDragging]: isDragging,
				})}
				style={dockStyle}
				onAnimationEnd={handleDockAnimationEnd}
				onPointerDown={handleDockPointerDown}
				onPointerMove={handleDockPointerMove}
				onPointerLeave={handleDockPointerLeave}
				aria-label="Playground tools"
			>
				{/* No drag handle: the whole dark chrome is the grab. This sheen is
				    the affordance — light pools along the top edge under the pointer
				    (via --sheen-x/--sheen-o) to say "you can hold this here". */}
				<div className={css.dockSheen} aria-hidden="true" />
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
						{/* Two switches fused into one split capsule (the hr-11
						    "pill" study): the left half hides/shows the tools, the
						    right half toggles full width. Each glyph shows the
						    ACTION and carries the state itself — the chevron flips
						    when the tools are hidden, the screen mark swaps
						    between full-bleed and floating — so neither needs a
						    pressed style. Desktop-only (CSS hides it on the mobile
						    bar). */}
						<div className={css.dockTogglePill}>
							<button
								type="button"
								ref={collapseToggleRef}
								className={classNames(
									css.dockPillBtn,
									css.dockPillCollapse
								)}
								aria-label={
									isCollapsed ? 'Show tools' : 'Hide tools'
								}
								title={
									isCollapsed ? 'Show tools' : 'Hide tools'
								}
								onClick={() =>
									setIsCollapsed((collapsed) => !collapsed)
								}
							>
								<DockCollapseChevron />
							</button>
							<button
								type="button"
								className={css.dockPillBtn}
								aria-label={
									dockFullWidth
										? 'Exit full width'
										: 'Full width'
								}
								title={
									dockFullWidth
										? 'Exit full width'
										: 'Full width'
								}
								onClick={toggleFullWidth}
							>
								{dockFullWidth ? (
									<DockFloatingIcon />
								) : (
									<DockFullWidthIcon />
								)}
							</button>
						</div>
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
			{!cornered && !isFolding && (
				<AutosaveNudge anchor={playgroundsToolEl} />
			)}
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
