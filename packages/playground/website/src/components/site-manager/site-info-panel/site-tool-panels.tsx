import classNames from 'classnames';
import { lazy, Suspense, useEffect, useState } from 'react';
import type { PlaygroundClient } from '@wp-playground/client';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { setDockPaneOpen } from '../../../lib/state/redux/slice-ui';
import { useAppDispatch, useAppSelector } from '../../../lib/state/redux/store';
import { SiteLogs } from '../../log-modal';
import { OfflineNotice } from '../../offline-notice';
import { PaneLoading } from '../../pane-loading';
import { useDockPaneEditorHeaderSlot } from '../../dock/dock-pane';
import { SiteDatabasePanel } from '../site-database-panel';
import { SiteMailPanel } from '../site-mail-panel';
import { ActiveSiteSettingsForm } from '../site-settings-form/active-site-settings-form';
import css from './style.module.css';

const SiteFileBrowser = lazy(() =>
	import('../site-file-browser').then((m) => ({ default: m.SiteFileBrowser }))
);

const SiteBlueprintBundleEditor = lazy(() =>
	import('../../blueprint-editor/SiteBlueprintBundleEditor').then((m) => ({
		default: m.SiteBlueprintBundleEditor,
	}))
);

const SiteTerminalPanel = lazy(() =>
	import('../site-terminal-panel').then((m) => ({
		default: m.SiteTerminalPanel,
	}))
);

export type SiteInfoTabName =
	| 'settings'
	| 'files'
	| 'blueprint'
	| 'database'
	| 'terminal'
	| 'logs'
	| 'mail';

/** Renders the tool surfaces selected by the site information tabs. */
export function SiteToolPanels({
	site,
	playground,
	activeTabName,
	mobileUi = false,
}: {
	site: SiteInfo;
	playground: PlaygroundClient | undefined;
	activeTabName: SiteInfoTabName | null;
	mobileUi?: boolean;
}) {
	const offline = useAppSelector((state) => state.ui.offline);
	const dispatch = useAppDispatch();
	const [mountedTabNames, setMountedTabNames] = useState<SiteInfoTabName[]>(
		() => (activeTabName ? [activeTabName] : [])
	);
	const [documentRoot, setDocumentRoot] = useState<string | null>(null);
	const editorHeaderSlot = useDockPaneEditorHeaderSlot();
	const activeMobileHeaderSlot = mobileUi ? editorHeaderSlot : null;
	const settingsMounted =
		activeTabName === 'settings' || mountedTabNames.includes('settings');
	const filesMounted =
		activeTabName === 'files' || mountedTabNames.includes('files');
	const blueprintMounted =
		activeTabName === 'blueprint' || mountedTabNames.includes('blueprint');
	const databaseMounted =
		activeTabName === 'database' || mountedTabNames.includes('database');
	const terminalMounted =
		activeTabName === 'terminal' || mountedTabNames.includes('terminal');
	const logsMounted =
		activeTabName === 'logs' || mountedTabNames.includes('logs');
	const mailMounted =
		activeTabName === 'mail' || mountedTabNames.includes('mail');

	// Mount each tool lazily, then retain its draft, selection, scroll position,
	// and subscriptions while another Dock destination is visible.
	useEffect(() => {
		if (!activeTabName) {
			return;
		}
		setMountedTabNames((tabNames) =>
			tabNames.includes(activeTabName)
				? tabNames
				: [...tabNames, activeTabName]
		);
	}, [activeTabName]);

	// Resolve documentRoot from playground client.
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
			{settingsMounted && (
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

					<ActiveSiteSettingsForm
						onSubmit={() => dispatch(setDockPaneOpen(false))}
					/>
				</div>
			)}
			{filesMounted && (
				<div
					className={classNames(css.tabContents, css.fileBrowserTab, {
						[css.tabHidden]: activeTabName !== 'files',
					})}
					hidden={activeTabName !== 'files'}
				>
					<Suspense
						fallback={
							<PaneLoading message="Loading the file browser…" />
						}
					>
						{documentRoot ? (
							<SiteFileBrowser
								key={site.slug}
								site={site}
								isVisible={activeTabName === 'files'}
								documentRoot={documentRoot}
								mobileHeaderTarget={
									activeTabName === 'files'
										? activeMobileHeaderSlot
										: null
								}
							/>
						) : (
							// The file browser needs the booted WordPress runtime;
							// show a clear loading state instead of a blank pane.
							<PaneLoading message="Playground files are still loading…" />
						)}
					</Suspense>
				</div>
			)}
			{blueprintMounted && (
				<div
					className={classNames(css.blueprintWrapper, {
						[css.tabHidden]: activeTabName !== 'blueprint',
					})}
					hidden={activeTabName !== 'blueprint'}
				>
					<Suspense
						fallback={
							<PaneLoading message="Loading the Blueprint editor…" />
						}
					>
						<SiteBlueprintBundleEditor
							key={site.slug}
							site={site}
							className={classNames(css.blueprintEditor)}
							dockPresentation
							mobileHeaderTarget={
								activeTabName === 'blueprint'
									? activeMobileHeaderSlot
									: null
							}
						/>
					</Suspense>
				</div>
			)}
			{databaseMounted && (
				<div
					className={classNames(
						css.tabContents,
						css.toolTabContents,
						{
							[css.tabHidden]: activeTabName !== 'database',
						}
					)}
					hidden={activeTabName !== 'database'}
				>
					<SiteDatabasePanel playground={playground} />
				</div>
			)}
			{terminalMounted && (
				<div
					className={classNames(
						css.tabContents,
						css.toolTabContents,
						{
							[css.tabHidden]: activeTabName !== 'terminal',
						}
					)}
					hidden={activeTabName !== 'terminal'}
				>
					<Suspense
						fallback={<PaneLoading message="Loading Terminal…" />}
					>
						<SiteTerminalPanel playground={playground} />
					</Suspense>
				</div>
			)}
			{logsMounted && (
				<div
					className={classNames(
						css.tabContents,
						css.toolTabContents,
						{
							[css.tabHidden]: activeTabName !== 'logs',
						}
					)}
					hidden={activeTabName !== 'logs'}
				>
					<div className={classNames(css.logsWrapper)}>
						<SiteLogs className={css.logsSection} />
					</div>
				</div>
			)}
			{mailMounted && (
				<div
					className={classNames(css.tabContents, css.mailTab, {
						[css.tabHidden]: activeTabName !== 'mail',
					})}
					hidden={activeTabName !== 'mail'}
				>
					<SiteMailPanel />
				</div>
			)}
		</>
	);
}
