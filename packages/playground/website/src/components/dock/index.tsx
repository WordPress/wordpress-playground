import classNames from 'classnames';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CSSTransition } from 'react-transition-group';
import {
	Icon,
	chevronDown,
	chevronUp,
	close,
	code,
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
	isEditorDockSection,
	modalSlugs,
	setActiveModal,
	setSiteManagerOpen,
	setSiteManagerSection,
	setSiteSlugToRename,
} from '../../lib/state/redux/slice-ui';
import {
	getActiveClientInfo,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
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

const VIEWPORT_EDGE = 8;
const PANE_GAP = 12;

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
	const paneRef = useRef<HTMLElement>(null);
	const dockRef = useRef<HTMLDivElement>(null);
	const toolsRef = useRef<HTMLDivElement>(null);
	// Natural width of the tools row, cached while it's visible so we can still
	// tell one-row from two-row after the tools are collapsed (and removed from
	// layout). Prev-two-row tracks the last layout so we only auto-collapse on
	// the transition into two-row — the manual toggle wins between transitions.
	const toolsWidthRef = useRef(0);
	const prevTwoRowRef = useRef(false);
	const normalizedSection = normalizeSection(activeSection);
	const paneCopy = PANE_COPY[normalizedSection];
	const isEditorSection = isEditorDockSection(normalizedSection);
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
	// Collapsed dock hides the tools row, leaving just the address + status.
	const [isCollapsed, setIsCollapsed] = useState(false);
	// True once the tools no longer fit beside the address area and wrap onto a
	// second line. Drives the compact-vs-tall address input: only when the tools
	// sit inline on one row do we grow the input to match their height.
	const [isTwoRow, setIsTwoRow] = useState(false);
	// Distance from the viewport's right edge to the active dock button's right
	// edge. Popups anchor their right edge here and grow leftward. `null` until
	// measured (or when the active button can't be found, e.g. collapsed tools).
	const [activeItemRightOffset, setActiveItemRightOffset] = useState<
		number | null
	>(null);

	// Track the dock height so the pane can be anchored just above it.
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

	// The dock wraps the tools onto a second line once the address area can't
	// keep its 360px basis alongside them (see the flex-wrap rule in CSS). When
	// that happens the bar is cramped, so we auto-collapse the tools by default —
	// but only on the transition into two-row, leaving the manual toggle free to
	// re-expand. We measure from widths (not the wrapped geometry) so the check
	// still holds once the tools are collapsed out of layout.
	useLayoutEffect(() => {
		const dock = dockRef.current;
		if (!dock || typeof ResizeObserver === 'undefined') {
			return;
		}
		const TOP_ROW_BASIS = 360;
		const measure = () => {
			const tools = toolsRef.current;
			// offsetParent is null when the tools are display:none (collapsed);
			// only refresh the cached width while they're actually laid out.
			if (tools && tools.offsetParent !== null) {
				toolsWidthRef.current = tools.offsetWidth;
			}
			if (!toolsWidthRef.current) {
				return;
			}
			const styles = getComputedStyle(dock);
			const paddingX =
				parseFloat(styles.paddingLeft) +
				parseFloat(styles.paddingRight);
			const columnGap = parseFloat(styles.columnGap) || 0;
			const available = dock.clientWidth - paddingX;
			const twoRow =
				available < TOP_ROW_BASIS + columnGap + toolsWidthRef.current;
			setIsTwoRow(twoRow);
			if (twoRow !== prevTwoRowRef.current) {
				prevTwoRowRef.current = twoRow;
				setIsCollapsed(twoRow);
			}
		};
		const observer = new ResizeObserver(measure);
		observer.observe(dock);
		measure();
		return () => observer.disconnect();
	}, []);

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

	// Measure the active dock button's right edge so popups can right-align to
	// it. Re-runs whenever the active section, dock open/collapsed state, or dock
	// size (which fires on window-width changes) changes the button's position.
	useLayoutEffect(() => {
		if (!siteManagerIsOpen || isEditorSection) {
			return;
		}
		const button = dockRef.current?.querySelector<HTMLElement>(
			'[data-active-dock-item]'
		);
		if (!button) {
			// Tools row collapsed or button not found — fall back gracefully.
			setActiveItemRightOffset(null);
			return;
		}
		const rect = button.getBoundingClientRect();
		setActiveItemRightOffset(window.innerWidth - rect.right);
	}, [
		siteManagerIsOpen,
		isEditorSection,
		normalizedSection,
		isCollapsed,
		dockSize,
	]);

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

	// The dock is a full-width bar pinned to the bottom edge, so the pane always
	// opens above it, horizontally centered and clamped to the viewport. We anchor
	// to the dock's measured height so the pane clears the two-row bar (address +
	// tools) — a taller dock would otherwise overlap a fixed-offset pane.
	let paneStyle: React.CSSProperties | undefined;
	if (dockSize.height) {
		const dockTop = window.innerHeight - dockSize.height;
		if (isEditorSection) {
			// Editor panes dock to the left as a full-height sidebar; the live
			// site stays visible (and interactive) to their right. Their left
			// and top edges and width come from CSS so the < 640px full-width
			// rule can win — only the dock-anchored bottom is dynamic.
			paneStyle = {
				bottom: `${window.innerHeight - dockTop + PANE_GAP}px`,
			};
		} else {
			const available = Math.max(160, dockTop - PANE_GAP - VIEWPORT_EDGE);
			// Fixed-height panes get a stable height (capped) so they don't
			// resize between tabs; everything else stays content-sized via
			// max-height.
			const fixedHeight = isFixedHeightSection
				? Math.min(620, available)
				: undefined;
			// Right-align the popup to the button that opened it; it grows
			// leftward. Clamp so it never overflows the left edge: the pane's
			// rendered width caps how far right `right` may sit (right edge -
			// width >= VIEWPORT_EDGE), and `right` itself stays >= VIEWPORT_EDGE.
			// Fall back to a viewport-clamped right when the button isn't
			// measurable (e.g. the tools row is collapsed).
			const paneWidth = paneRef.current?.offsetWidth ?? 0;
			const maxRight = paneWidth
				? Math.max(
						VIEWPORT_EDGE,
						window.innerWidth - paneWidth - VIEWPORT_EDGE
					)
				: window.innerWidth - VIEWPORT_EDGE;
			const rawRight = activeItemRightOffset ?? VIEWPORT_EDGE;
			const clampedRight = Math.min(
				Math.max(VIEWPORT_EDGE, rawRight),
				maxRight
			);
			paneStyle = {
				right: `${clampedRight}px`,
				left: 'auto',
				maxHeight: `${available}px`,
				...(fixedHeight ? { height: `${fixedHeight}px` } : {}),
				bottom: `${window.innerHeight - dockTop + PANE_GAP}px`,
				top: 'auto',
			};
		}
	}

	return (
		<>
			<CSSTransition
				nodeRef={paneRef}
				in={siteManagerIsOpen}
				timeout={240}
				classNames={
					isEditorSection
						? {
								enter: css.editorEnter,
								enterActive: css.editorEnterActive,
								exit: css.editorExit,
								exitActive: css.editorExitActive,
							}
						: {
								enter: css.paneEnter,
								enterActive: css.paneEnterActive,
								exit: css.paneExit,
								exitActive: css.paneExitActive,
							}
				}
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
					{isEditorSection && (
						<div className={css.paneEditorBar}>
							<h2 className={css.paneEditorTitle}>
								{paneCopy.title}
							</h2>
							<button
								type="button"
								className={css.paneClose}
								aria-label={`Close ${paneCopy.title}`}
								title="Close"
								onClick={() =>
									dispatch(setSiteManagerOpen(false))
								}
							>
								<Icon icon={close} size={24} />
							</button>
						</div>
					)}
					{!isEditorSection && (
						<div className={css.paneHeader}>
							<div className={css.paneHeaderMain}>
								<h2>{paneCopy.title}</h2>
								{showPlaygroundShortcuts ? (
									<div className={css.settingsIdentity}>
										<span className={css.settingsName}>
											{playgroundTitle}
										</span>
										{canManageActiveSite && (
											<button
												type="button"
												className={css.settingsRename}
												aria-label="Rename Playground"
												title="Rename"
												onClick={openRenameModal}
											>
												<Icon icon={pencil} size={16} />
											</button>
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
										dispatch(setSiteManagerSection('new'))
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
					// Tools inline on one row → grow the address input to match
					// their height. Collapsed or wrapped → keep it compact.
					[css.dockInline]: !isCollapsed && !isTwoRow,
				})}
				aria-label="Playground tools"
			>
				<div className={css.dockTopRow}>
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
					ref={toolsRef}
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
									data-active-dock-item={
										isActive ? '' : undefined
									}
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
