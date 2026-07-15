import classNames from 'classnames';
import { lazy, Suspense, useEffect, useState } from 'react';
import type { PlaygroundClient } from '@wp-playground/client';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { isExplicitlySavedSite } from '../../../lib/state/redux/slice-sites';
import { useAppSelector } from '../../../lib/state/redux/store';
import { SiteLogs } from '../../log-modal';
import { OfflineNotice } from '../../offline-notice';
import { SiteDatabasePanel } from '../site-database-panel';
import { ActiveSiteSettingsForm } from '../site-settings-form/active-site-settings-form';
import { TemporarySiteNotice } from '../temporary-site-notice';
import css from './style.module.css';

const SiteFileBrowser = lazy(() =>
	import('../site-file-browser').then((m) => ({ default: m.SiteFileBrowser }))
);

const SiteBlueprintBundleEditor = lazy(() =>
	import('../../blueprint-editor/SiteBlueprintBundleEditor').then((m) => ({
		default: m.SiteBlueprintBundleEditor,
	}))
);

export type SiteInfoTabName =
	| 'settings'
	| 'files'
	| 'blueprint'
	| 'database'
	| 'logs';

/** Renders the tool surfaces selected by the site information tabs. */
export function SiteToolPanels({
	site,
	playground,
	activeTabName,
}: {
	site: SiteInfo;
	playground: PlaygroundClient | undefined;
	activeTabName: SiteInfoTabName;
}) {
	const offline = useAppSelector((state) => state.ui.offline);
	const [documentRoot, setDocumentRoot] = useState<string | null>(null);
	const isTemporary = site.metadata.storage === 'none';
	const isBlueprintReadOnly = isExplicitlySavedSite(site);

	// Resolve documentRoot from playground client
	useEffect(() => {
		if (!playground) {
			setDocumentRoot(null);
			return;
		}

		void playground.documentRoot.then((root) => {
			setDocumentRoot(root);
		});
	}, [playground]);

	return (
		<>
			<div
				className={classNames(css.tabContents, {
					[css.tabHidden]: activeTabName !== 'settings',
				})}
				hidden={activeTabName !== 'settings'}
			>
				{offline ? (
					<div className={css.padded}>
						<OfflineNotice />
					</div>
				) : null}

				{isTemporary ? (
					<div data-testid="temporary-site-notice">
						<TemporarySiteNotice className={css.siteNotice} />
					</div>
				) : null}

				<ActiveSiteSettingsForm />
			</div>
			<div
				className={classNames(css.tabContents, css.fileBrowserTab, {
					[css.tabHidden]: activeTabName !== 'files',
				})}
				hidden={activeTabName !== 'files'}
			>
				<Suspense
					fallback={
						<div className={css.padded}>
							Loading file browser...
						</div>
					}
				>
					{documentRoot && (
						<SiteFileBrowser
							key={site.slug}
							site={site}
							isVisible={activeTabName === 'files'}
							documentRoot={documentRoot}
						/>
					)}
				</Suspense>
			</div>
			<div
				className={classNames(css.blueprintWrapper, {
					[css.tabHidden]: activeTabName !== 'blueprint',
				})}
				hidden={activeTabName !== 'blueprint'}
			>
				{isBlueprintReadOnly && (
					<div className={css.blueprintNotice}>
						This Blueprint is read-only for saved Playgrounds.
						Create an Unsaved Playground to edit and test Blueprint
						changes.
					</div>
				)}
				<Suspense fallback={<div>Loading Blueprint editor...</div>}>
					<SiteBlueprintBundleEditor
						key={site.slug}
						site={site}
						className={classNames(css.blueprintEditor)}
					/>
				</Suspense>
			</div>
			<div
				className={classNames(css.tabContents, css.padded, {
					[css.tabHidden]: activeTabName !== 'database',
				})}
				hidden={activeTabName !== 'database'}
			>
				<SiteDatabasePanel playground={playground} />
			</div>
			<div
				className={classNames(css.tabContents, css.padded, {
					[css.tabHidden]: activeTabName !== 'logs',
				})}
				hidden={activeTabName !== 'logs'}
			>
				<div className={classNames(css.logsWrapper)}>
					<SiteLogs className={css.logsSection} />
				</div>
			</div>
		</>
	);
}
