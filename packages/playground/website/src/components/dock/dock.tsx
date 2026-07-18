import classNames from 'classnames';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import type {
	AnimationEvent as ReactAnimationEvent,
	CSSProperties,
	PointerEvent as ReactPointerEvent,
} from 'react';
import { CSSTransition } from 'react-transition-group';
import { Icon } from '@wordpress/components';
import {
	close,
	external,
	grid,
	list,
	page,
	pencil,
	plus,
	wordpress,
} from '@wordpress/icons';
import type { DockPaneSection } from '../../lib/state/redux/slice-ui';
import {
	setDockOperationNotice,
	setShareExportOpen,
	setDockPaneOpen,
	setDockPaneSection,
} from '../../lib/state/redux/slice-ui';
import {
	readDockFullWidth,
	writeDockFullWidth,
} from '../../lib/dock-full-width';
import {
	getActiveClientInfo,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { isSiteSavingDisabled } from '../../lib/state/url/router';
import { useInlineRename } from '../../lib/hooks/use-inline-rename';
import playgroundLogoUrl from '../../playground-logo.svg';
import AddressBar from '../address-bar';
import { SaveStatusIndicator } from '../browser-chrome/save-status-indicator';
import { SiteManager } from '../site-manager';
import {
	useRecentAutosaveNudgeVisible,
	useSetRecentAutosaveNudgeAnchor,
} from '../ensure-playground-site/recent-autosave-nudge-context';
import { TruncatedText } from '../truncated-text';
import { DockCornerLauncher } from './dock-corner-launcher';
import { DockItemButton } from './dock-item-button';
import { DockPane } from './dock-pane';
import type { DockPaneHeaderOverride } from './dock-pane';
import { DockTogglePill } from './dock-toggle-pill';
import {
	DOCK_DRAG_EDGE,
	DOCK_OPERATION_TOAST_MIN_HEIGHT,
	getDockOperationToastStyle,
	getDockPaneStyle,
} from './dock-positioning';
import { DockBlueprintIcon, DockDatabaseIcon } from './icons';
import css from './style.module.css';

type DockItem = {
	section: DockPaneSection;
	label: string;
	ariaLabel: string;
	icon: JSX.Element;
	isPrimary?: boolean;
};

export type DockProps = {
	paneCloseBlocked: boolean;
	onPaneCloseBlockedChange: (isBlocked: boolean) => void;
};

const DRAG_THRESHOLD = 4;
const CORNER_OVERDRAG = 36;
const MOBILE_QUERY = '(max-width: 1024px)';

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
		icon: <DockBlueprintIcon />,
	},
	{
		section: 'settings',
		label: 'Site Settings',
		ariaLabel: 'Site Settings',
		icon: <Icon icon={wordpress} size={24} />,
	},
	{
		section: 'database',
		label: 'Database',
		ariaLabel: 'Database',
		icon: <DockDatabaseIcon />,
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
		label: 'Export',
		ariaLabel: 'Export',
		icon: <Icon icon={external} size={24} />,
	},
];

const PANE_COPY: Record<
	DockPaneSection,
	{ title: string; description: string }
> = {
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
		title: 'Site Settings',
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
		title: 'Export',
		description: '',
	},
	save: {
		title: 'Store permanently',
		description: '',
	},
};

/**
 * Hosts every website tool in one bottom Dock while leaving each tool's domain
 * logic in its existing component.
 */
export function Dock({
	paneCloseBlocked,
	onPaneCloseBlockedChange,
}: DockProps) {
	const dispatch = useAppDispatch();
	const dockPaneIsOpen = useAppSelector((state) => state.ui.dockPaneIsOpen);
	const activeModal = useAppSelector((state) => state.ui.activeModal);
	const section = useAppSelector((state) => state.ui.dockPaneSection);
	const shareExportOpen = useAppSelector((state) => state.ui.shareExportOpen);
	const [newPlaygroundHeaderOverride, setNewPlaygroundHeaderOverride] =
		useState<DockPaneHeaderOverride>();
	const handleNewPlaygroundHeaderChange = useCallback(
		(header: DockPaneHeaderOverride | undefined) =>
			setNewPlaygroundHeaderOverride(header),
		[]
	);
	const activeSite = useActiveSite();
	const clientInfo = useAppSelector(getActiveClientInfo);
	const paneCopy = PANE_COPY[section];
	const paneTitle = paneCopy.title;
	const isMobile = useIsMobileDock();
	const isEditorSection = section === 'blueprint' || section === 'files';
	const isFixedHeightSection =
		section === 'new' || (section === 'share' && shareExportOpen);
	const showSharedHeader = !isEditorSection;
	const siteSettingsVisible = dockPaneIsOpen && section === 'settings';
	const playgroundTitle =
		activeSite?.metadata.storage === 'none'
			? 'Unsaved Playground'
			: activeSite?.metadata.name;
	const savingDisabled = isSiteSavingDisabled();
	const inlineRename = useInlineRename();
	const canManageActiveSite = activeSite?.metadata.storage !== 'none';
	const recentAutosaveNudgeVisible = useRecentAutosaveNudgeVisible();
	const setRecentAutosaveNudgeAnchor = useSetRecentAutosaveNudgeAnchor();
	const playgroundsButtonRef = useRef<HTMLButtonElement>(null);
	const dockStatusRef = useRef<HTMLDivElement>(null);
	const operationNotice = useAppSelector(
		(state) => state.ui.dockOperationNotice
	);

	const paneRef = useRef<HTMLElement>(null);
	const dockRef = useRef<HTMLElement>(null);
	const operationToastRef = useRef<HTMLDivElement>(null);
	const toolsRef = useRef<HTMLDivElement>(null);
	const focusBeforePaneRef = useRef<HTMLElement | null>(null);
	const hasOpenedPaneRef = useRef(false);
	const collapseButtonRef = useRef<HTMLButtonElement>(null);
	const dragCleanupRef = useRef<(() => void) | null>(null);
	const dragArmedRef = useRef(false);
	const draggedRef = useRef(false);
	const dragSideRef = useRef<'left' | 'right' | null>(null);
	const cornerDragRef = useRef<{ startX: number } | null>(null);
	const cornerDraggedRef = useRef(false);
	const cornerLauncherSideRef = useRef<'left' | 'right'>('left');
	const cornerRectRef = useRef<DOMRect | null>(null);
	const lastDockWidthRef = useRef(0);
	const modeSwitchTimerRef = useRef<number | null>(null);
	const closeGitHubExport = useCallback(
		() => dispatch(setShareExportOpen(false)),
		[dispatch]
	);
	const githubExportHeaderOverride = useMemo<DockPaneHeaderOverride>(
		() => ({
			title: 'Export to GitHub',
			backLabel: 'Back to export options',
			onBack: closeGitHubExport,
		}),
		[closeGitHubExport]
	);
	const paneHeaderOverride =
		section === 'new'
			? newPlaygroundHeaderOverride
			: section === 'share' && shareExportOpen
				? githubExportHeaderOverride
				: undefined;

	const [dockSize, setDockSize] = useState({ width: 0, height: 0 });
	const [paneHeight, setPaneHeight] = useState(0);
	const [operationToastHeight, setOperationToastHeight] = useState(
		DOCK_OPERATION_TOAST_MIN_HEIGHT
	);
	const [toolsHeight, setToolsHeight] = useState(0);
	const [viewportSize, setViewportSize] = useState(() => ({
		width: window.innerWidth,
		height: window.innerHeight,
	}));
	const [dockCenter, setDockCenter] = useState<number | null>(null);
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [isFullWidth, setIsFullWidth] = useState(readDockFullWidth);
	const [isDragging, setIsDragging] = useState(false);
	const [cornerSide, setCornerSide] = useState<'left' | 'right' | null>(null);
	const [isModeSwitching, setIsModeSwitching] = useState(false);
	const [isFolding, setIsFolding] = useState(false);
	const [isUnfolding, setIsUnfolding] = useState(false);
	const [isMaximizing, setIsMaximizing] = useState(false);
	const [paneExitComplete, setPaneExitComplete] = useState(!dockPaneIsOpen);
	// Retain the full pane body until its exit motion finishes. Hiding it when
	// close starts would collapse the surface to its header before it can leave.
	const paneContentVisible = dockPaneIsOpen || !paneExitComplete;

	useEffect(() => {
		if (typeof ResizeObserver === 'undefined') {
			return;
		}
		const observer = new ResizeObserver(() => {
			const dock = dockRef.current;
			const tools = toolsRef.current;
			if (dock) {
				setDockSize({
					width: dock.offsetWidth,
					height: dock.offsetHeight,
				});
				if (dock.offsetWidth > 0) {
					lastDockWidthRef.current = dock.offsetWidth;
				}
			}
			if (dock && tools) {
				setToolsHeight(dock.offsetHeight - tools.offsetTop);
			}
		});
		if (dockRef.current) {
			observer.observe(dockRef.current);
		}
		if (toolsRef.current) {
			observer.observe(toolsRef.current);
		}
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		/** Keeps floating geometry inside the live viewport. */
		const updateViewportSize = () => {
			setViewportSize({
				width: window.innerWidth,
				height: window.innerHeight,
			});
		};
		window.addEventListener('resize', updateViewportSize);
		return () => window.removeEventListener('resize', updateViewportSize);
	}, []);

	useLayoutEffect(() => {
		const pane = paneRef.current;
		if (!dockPaneIsOpen || !pane) {
			setPaneHeight(0);
			return;
		}

		/** Keeps the toast above content-driven panes as their height changes. */
		const updatePaneHeight = () => setPaneHeight(pane.offsetHeight);
		updatePaneHeight();
		if (typeof ResizeObserver === 'undefined') {
			return;
		}
		const observer = new ResizeObserver(updatePaneHeight);
		observer.observe(pane);
		return () => observer.disconnect();
	}, [section, dockPaneIsOpen]);

	useLayoutEffect(() => {
		const toast = operationToastRef.current;
		if (!operationNotice || !toast) {
			setOperationToastHeight(DOCK_OPERATION_TOAST_MIN_HEIGHT);
			return;
		}

		/** Keeps viewport clamping accurate when text wraps or zoom changes. */
		const updateToastHeight = () =>
			setOperationToastHeight(toast.offsetHeight);
		updateToastHeight();
		if (typeof ResizeObserver === 'undefined') {
			return;
		}
		const observer = new ResizeObserver(updateToastHeight);
		observer.observe(toast);
		return () => observer.disconnect();
	}, [operationNotice]);

	useEffect(() => {
		if (dockCenter === null || !dockSize.width) {
			return;
		}
		const halfWidth = dockSize.width / 2;
		const min = halfWidth + DOCK_DRAG_EDGE;
		const max = Math.max(
			min,
			viewportSize.width - halfWidth - DOCK_DRAG_EDGE
		);
		const clamped = Math.min(Math.max(dockCenter, min), max);
		if (clamped !== dockCenter) {
			setDockCenter(clamped);
		}
	}, [dockCenter, dockSize.width, viewportSize.width]);

	useEffect(() => {
		const root = document.documentElement;
		const headerHeight = Math.max(0, dockSize.height - toolsHeight);
		// Desktop collapse moves the tools below the viewport without changing the
		// Dock's measured height. Mobile removes the tools from layout, so its live
		// measurement already is the visible height.
		const visibleHeight =
			isCollapsed && !isMobile ? headerHeight : dockSize.height;
		if (visibleHeight > 0) {
			root.style.setProperty(
				'--dock-docked-height',
				`${visibleHeight}px`
			);
		}
		root.toggleAttribute('data-dock-full-width', isFullWidth && !isMobile);
		return () => {
			root.style.removeProperty('--dock-docked-height');
			root.removeAttribute('data-dock-full-width');
		};
	}, [dockSize.height, isCollapsed, isFullWidth, isMobile, toolsHeight]);

	useEffect(() => {
		// Opening Store permanently from the visible status must not unfold a
		// collapsed Dock. Tool buttons unfold explicitly in openSection().
		if (!dockPaneIsOpen || section === 'save') {
			return;
		}
		setIsCollapsed(false);
		dragSideRef.current = null;
		setCornerSide(null);
		setIsFolding(false);
		setIsMaximizing(false);
	}, [section, dockPaneIsOpen]);

	// The autosave nudge points at the Playgrounds button, or at the save
	// status when a collapsed Dock hides the tools row. A cornered Dock shows
	// neither, and the nudge then falls back to its free-floating position
	// instead of pointing at nothing.
	useEffect(() => {
		if (cornerSide !== null) {
			setRecentAutosaveNudgeAnchor(null);
		} else if (isCollapsed) {
			setRecentAutosaveNudgeAnchor(dockStatusRef.current);
		} else {
			setRecentAutosaveNudgeAnchor(playgroundsButtonRef.current);
		}
		return () => setRecentAutosaveNudgeAnchor(null);
	}, [isCollapsed, cornerSide, setRecentAutosaveNudgeAnchor]);

	// The overlay query parameter only describes New and Playgrounds. Remove it
	// when that requested pane closes or another Dock destination replaces it.
	useEffect(() => {
		if (
			dockPaneIsOpen &&
			(section === 'new' || section === 'playgrounds')
		) {
			return;
		}
		const url = new URL(window.location.href);
		if (!url.searchParams.has('overlay')) {
			return;
		}
		url.searchParams.delete('overlay');
		window.history.replaceState(window.history.state, '', url);
	}, [section, dockPaneIsOpen]);

	useEffect(() => {
		if (!isMobile) {
			return;
		}
		dragCleanupRef.current?.();
		dragCleanupRef.current = null;
		dragArmedRef.current = false;
		dragSideRef.current = null;
		cornerDragRef.current = null;
		cornerDraggedRef.current = false;
		setDockCenter(null);
		setCornerSide(null);
		setIsCollapsed(false);
		setIsDragging(false);
		setIsFolding(false);
		setIsUnfolding(false);
		setIsMaximizing(false);
	}, [isMobile]);

	useEffect(() => {
		return () => {
			dragCleanupRef.current?.();
			dragCleanupRef.current = null;
			if (modeSwitchTimerRef.current !== null) {
				window.clearTimeout(modeSwitchTimerRef.current);
			}
		};
	}, []);

	// Keep mounted tool state out of the keyboard and accessibility trees while
	// the pane is closed. React 18 does not forward the inert attribute.
	useEffect(() => {
		const pane = paneRef.current;
		if (!pane) {
			return;
		}
		if (dockPaneIsOpen) {
			pane.removeAttribute('aria-hidden');
			pane.removeAttribute('inert');
		} else {
			pane.setAttribute('aria-hidden', 'true');
			pane.setAttribute('inert', '');
		}
	}, [dockPaneIsOpen]);

	useEffect(() => {
		/** Lets the active modal or popover consume Escape before the Dock does. */
		const closeOnEscape = (event: KeyboardEvent) => {
			if (
				event.key !== 'Escape' ||
				activeModal ||
				!dockPaneIsOpen ||
				paneCloseBlocked
			) {
				return;
			}
			if (
				document.querySelector(
					'.components-popover:not(.components-tooltip), .components-modal__screen-overlay'
				)
			) {
				return;
			}
			dispatch(setDockPaneOpen(false));
		};
		document.addEventListener('keydown', closeOnEscape, true);
		return () =>
			document.removeEventListener('keydown', closeOnEscape, true);
	}, [activeModal, dispatch, paneCloseBlocked, dockPaneIsOpen]);

	useEffect(() => {
		if (dockPaneIsOpen) {
			hasOpenedPaneRef.current = true;
			if (!focusBeforePaneRef.current) {
				focusBeforePaneRef.current =
					document.activeElement as HTMLElement | null;
			}
			const timer = window.setTimeout(() => {
				if (
					paneRef.current &&
					!paneRef.current.contains(document.activeElement)
				) {
					paneRef.current.focus();
				}
			}, 120);
			return () => window.clearTimeout(timer);
		}
		if (!hasOpenedPaneRef.current) {
			return;
		}
		const previousFocus = focusBeforePaneRef.current;
		focusBeforePaneRef.current = null;
		if (previousFocus && document.contains(previousFocus)) {
			previousFocus.focus();
		}
		if (document.activeElement === document.body) {
			collapseButtonRef.current?.focus();
		}
	}, [section, dockPaneIsOpen]);

	/** Opens one tool, or closes it when its already-active button is pressed. */
	const openSection = useCallback(
		(nextSection: DockPaneSection) => {
			if (paneCloseBlocked) {
				return;
			}
			if (dockPaneIsOpen && section === nextSection) {
				dispatch(setDockPaneOpen(false));
				return;
			}
			if (dockPaneIsOpen) {
				focusBeforePaneRef.current =
					document.activeElement as HTMLElement | null;
			}
			setIsCollapsed(false);
			dragSideRef.current = null;
			setCornerSide(null);
			dispatch(setDockPaneSection(nextSection));
			dispatch(setDockPaneOpen(true));
		},
		[dispatch, paneCloseBlocked, section, dockPaneIsOpen]
	);

	// The Dock can move only while it floats. Full-width and mobile modes are
	// already fixed to an edge and keep their native control interactions.
	const canDrag = !isMobile && !isFullWidth;

	/** Reports whether a target is a real Dock control. */
	const isInteractiveTarget = (target: EventTarget | null) =>
		target instanceof Element &&
		Boolean(
			target.closest(
				'button, a, input, textarea, select, [role="menu"], [role="menuitem"]'
			)
		);

	/** Writes the pointer-driven grab sheen without re-rendering the Dock. */
	const setDockSheen = (opacity: number, clientX?: number) => {
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

	useEffect(() => {
		if (!canDrag) {
			dockRef.current?.style.setProperty('--sheen-o', '0');
		}
	}, [canDrag]);

	// Controls keep native press, selection, and motor-tolerance behavior. The
	// surrounding Dock chrome remains a large drag handle without turning a small
	// pointer wobble on a button into an accidental Dock move.
	const isNativePressTarget = (target: EventTarget | null) =>
		target instanceof Element &&
		Boolean(
			target.closest(
				'button, input, textarea, select, a, [role="menu"], [role="menuitem"]'
			)
		);

	/** Arms a whole-surface horizontal drag and swallows clicks after real drags. */
	const handleDockPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
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
		const halfWidth = dock.offsetWidth / 2;
		const pointerId = event.pointerId;
		const capturePointer = () => {
			try {
				dockRef.current?.setPointerCapture(pointerId);
			} catch {
				// Synthetic pointer events may not support capture.
			}
		};
		capturePointer();
		dragArmedRef.current = true;
		draggedRef.current = false;

		/** Moves the Dock and previews a corner after deliberate overdrag. */
		const moveDock = (moveEvent: PointerEvent) => {
			const delta = moveEvent.clientX - startX;
			if (!draggedRef.current) {
				if (Math.abs(delta) < DRAG_THRESHOLD) {
					return;
				}
				draggedRef.current = true;
				setIsDragging(true);
				capturePointer();
			}

			setDockSheen(1, moveEvent.clientX);
			const min = halfWidth + DOCK_DRAG_EDGE;
			const max = Math.max(
				min,
				window.innerWidth - halfWidth - DOCK_DRAG_EDGE
			);
			const desiredCenter = startCenter + delta;
			const side =
				desiredCenter < min - CORNER_OVERDRAG
					? 'left'
					: desiredCenter > max + CORNER_OVERDRAG
						? 'right'
						: null;
			dragSideRef.current = side;
			if (side) {
				cornerLauncherSideRef.current = side;
			}
			setCornerSide(side);
			setDockCenter(Math.min(Math.max(desiredCenter, min), max));
		};

		/** Finishes a drag without also activating the pressed Dock control. */
		const finishDockDrag = () => {
			dragCleanupRef.current?.();
			dragCleanupRef.current = null;
			// Let the next click target the restored corner launcher instead of
			// staying captured by the Dock that just finished folding.
			try {
				dock.releasePointerCapture(pointerId);
			} catch {
				// Synthetic pointer events may not support capture.
			}
			dragArmedRef.current = false;
			if (!draggedRef.current) {
				return;
			}
			draggedRef.current = false;

			const eatClick = (clickEvent: MouseEvent) => {
				if (
					!(clickEvent.target instanceof Node) ||
					!dockRef.current?.contains(clickEvent.target)
				) {
					return;
				}
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
			if (!dockRef.current?.matches(':hover')) {
				setDockSheen(0);
			}

			if (dragSideRef.current !== null && dockPaneIsOpen) {
				// An open pane owns the expanded Dock. Refuse a fold that would hide
				// both the tool in use and its launcher.
				dragSideRef.current = null;
				setCornerSide(null);
				setDockCenter(null);
			} else if (
				dragSideRef.current !== null &&
				!prefersReducedMotion()
			) {
				setIsCollapsed(false);
				setIsFolding(true);
			}
		};

		dragCleanupRef.current?.();
		dragCleanupRef.current = () => {
			window.removeEventListener('pointermove', moveDock, true);
			window.removeEventListener('pointerup', finishDockDrag, true);
			window.removeEventListener('pointercancel', finishDockDrag, true);
		};
		window.addEventListener('pointermove', moveDock, true);
		window.addEventListener('pointerup', finishDockDrag, true);
		window.addEventListener('pointercancel', finishDockDrag, true);
	};

	/** Reveals the grab sheen, softened while the pointer is over a control. */
	const updateDockSheen = (event: ReactPointerEvent<HTMLElement>) => {
		if (dragArmedRef.current || !canDrag) {
			return;
		}
		setDockSheen(
			isInteractiveTarget(event.target) ? 0.12 : 1,
			event.clientX
		);
	};

	/** Hides the sheen after the pointer leaves an idle Dock. */
	const hideDockSheen = () => {
		if (!dragArmedRef.current) {
			setDockSheen(0);
		}
	};

	/** Arms a drag that pulls the minimized launcher back into a full Dock. */
	const handleCornerPointerDown = (
		event: ReactPointerEvent<HTMLButtonElement>
	) => {
		if (event.button !== 0) {
			return;
		}
		cornerDragRef.current = { startX: event.clientX };
		cornerDraggedRef.current = false;
		dragSideRef.current = cornerSide;
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {
			// Synthetic pointer events may not support capture.
		}
	};

	/** Reveals the Dock once a launcher drag crosses the movement threshold. */
	const handleCornerPointerMove = (
		event: ReactPointerEvent<HTMLButtonElement>
	) => {
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
			cornerDraggedRef.current = true;
			setIsUnfolding(false);
			setIsCollapsed(false);
			setIsMaximizing(true);
			setIsDragging(true);
		}

		const halfWidth = (lastDockWidthRef.current || 320) / 2;
		const min = halfWidth + DOCK_DRAG_EDGE;
		const max = Math.max(
			min,
			window.innerWidth - halfWidth - DOCK_DRAG_EDGE
		);
		const desiredCenter = event.clientX;
		const side =
			desiredCenter < min - CORNER_OVERDRAG
				? 'left'
				: desiredCenter > max + CORNER_OVERDRAG
					? 'right'
					: null;
		dragSideRef.current = side;
		if (side) {
			cornerLauncherSideRef.current = side;
		}
		setCornerSide(side);
		setDockCenter(Math.min(Math.max(desiredCenter, min), max));
	};

	/** Leaves the restored Dock floating, or folds it again at an armed edge. */
	const handleCornerPointerUp = (
		event: ReactPointerEvent<HTMLButtonElement>
	) => {
		if (!cornerDragRef.current) {
			return;
		}
		try {
			event.currentTarget.releasePointerCapture(event.pointerId);
		} catch {
			// The pointer may already have been released.
		}
		cornerDragRef.current = null;
		if (!cornerDraggedRef.current) {
			return;
		}
		setIsMaximizing(false);
		setIsDragging(false);
		if (dragSideRef.current !== null && !prefersReducedMotion()) {
			setIsFolding(true);
		}
	};

	/** Hides the tools row without hiding the address or save status. */
	const toggleCollapsed = () => {
		if (paneCloseBlocked) {
			return;
		}
		if (dockPaneIsOpen) {
			dispatch(setDockPaneOpen(false));
		}
		setIsCollapsed((collapsed) => !collapsed);
	};

	/** Switches between the floating Dock and a full-width bottom bar. */
	const toggleFullWidth = () => {
		const next = !isFullWidth;
		// Snap between the two geometries instead of briefly stretching the Dock.
		// Re-enable the normal collapse/corner transitions immediately afterwards.
		setIsModeSwitching(true);
		if (modeSwitchTimerRef.current !== null) {
			window.clearTimeout(modeSwitchTimerRef.current);
		}
		modeSwitchTimerRef.current = window.setTimeout(() => {
			setIsModeSwitching(false);
			modeSwitchTimerRef.current = null;
		}, 60);
		if (next) {
			setDockCenter(null);
			dragSideRef.current = null;
			setCornerSide(null);
		}
		setIsFullWidth(next);
		writeDockFullWidth(next);
	};

	// Grow a clicked launcher out of its exact corner position. The nav is
	// restored before this layout effect, so both source and target rectangles
	// are available for one bottom-anchored Web Animations transition.
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

		const deltaX =
			source.left + source.width / 2 - (target.left + target.width / 2);
		const deltaY = source.bottom - target.bottom;
		const scaleX = source.width / target.width;
		const scaleY = source.height / target.height;
		const startRadius = Math.min(480, 13 / Math.max(scaleX, 0.03));
		dock.style.transformOrigin = '50% 100%';
		const travel = dock.animate(
			[
				{
					transform: `translateX(-50%) translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`,
					clipPath: `inset(0 round ${startRadius}px)`,
				},
				{
					transform: `translateX(-50%) translate(${deltaX * 0.45}px, ${
						deltaY * 0.85
					}px) scale(${scaleX + (1 - scaleX) * 0.3}, ${
						scaleY + (1 - scaleY) * 0.34
					})`,
					clipPath: `inset(0 round ${Math.max(
						24,
						startRadius * 0.4
					)}px)`,
					offset: 0.42,
				},
				{
					transform: 'translateX(-50%)',
					clipPath: 'inset(0 round 18px 18px 0 0)',
				},
			],
			{ duration: 440, easing: 'cubic-bezier(0.3, 0.9, 0.3, 1)' }
		);
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

	const cornered = cornerSide !== null && !isDragging && !isFolding;

	/** Commits a finished fold after the nav's own animation ends. */
	const handleDockAnimationEnd = (
		event: ReactAnimationEvent<HTMLElement>
	) => {
		if (event.target === dockRef.current && isFolding) {
			setIsFolding(false);
		}
	};

	const dockStyle = {
		...(toolsHeight ? { '--dock-body-h': `${toolsHeight}px` } : {}),
		...(dockCenter !== null ? { '--dock-center': `${dockCenter}px` } : {}),
	} as CSSProperties;

	const paneStyle = getDockPaneStyle({
		isMobile,
		dockSize,
		toolsHeight,
		isCollapsed,
		dockCenter,
		viewportSize,
		isEditorSection,
		isFixedHeightSection,
		isPlaygroundsSection: section === 'playgrounds',
	});
	const operationToastStyle = getDockOperationToastStyle({
		isMobile,
		dockSize,
		toolsHeight,
		isCollapsed,
		dockCenter,
		viewportSize,
		paneHeight,
		toastHeight: operationToastHeight,
		paneOpen: dockPaneIsOpen,
		isEditorSection,
	});

	return (
		<>
			{operationNotice && (
				<span className={css.visuallyHidden} role="alert">
					{operationNotice.title}
					{operationNotice.message && `. ${operationNotice.message}`}
				</span>
			)}
			{(cornered || isFolding || isMaximizing) && (
				<DockCornerLauncher
					side={cornerSide ?? cornerLauncherSideRef.current}
					isDragging={isMaximizing}
					isFolding={isFolding}
					onPointerDown={handleCornerPointerDown}
					onPointerMove={handleCornerPointerMove}
					onPointerUp={handleCornerPointerUp}
					onPointerCancel={handleCornerPointerUp}
					onClick={(event) => {
						if (cornerDraggedRef.current) {
							return;
						}
						cornerRectRef.current =
							event.currentTarget.getBoundingClientRect();
						dragSideRef.current = null;
						setCornerSide(null);
						setDockCenter(null);
						setIsCollapsed(false);
						if (!prefersReducedMotion()) {
							setIsUnfolding(true);
						}
					}}
				>
					<img src={playgroundLogoUrl} alt="" />
				</DockCornerLauncher>
			)}
			<CSSTransition
				nodeRef={paneRef}
				in={dockPaneIsOpen}
				timeout={240}
				mountOnEnter
				onEnter={() => setPaneExitComplete(false)}
				onExited={() => setPaneExitComplete(true)}
				classNames={{
					enter: css.paneEnter,
					enterActive: css.paneEnterActive,
					exit: css.paneExit,
					exitActive: css.paneExitActive,
				}}
			>
				<DockPane
					ref={paneRef}
					title={paneTitle}
					description={
						section === 'settings' && activeSite
							? undefined
							: paneCopy.description
					}
					headerSubtitle={
						section === 'settings' && activeSite ? (
							<div className={css.settingsIdentity}>
								{inlineRename.isEditing(activeSite.slug) ? (
									<input
										className={css.settingsNameInput}
										{...inlineRename.getInputProps(
											activeSite
										)}
									/>
								) : (
									<>
										{playgroundTitle && (
											<TruncatedText
												className={css.settingsName}
											>
												{playgroundTitle}
											</TruncatedText>
										)}
										{canManageActiveSite && (
											<button
												type="button"
												className={css.settingsRename}
												aria-label="Rename Playground"
												title="Rename"
												onClick={() =>
													inlineRename.start(
														activeSite
													)
												}
											>
												<Icon icon={pencil} size={16} />
											</button>
										)}
									</>
								)}
							</div>
						) : undefined
					}
					headerAction={
						section === 'playgrounds' ? (
							<button
								type="button"
								className={css.paneHeaderAction}
								disabled={paneCloseBlocked}
								onClick={() => openSection('new')}
							>
								<Icon icon={plus} size={20} />
								New Playground
							</button>
						) : undefined
					}
					headerOverride={paneHeaderOverride}
					className={classNames({
						[css.hostPaneHidden]:
							!dockPaneIsOpen && paneExitComplete,
						[css.paneSave]: section === 'save',
					})}
					style={paneStyle}
					isEditor={isEditorSection}
					isFixedHeight={isFixedHeightSection}
					isCompact={
						section === 'settings' ||
						section === 'share' ||
						section === 'save'
					}
					showHeader={showSharedHeader}
					closeDisabled={paneCloseBlocked}
					closeTitle={
						paneCloseBlocked
							? 'Wait for the current action to finish before closing'
							: 'Close'
					}
					onClose={() => {
						if (!paneCloseBlocked) {
							dispatch(setDockPaneOpen(false));
						}
					}}
				>
					<SiteManager
						isVisible={paneContentVisible}
						mobileUi={isMobile}
						onPaneCloseBlockedChange={onPaneCloseBlockedChange}
						onNewPlaygroundHeaderChange={
							handleNewPlaygroundHeaderChange
						}
					/>
				</DockPane>
			</CSSTransition>
			{operationNotice && (
				<div
					ref={operationToastRef}
					className={css.dockOperationToast}
					role="group"
					aria-label="Operation failed"
					style={operationToastStyle}
				>
					<div className={css.dockOperationToastContent}>
						<div className={css.dockOperationToastTitle}>
							{operationNotice.title}
						</div>
						{operationNotice.message && (
							<div className={css.dockOperationToastMessage}>
								{operationNotice.message}
							</div>
						)}
					</div>
					<button
						type="button"
						aria-label="Dismiss operation error"
						onClick={() =>
							dispatch(setDockOperationNotice(undefined))
						}
					>
						<Icon icon={close} size={18} />
					</button>
				</div>
			)}
			<nav
				ref={dockRef}
				className={classNames(css.dock, {
					[css.dockCollapsed]: isCollapsed,
					[css.dockFull]: !isMobile && isFullWidth,
					[css.dockSwitching]: isModeSwitching,
					[css.dockDragged]: canDrag && dockCenter !== null,
					[css.dockWillCorner]: cornerSide !== null && isDragging,
					[css.dockWillCornerLeft]:
						cornerSide === 'left' && isDragging,
					[css.dockWillCornerRight]:
						cornerSide === 'right' && isDragging,
					[css.dockFolding]: isFolding,
					[css.dockFoldingLeft]: isFolding && cornerSide === 'left',
					[css.dockFoldingRight]: isFolding && cornerSide === 'right',
					[css.dockUnfolding]: isUnfolding,
					[css.dockDragging]: isDragging,
					[css.dockCornered]: cornered,
					[css.dockCanMove]: canDrag,
				})}
				style={dockStyle}
				onAnimationEnd={handleDockAnimationEnd}
				onPointerDown={handleDockPointerDown}
				onPointerMove={updateDockSheen}
				onPointerLeave={hideDockSheen}
				aria-label="Playground tools"
			>
				<div className={css.dockSheen} aria-hidden="true" />
				<div className={css.dockBody}>
					<div className={css.dockTopRow}>
						<div className={css.dockAddress}>
							<AddressBar
								url={clientInfo?.url}
								disabled={!clientInfo}
								onUpdate={
									clientInfo
										? (newUrl) =>
												clientInfo.client.goTo(newUrl)
										: undefined
								}
							/>
						</div>
						<div className={css.dockStatus} ref={dockStatusRef}>
							{playgroundTitle && (
								<span
									className={css.dockSiteName}
									aria-label={
										siteSettingsVisible
											? undefined
											: 'Playground title'
									}
									aria-hidden={
										siteSettingsVisible || undefined
									}
									title={playgroundTitle}
								>
									{playgroundTitle}
								</span>
							)}
							{!savingDisabled && (
								<SaveStatusIndicator
									disabled={paneCloseBlocked}
								/>
							)}
						</div>
						<DockTogglePill
							isCollapsed={isCollapsed}
							isFullWidth={isFullWidth}
							collapseDisabled={paneCloseBlocked}
							collapseButtonRef={collapseButtonRef}
							onToggleCollapsed={toggleCollapsed}
							onToggleFullWidth={toggleFullWidth}
						/>
					</div>
					<div className={css.dockTools} ref={toolsRef}>
						{DOCK_ITEMS.map((item, index) => (
							<DockItemButton
								key={item.section}
								ref={
									item.section === 'playgrounds'
										? playgroundsButtonRef
										: undefined
								}
								label={item.label}
								ariaLabel={item.ariaLabel}
								icon={item.icon}
								isPrimary={item.isPrimary}
								isActive={
									dockPaneIsOpen && section === item.section
								}
								disabled={paneCloseBlocked}
								hasNotification={
									item.section === 'playgrounds' &&
									recentAutosaveNudgeVisible
								}
								notificationAriaSuffix="recent autosave available"
								hasSeparator={index === 2}
								onClick={(event) => {
									// Safari does not focus buttons on click. Do it here so
									// closing a pane returns focus to its Dock control.
									event.currentTarget.focus();
									openSection(item.section);
								}}
							/>
						))}
					</div>
				</div>
			</nav>
		</>
	);
}

/** Tracks the breakpoint where the floating Dock becomes a fixed bottom bar. */
function useIsMobileDock() {
	const [isMobile, setIsMobile] = useState(
		() => window.matchMedia(MOBILE_QUERY).matches
	);
	useEffect(() => {
		const mediaQuery = window.matchMedia(MOBILE_QUERY);
		/** Copies the current media-query result into React state. */
		const update = () => setIsMobile(mediaQuery.matches);
		update();
		mediaQuery.addEventListener('change', update);
		return () => mediaQuery.removeEventListener('change', update);
	}, []);
	return isMobile;
}

/** Reports whether optional motion should be suppressed for this user. */
function prefersReducedMotion() {
	return (
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}
