import { lazy, Suspense, useEffect, useState } from 'react';
import { Notice } from '@wordpress/components';
import type { PlaygroundClient } from '@wp-playground/client';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { setDockPaneOpen } from '../../../lib/state/redux/slice-ui';
import { useAppDispatch, useAppSelector } from '../../../lib/state/redux/store';
import { SiteLogs } from '../../log-modal';
import { OfflineNotice } from '../../offline-notice';
import { PaneLoading } from '../../pane-loading';
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

export type SiteToolPanelProps = {
	site: SiteInfo;
	playground: PlaygroundClient | undefined;
	isVisible: boolean;
	mobileHeaderTarget: HTMLElement | null;
};

export function SettingsTool(): JSX.Element {
	const offline = useAppSelector((state) => state.ui.offline);
	const dispatch = useAppDispatch();
	return (
		<>
			{offline && (
				<div className={css.padded}>
					<OfflineNotice />
				</div>
			)}
			<ActiveSiteSettingsForm
				onSubmit={() => dispatch(setDockPaneOpen(false))}
			/>
		</>
	);
}

/** Retains the file browser after loading and lets failed root lookups be retried. */
export function FilesTool({
	site,
	playground,
	isVisible,
	mobileHeaderTarget,
}: SiteToolPanelProps): JSX.Element {
	const [documentRoot, setDocumentRoot] = useState<string | Error | null>(
		null
	);
	const [loadAttempt, setLoadAttempt] = useState(0);
	useEffect(() => {
		let cancelled = false;
		setDocumentRoot(null);
		void playground?.documentRoot.then(
			(root) => {
				if (!cancelled) setDocumentRoot(root);
			},
			() => {
				if (!cancelled) {
					setDocumentRoot(
						new Error('Could not load Playground files.')
					);
				}
			}
		);
		return () => {
			cancelled = true;
		};
	}, [playground, loadAttempt]);
	if (documentRoot instanceof Error) {
		return (
			<div className={css.padded}>
				<Notice
					status="error"
					isDismissible={false}
					actions={[
						{
							label: 'Retry',
							onClick: () =>
								setLoadAttempt((attempt) => attempt + 1),
						},
					]}
				>
					{documentRoot.message}
				</Notice>
			</div>
		);
	}
	return (
		<Suspense
			fallback={<PaneLoading message="Loading the file browser…" />}
		>
			{documentRoot ? (
				<SiteFileBrowser
					key={site.slug}
					site={site}
					isVisible={isVisible}
					documentRoot={documentRoot}
					mobileHeaderTarget={mobileHeaderTarget}
				/>
			) : (
				<PaneLoading message="Playground files are still loading…" />
			)}
		</Suspense>
	);
}

export function BlueprintTool({
	site,
	mobileHeaderTarget,
}: SiteToolPanelProps): JSX.Element {
	return (
		<Suspense
			fallback={<PaneLoading message="Loading the Blueprint editor…" />}
		>
			<SiteBlueprintBundleEditor
				key={site.slug}
				site={site}
				className={css.blueprintEditor}
				dockPresentation
				mobileHeaderTarget={mobileHeaderTarget}
			/>
		</Suspense>
	);
}

export function DatabaseTool({ playground }: SiteToolPanelProps): JSX.Element {
	return <SiteDatabasePanel playground={playground} />;
}

export function TerminalTool({ playground }: SiteToolPanelProps): JSX.Element {
	return (
		<Suspense fallback={<PaneLoading message="Loading Terminal…" />}>
			<SiteTerminalPanel playground={playground} />
		</Suspense>
	);
}

export function LogsTool(): JSX.Element {
	return (
		<div className={css.logsWrapper}>
			<SiteLogs className={css.logsSection} />
		</div>
	);
}

export function MailTool(): JSX.Element {
	return <SiteMailPanel />;
}
