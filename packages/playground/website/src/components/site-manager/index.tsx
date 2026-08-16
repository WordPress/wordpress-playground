import classNames from 'classnames';
import { forwardRef, useCallback, useEffect, useState } from 'react';
import { setDockPaneOpen } from '../../lib/state/redux/slice-ui';
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
	isVisible: boolean;
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
			isVisible,
			mobileUi,
			onPaneCloseBlockedChange,
			onNewPlaygroundHeaderChange,
		},
		ref
	) {
		const dispatch = useAppDispatch();
		const activeSite = useActiveSite();
		const activeSection = useAppSelector(
			(state) => state.ui.dockPaneSection
		);
		const selectedSiteTab: SiteInfoTabName | null =
			activeSection === 'settings' ||
			activeSection === 'files' ||
			activeSection === 'blueprint' ||
			activeSection === 'database' ||
			activeSection === 'logs' ||
			activeSection === 'mail'
				? activeSection
				: null;
		const activeSiteTab = isVisible ? selectedSiteTab : null;
		const [mountedSiteSlug, setMountedSiteSlug] = useState<string | null>(
			null
		);
		const [savedPlaygroundsPanelMounted, setSavedPlaygroundsPanelMounted] =
			useState(false);
		const [lastSavedPlaygroundsPanel, setLastSavedPlaygroundsPanel] =
			useState<'new' | 'playgrounds'>('playgrounds');
		const [sharePanelMounted, setSharePanelMounted] = useState(false);
		const closeDockPane = useCallback(
			() => dispatch(setDockPaneOpen(false)),
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
				isVisible && activeSite ? (
					<SaveSiteModal
						asPane
						onClose={closeDockPane}
						onCloseBlockedChange={onPaneCloseBlockedChange}
					/>
				) : null;
		} else if (selectedSiteTab && !activeSite && isVisible) {
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
							!isVisible ||
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
							onClose={closeDockPane}
							onPaneHeaderChange={onNewPlaygroundHeaderChange}
						/>
					</div>
				)}
				{sharePanelMounted && (
					<div
						className={css.sharePanel}
						hidden={!isVisible || activeSection !== 'share'}
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
