import classNames from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CSSTransition } from 'react-transition-group';
import { Button } from '@wordpress/components';
import {
	Icon,
	chevronDown,
	chevronUp,
	code,
	grid,
	list,
	page,
	plus,
	share,
	wordpress,
} from '@wordpress/icons';
import type { SiteManagerSection } from '../../lib/state/redux/slice-ui';
import {
	modalSlugs,
	setActiveModal,
	setSiteManagerOpen,
	setSiteManagerSection,
	setSiteSlugToDelete,
	setSiteSlugToRename,
} from '../../lib/state/redux/slice-ui';
import {
	getActiveClientInfo,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import { isSiteSavingDisabled } from '../../lib/state/url/router';
import { SiteManager } from '../site-manager';
import AddressBar from '../address-bar';
import { SaveStatusIndicator } from '../browser-chrome/save-status-indicator';
import { SyncLocalFilesButton } from '../sync-local-files-button';
import css from './style.module.css';

const isSavingDisabled = isSiteSavingDisabled();

type DockSection = Exclude<
	SiteManagerSection,
	'sidebar' | 'site-details' | 'blueprints'
>;

const DRAG_EDGE = 8;
const PANE_GAP = 12;
const DOCK_DEFAULT_BOTTOM = 16;

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

function GripIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="currentColor"
			aria-hidden="true"
		>
			<circle cx="5.5" cy="4" r="1.25" />
			<circle cx="10.5" cy="4" r="1.25" />
			<circle cx="5.5" cy="8" r="1.25" />
			<circle cx="10.5" cy="8" r="1.25" />
			<circle cx="5.5" cy="12" r="1.25" />
			<circle cx="10.5" cy="12" r="1.25" />
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
		icon: <Icon icon={code} size={24} />,
	},
	{
		section: 'settings',
		label: 'This Playground',
		ariaLabel: 'This Playground',
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
		title: 'This Playground',
		description:
			'Open this Playground, or change its runtime, language, and network settings.',
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

type DockPosition = { left: number; top: number };

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
	const playground = usePlaygroundClient();
	const clientInfo = useAppSelector(getActiveClientInfo);
	const paneRef = useRef<HTMLElement>(null);
	const dockRef = useRef<HTMLDivElement>(null);
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

	// Free-floating dock position. `null` keeps the default bottom-center anchor.
	const [dockPosition, setDockPosition] = useState<DockPosition | null>(null);
	const [dockSize, setDockSize] = useState({ width: 0, height: 0 });
	const [isDragging, setIsDragging] = useState(false);
	// Collapsed dock hides the tools row, leaving just the address + status.
	const [isCollapsed, setIsCollapsed] = useState(false);
	const dragStart = useRef<{
		pointerX: number;
		pointerY: number;
		left: number;
		top: number;
	} | null>(null);

	// Track the dock size so the pane can be re-anchored above it when moved.
	useEffect(() => {
		if (!dockRef.current || typeof ResizeObserver === 'undefined') {
			return;
		}
		const observer = new ResizeObserver(() => {
			// Border-box size (offset*) — contentRect omits the dock's padding,
			// which would leave the pane ~16px short and overlapping the dock.
			const el = dockRef.current;
			if (el) {
				setDockSize({
					width: el.offsetWidth,
					height: el.offsetHeight,
				});
			}
		});
		observer.observe(dockRef.current);
		return () => observer.disconnect();
	}, []);

	const clampPosition = useCallback(
		({ left, top }: DockPosition): DockPosition => {
			const maxLeft = Math.max(
				DRAG_EDGE,
				window.innerWidth - dockSize.width - DRAG_EDGE
			);
			const maxTop = Math.max(
				DRAG_EDGE,
				window.innerHeight - dockSize.height - DRAG_EDGE
			);
			return {
				left: Math.min(Math.max(left, DRAG_EDGE), maxLeft),
				top: Math.min(Math.max(top, DRAG_EDGE), maxTop),
			};
		},
		[dockSize.width, dockSize.height]
	);

	// Keep the dragged dock on-screen when the viewport resizes.
	useEffect(() => {
		if (!dockPosition) {
			return;
		}
		const onResize = () =>
			setDockPosition((current) =>
				current ? clampPosition(current) : current
			);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, [dockPosition, clampPosition]);

	const handleDockPointerDown = (event: React.PointerEvent) => {
		if (event.button !== 0 || !dockRef.current) {
			return;
		}
		// Drag from the dock's bare background (the dark gaps between buttons and
		// inputs) and the grip — but never from an actual control, so clicks on
		// the address bar, tools, and status still work normally.
		const target = event.target as HTMLElement;
		if (
			target.closest(
				'input, a, select, textarea, [contenteditable="true"]'
			)
		) {
			return;
		}
		const button = target.closest('button');
		if (button && button.getAttribute('aria-label') !== 'Move the dock') {
			return;
		}
		event.preventDefault();
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {
			// Pointer capture is a best-effort nicety; dragging still works.
		}
		const rect = dockRef.current.getBoundingClientRect();
		dragStart.current = {
			pointerX: event.clientX,
			pointerY: event.clientY,
			left: rect.left,
			top: rect.top,
		};
		setIsDragging(true);
	};

	const handleGripPointerMove = (event: React.PointerEvent) => {
		if (!dragStart.current) {
			return;
		}
		const next = clampPosition({
			left:
				dragStart.current.left +
				(event.clientX - dragStart.current.pointerX),
			top:
				dragStart.current.top +
				(event.clientY - dragStart.current.pointerY),
		});
		setDockPosition(next);
	};

	const handleGripPointerUp = (event: React.PointerEvent) => {
		dragStart.current = null;
		setIsDragging(false);
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	};

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || activeModal || !siteManagerIsOpen) {
				return;
			}
			// Let an open popover (the row actions menu, the address
			// quick-nav) take the first Escape; only a second press closes
			// the dock pane itself.
			if (
				document.querySelector(
					'.components-popover:not(.components-tooltip)'
				)
			) {
				return;
			}
			dispatch(setSiteManagerOpen(false));
		};
		document.addEventListener('keydown', handleKeyDown, true);
		return () => {
			document.removeEventListener('keydown', handleKeyDown, true);
		};
	}, [activeModal, dispatch, siteManagerIsOpen]);

	const openSection = (section: DockSection) => {
		if (siteManagerIsOpen && normalizedSection === section) {
			dispatch(setSiteManagerOpen(false));
			return;
		}
		dispatch(setSiteManagerSection(section));
		dispatch(setSiteManagerOpen(true));
	};

	const openRenameModal = () => {
		if (!activeSite) {
			return;
		}
		dispatch(setSiteSlugToRename(activeSite.slug));
		dispatch(setActiveModal(modalSlugs.RENAME_SITE));
	};

	const openDeleteModal = () => {
		if (!activeSite) {
			return;
		}
		dispatch(setSiteSlugToDelete(activeSite.slug));
		dispatch(setActiveModal(modalSlugs.DELETE_SITE));
	};

	const navigateActiveSite = (path: string) => {
		if (!playground) {
			return;
		}
		dispatch(setSiteManagerOpen(false));
		playground.goTo(path);
	};

	const dockStyle: React.CSSProperties | undefined = dockPosition
		? {
				left: `${dockPosition.left}px`,
				top: `${dockPosition.top}px`,
				bottom: 'auto',
				transform: 'none',
			}
		: undefined;

	// Anchor the pane to the dock (centered on it, clamped to the viewport),
	// opening above or below depending on room. We do this even at the default
	// bottom-center position so the pane clears the dock's real height — the
	// two-row dock (address bar + tools) is taller and would otherwise overlap.
	let paneStyle: React.CSSProperties | undefined;
	if (dockSize.height) {
		const dockTop = dockPosition
			? dockPosition.top
			: window.innerHeight - DOCK_DEFAULT_BOTTOM - dockSize.height;
		const dockBottom = dockTop + dockSize.height;
		const centerX = dockPosition
			? dockPosition.left + dockSize.width / 2
			: window.innerWidth / 2;
		const halfWidth = Math.min(
			isEditorSection ? 560 : 300,
			(window.innerWidth - 2 * DRAG_EDGE) / 2
		);
		const clampedCenter = Math.min(
			Math.max(centerX, halfWidth + DRAG_EDGE),
			window.innerWidth - halfWidth - DRAG_EDGE
		);
		const spaceAbove = dockTop - PANE_GAP - DRAG_EDGE;
		const spaceBelow =
			window.innerHeight - dockBottom - PANE_GAP - DRAG_EDGE;
		const openAbove = spaceAbove >= spaceBelow;
		const available = Math.max(160, openAbove ? spaceAbove : spaceBelow);
		// Fixed-height panes get a stable height (capped) so they don't resize
		// between tabs; everything else stays content-sized via max-height.
		const fixedHeight = isFixedHeightSection
			? Math.min(620, available)
			: undefined;
		paneStyle = {
			left: `${clampedCenter}px`,
			maxHeight: `${available}px`,
			...(fixedHeight ? { height: `${fixedHeight}px` } : {}),
			...(openAbove
				? {
						bottom: `${window.innerHeight - dockTop + PANE_GAP}px`,
						top: 'auto',
					}
				: {
						top: `${dockBottom + PANE_GAP}px`,
						bottom: 'auto',
					}),
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
					aria-label={`${paneCopy.title} pane`}
				>
					<div className={css.paneHeader}>
						<div className={css.paneHeaderMain}>
							<h2>{paneCopy.title}</h2>
							{showDescription && (
								<p className={css.paneDescription}>
									{paneCopy.description}
								</p>
							)}
						</div>
						{normalizedSection === 'playgrounds' && (
							<button
								type="button"
								className={css.paneHeaderAction}
								onClick={() =>
									dispatch(setSiteManagerSection('new'))
								}
							>
								<Icon icon={plus} size={20} />
								New Playground
							</button>
						)}
					</div>
					<div className={css.paneBody}>
						{showPlaygroundShortcuts && (
							<div className={css.shortcuts}>
								<Button
									variant="secondary"
									disabled={!playground}
									onClick={() =>
										navigateActiveSite('/wp-admin/')
									}
								>
									Open WP Admin
								</Button>
								<Button
									variant="secondary"
									disabled={!playground}
									onClick={() => navigateActiveSite('/')}
								>
									Open homepage
								</Button>
								{canManageActiveSite && (
									<div className={css.shortcutsEnd}>
										<Button
											variant="tertiary"
											onClick={openRenameModal}
										>
											Rename
										</Button>
										<Button
											variant="tertiary"
											isDestructive
											onClick={openDeleteModal}
										>
											Delete
										</Button>
									</div>
								)}
							</div>
						)}
						<SiteManager />
					</div>
				</section>
			</CSSTransition>
			<nav
				ref={dockRef}
				className={classNames(css.dock, {
					[css.dockDragging]: isDragging,
				})}
				style={dockStyle}
				aria-label="Playground tools"
				onPointerDown={handleDockPointerDown}
				onPointerMove={handleGripPointerMove}
				onPointerUp={handleGripPointerUp}
				onPointerCancel={handleGripPointerUp}
			>
				<div className={css.dockTopRow}>
					<button
						type="button"
						className={css.dragHandle}
						aria-label="Move the dock"
						title="Drag to move"
					>
						<GripIcon />
					</button>
					<div className={css.dockAddress}>
						<AddressBar
							url={clientInfo?.url}
							onUpdate={
								clientInfo
									? (newUrl) => clientInfo.client.goTo(newUrl)
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
						{activeSite?.metadata?.storage === 'local-fs' && (
							<SyncLocalFilesButton />
						)}
					</div>
					<button
						type="button"
						className={css.collapseToggle}
						aria-label={
							isCollapsed
								? 'Expand dock tools'
								: 'Collapse dock tools'
						}
						aria-expanded={!isCollapsed}
						title={isCollapsed ? 'Show tools' : 'Hide tools'}
						onClick={() =>
							setIsCollapsed((collapsed) => !collapsed)
						}
					>
						<Icon
							icon={isCollapsed ? chevronDown : chevronUp}
							size={20}
						/>
					</button>
				</div>
				<div
					className={classNames(css.dockTools, {
						[css.dockToolsHidden]: isCollapsed,
					})}
				>
					{DOCK_ITEMS.map((item, index) => {
						const isActive =
							siteManagerIsOpen &&
							normalizedSection === item.section;
						const ariaLabel = getDockItemAriaLabel(item, isActive);
						return (
							<span
								key={item.section}
								className={classNames({
									[css.withSeparator]: index === 2,
								})}
							>
								<button
									type="button"
									className={classNames(css.dockItem, {
										[css.dockItemPrimary]: item.isPrimary,
										[css.dockItemActive]: isActive,
									})}
									aria-label={ariaLabel}
									aria-pressed={isActive}
									onClick={() => openSection(item.section)}
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
								</button>
							</span>
						);
					})}
				</div>
			</nav>
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

function getDockItemAriaLabel(item: DockItem, isActive: boolean) {
	if (item.section === 'settings') {
		return isActive ? 'Close This Playground' : 'Open This Playground';
	}
	return item.ariaLabel;
}
