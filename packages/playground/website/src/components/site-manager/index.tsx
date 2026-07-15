import classNames from 'classnames';
import { forwardRef, useCallback, useEffect, useState } from 'react';
import { setSiteManagerOpen } from '../../lib/state/redux/slice-ui';
import {
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import type { DockPaneHeaderOverride } from '../dock/dock-pane';
import { SavedPlaygroundsPanel } from '../saved-playgrounds-panel';
import { SaveSiteModal } from '../save-site-modal';
import { SiteInfoPanel, type SiteInfoTabName } from './site-info-panel';
import { SiteSharePanel } from './site-share-panel';
import css from './style.module.css';

export type SiteManagerProps = {
	className?: string;
	isOpen: boolean;
	mobileUi: boolean;
	onPaneCloseBlockedChange: (isBlocked: boolean) => void;
	onNewPlaygroundHeaderChange: (
		header: DockPaneHeaderOverride | undefined
	) => void;
};

/** Routes the active Dock destination to the existing website tool surface. */
export const SiteManager = forwardRef<HTMLDivElement, SiteManagerProps>(
	function SiteManager(
		{
			className,
			isOpen,
			mobileUi,
			onPaneCloseBlockedChange,
			onNewPlaygroundHeaderChange,
		},
		ref
	) {
		const dispatch = useAppDispatch();
		const activeSite = useActiveSite();
		const activeSection = useAppSelector(
			(state) => state.ui.siteManagerSection
		);
		const selectedSiteTab: SiteInfoTabName | null =
			activeSection === 'settings' ||
			activeSection === 'files' ||
			activeSection === 'blueprint' ||
			activeSection === 'database' ||
			activeSection === 'logs'
				? activeSection
				: null;
		const activeSiteTab = isOpen ? selectedSiteTab : null;
		const [mountedSiteSlug, setMountedSiteSlug] = useState<string | null>(
			null
		);
		const [savedPlaygroundsPanelMounted, setSavedPlaygroundsPanelMounted] =
			useState(false);
		const [lastSavedPlaygroundsPanel, setLastSavedPlaygroundsPanel] =
			useState<'new' | 'playgrounds'>('playgrounds');
		const [sharePanelMounted, setSharePanelMounted] = useState(false);
		const closeSavePane = useCallback(
			() => dispatch(setSiteManagerOpen(false)),
			[dispatch]
		);

		// Do not mount the site tools until they are opened. Once opened, keep
		// them alive for that site so closing or changing panes cannot erase a
		// settings draft or editor state.
		useEffect(() => {
			if (activeSite?.slug && activeSiteTab) {
				setMountedSiteSlug(activeSite.slug);
			}
		}, [activeSite?.slug, activeSiteTab]);

		useEffect(() => {
			if (activeSection === 'new' || activeSection === 'playgrounds') {
				setSavedPlaygroundsPanelMounted(true);
				setLastSavedPlaygroundsPanel(activeSection);
			} else if (activeSection === 'share') {
				setSharePanelMounted(true);
			}
		}, [activeSection]);

		let activePanel: JSX.Element | null = null;
		if (activeSection === 'save') {
			activePanel =
				isOpen && activeSite ? (
					<SaveSiteModal
						asPane
						onClose={closeSavePane}
						onCloseBlockedChange={onPaneCloseBlockedChange}
					/>
				) : null;
		} else if (selectedSiteTab && !activeSite && isOpen) {
			activePanel = (
				<div className={css.emptyPanel}>
					Start or select a Playground before opening this tool.
				</div>
			);
		}

		return (
			<div className={classNames(css.siteManager, className)} ref={ref}>
				{activePanel}
				{savedPlaygroundsPanelMounted && (
					<div
						className={css.savedPlaygroundsPanel}
						hidden={
							!isOpen ||
							(activeSection !== 'new' &&
								activeSection !== 'playgrounds')
						}
					>
						<SavedPlaygroundsPanel
							panel={
								activeSection === 'new' ||
								activeSection === 'playgrounds'
									? activeSection
									: lastSavedPlaygroundsPanel
							}
							onClose={() => dispatch(setSiteManagerOpen(false))}
							onCloseBlockedChange={onPaneCloseBlockedChange}
							onPaneHeaderChange={onNewPlaygroundHeaderChange}
						/>
					</div>
				)}
				{sharePanelMounted && (
					<div
						className={css.sharePanel}
						hidden={!isOpen || activeSection !== 'share'}
					>
						<SiteSharePanel key={activeSite?.slug ?? 'no-site'} />
					</div>
				)}
				{activeSite &&
					(activeSiteTab || mountedSiteSlug === activeSite.slug) && (
						<SiteInfoPanel
							key={activeSite.slug}
							className={css.siteManagerSiteInfo}
							site={activeSite}
							activeTabName={activeSiteTab}
							mobileUi={mobileUi}
						/>
					)}
			</div>
		);
	}
);
