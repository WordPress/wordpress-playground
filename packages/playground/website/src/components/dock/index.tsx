import classNames from 'classnames';
import { useEffect, useRef } from 'react';
import { CSSTransition } from 'react-transition-group';
import {
	isAutosavedSite,
	type SiteInfo,
} from '../../lib/state/redux/slice-sites';
import type { SiteManagerSection } from '../../lib/state/redux/slice-ui';
import {
	setSiteManagerOpen,
	setSiteManagerSection,
} from '../../lib/state/redux/slice-ui';
import {
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { SiteManager } from '../site-manager';
import css from './style.module.css';

type DockSection = Exclude<
	SiteManagerSection,
	'sidebar' | 'site-details' | 'blueprints'
>;

type DockItem = {
	section: DockSection;
	label: string;
	ariaLabel: string;
	icon: string;
	isPrimary?: boolean;
};

const DOCK_ITEMS: DockItem[] = [
	{
		section: 'new',
		label: 'New',
		ariaLabel: 'New Playground',
		icon: '+',
		isPrimary: true,
	},
	{
		section: 'playgrounds',
		label: 'Playgrounds',
		ariaLabel: 'Your Playgrounds',
		icon: '▦',
	},
	{
		section: 'blueprint',
		label: 'Blueprint',
		ariaLabel: 'Current Blueprint',
		icon: '{}',
	},
	{
		section: 'settings',
		label: 'Settings',
		ariaLabel: 'Open Site Manager',
		icon: '⚙',
	},
	{
		section: 'database',
		label: 'Database',
		ariaLabel: 'Database',
		icon: 'DB',
	},
	{
		section: 'files',
		label: 'Files',
		ariaLabel: 'Files',
		icon: '⌁',
	},
	{
		section: 'logs',
		label: 'Logs',
		ariaLabel: 'Logs',
		icon: '≡',
	},
	{
		section: 'share',
		label: 'Share',
		ariaLabel: 'Share and export',
		icon: '↗',
	},
];

const PANE_COPY: Record<DockSection, { title: string; description: string }> = {
	new: {
		title: 'New Playground',
		description:
			'Start from WordPress, a Blueprint, a pull request, GitHub, or a .zip export.',
	},
	playgrounds: {
		title: 'Your Playgrounds',
		description:
			'Open recent and saved Playgrounds, with the current Playground summarized first.',
	},
	blueprint: {
		title: 'Current Blueprint',
		description:
			'Review and edit the Blueprint that describes this Playground.',
	},
	settings: {
		title: 'Settings',
		description:
			'Change the runtime, storage, and WordPress configuration.',
	},
	database: {
		title: 'Database',
		description: 'Open database tools or download the SQLite database.',
	},
	files: {
		title: 'Files',
		description: 'Browse and edit the active Playground filesystem.',
	},
	logs: {
		title: 'Logs',
		description: 'Inspect PHP, WordPress, and Playground runtime logs.',
	},
	share: {
		title: 'Share and export',
		description:
			'Send changes to GitHub or download a self-contained archive.',
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
	const paneRef = useRef<HTMLElement>(null);
	const normalizedSection = normalizeSection(activeSection);
	const paneCopy = PANE_COPY[normalizedSection];
	const playgroundTitle =
		activeSite?.metadata.storage === 'none'
			? 'Unsaved Playground'
			: activeSite?.metadata.name;

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || activeModal || !siteManagerIsOpen) {
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
					className={classNames(css.pane, css.overlayCompat)}
					aria-label={`${paneCopy.title} pane`}
				>
					<div className={css.paneHeader}>
						<p className={css.eyebrow}>WordPress Playground</p>
						<h2>{paneCopy.title}</h2>
						{activeSite &&
							playgroundTitle &&
							normalizedSection !== 'new' && (
								<p className={css.currentPlayground}>
									Current:{' '}
									<span aria-label="Playground title">
										{playgroundTitle}
									</span>
									<span
										className={css.currentPlaygroundStorage}
									>
										{' '}
										·{' '}
										{getCurrentPlaygroundStorageLabel(
											activeSite
										)}
									</span>
								</p>
							)}
						<p>{paneCopy.description}</p>
					</div>
					<div className={css.paneBody}>
						<SiteManager />
					</div>
				</section>
			</CSSTransition>
			<nav className={css.dock} aria-label="Playground tools">
				{DOCK_ITEMS.map((item, index) => {
					const isActive =
						siteManagerIsOpen && normalizedSection === item.section;
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

function getCurrentPlaygroundStorageLabel(site: SiteInfo) {
	if (site.metadata.storage === 'none') {
		return 'Unsaved';
	}
	if (isAutosavedSite(site)) {
		return 'Autosaved in this browser';
	}
	if (site.metadata.storage === 'local-fs') {
		return 'Saved in a local directory';
	}
	return 'Saved in this browser';
}

function getDockItemAriaLabel(item: DockItem, isActive: boolean) {
	if (item.section === 'settings') {
		return isActive ? 'Close Site Manager' : 'Open Site Manager';
	}
	return item.ariaLabel;
}
