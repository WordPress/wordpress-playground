import { Button, Flex, FlexItem, Icon, TabPanel } from '@wordpress/components';
import { chevronLeft, close, trash, external, upload } from '@wordpress/icons';
import classNames from 'classnames';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { importWordPressFiles } from '@wp-playground/client';
import type { PlaygroundClient } from '@wp-playground/client';
import { selectClientInfoBySiteSlug } from '../../../lib/state/redux/slice-clients';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { updateSiteMetadata } from '../../../lib/state/redux/slice-sites';
import type { SiteMetadata } from '../../../lib/state/redux/slice-sites';
import { setSiteManagerOpen } from '../../../lib/state/redux/slice-ui';
import {
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../../lib/state/redux/store';
import {
	usePlaygroundClient,
	usePlaygroundClientInfo,
} from '../../../lib/use-playground-client';
import { SiteLogs } from '../../log-modal';
import { SiteDatabasePanel } from '../site-database-panel';
import { useBackup } from '../../../lib/hooks/use-backup';
import { WordPressIcon } from '@wp-playground/components';
import { getHealthCheckRecoveryUrl } from '../../../lib/health-check-recovery';
import { getRelativeDate } from '../../../lib/utils/get-relative-date';
import { opfsSiteStorage } from '../../../lib/state/opfs/opfs-site-storage';
import {
	broadcastSiteReset,
	requestBlueprintInstall,
} from '../../../lib/state/redux/tab-coordinator';
import { logger } from '@php-wasm/logger';
import {
	APP_LAUNCHER_BLUEPRINT,
	APP_LAUNCHER_BLUEPRINT_URL,
} from '../../../lib/personalwp/my-apps';
import {
	getRemoteAccessStatus,
	approveRemoteAccess,
	startRemoteAccess,
	stopRemoteAccess,
	subscribeToRemoteAccessStatus,
} from '../../../lib/remote-access-service';
import { normalizeVerificationCode } from '@wp-playground/remote-access';
import { logPersonalWpEvent } from '../../../lib/personalwp/usage-stats';
import css from './style.module.css';

const SiteFileBrowser = lazy(() =>
	import('../site-file-browser').then((m) => ({ default: m.SiteFileBrowser }))
);

const LAST_TAB_STORAGE_KEY = 'playground-site-last-tabs';

function getSiteLastTab(siteSlug: string): string | null {
	try {
		const stored = localStorage.getItem(LAST_TAB_STORAGE_KEY);
		if (!stored) {
			return null;
		}
		const tabs = JSON.parse(stored);
		return tabs[siteSlug] || null;
	} catch {
		return null;
	}
}

function setSiteLastTab(siteSlug: string, tabName: string): void {
	try {
		const stored = localStorage.getItem(LAST_TAB_STORAGE_KEY);
		const tabs = stored ? JSON.parse(stored) : {};
		tabs[siteSlug] = tabName;
		localStorage.setItem(LAST_TAB_STORAGE_KEY, JSON.stringify(tabs));
	} catch {
		// Silently fail if localStorage is not available
	}
}

// -- Install Apps ------------------------------------------------------------

function InstallAppsSection({ siteSlug }: { siteSlug: string }) {
	const installMessage = useAppSelector(
		(state) => state.ui.blueprintInstallMessage
	);

	async function installAppLauncher() {
		if (installMessage) {
			return;
		}
		const result = await requestBlueprintInstall(
			siteSlug,
			APP_LAUNCHER_BLUEPRINT_URL
		);
		if (result.status === 'error') {
			logger.error('Failed to install App Launcher:', result.error);
		}
	}

	return (
		<div className={css.aboutSection}>
			<h4 className={css.aboutSectionTitle}>
				Installing apps has moved here:
			</h4>
			<div className={css.appsList}>
				<div className={css.appRow}>
					<button
						type="button"
						className={css.appLink}
						onClick={installAppLauncher}
						disabled={!!installMessage}
					>
						<span className={css.appIcon}>
							<WordPressIcon />
						</span>
						<span className={css.appContent}>
							<span className={css.appTitle}>
								{APP_LAUNCHER_BLUEPRINT.meta.title}
							</span>
							<span className={css.appDescription}>
								{APP_LAUNCHER_BLUEPRINT.meta.description}
							</span>
						</span>
					</button>
				</div>
				{installMessage && (
					<div className={css.appInstallStatus} role="status">
						{installMessage}
					</div>
				)}
			</div>
		</div>
	);
}

function RemoteAccessSection() {
	const playground = usePlaygroundClient();
	const [remoteAccess, setRemoteAccess] = useState(getRemoteAccessStatus);
	const [message, setMessage] = useState<string | null>(null);
	const [verificationCode, setVerificationCode] = useState('');

	useEffect(() => subscribeToRemoteAccessStatus(setRemoteAccess), []);

	async function startAccess() {
		if (!playground) {
			return;
		}
		setMessage(null);
		try {
			const shareUrl = await startRemoteAccess(playground);
			logPersonalWpEvent('remote_access_started');
			setMessage(
				(await copyUrl(shareUrl))
					? 'Remote access link copied.'
					: 'Remote access link ready.'
			);
		} catch (error) {
			logger.error('Failed to start remote access:', error);
			setMessage(
				`Could not start remote access: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	async function stopAccess() {
		setMessage(null);
		await stopRemoteAccess();
	}

	function approveAccess(event?: FormEvent) {
		event?.preventDefault();
		if (approveRemoteAccess(verificationCode)) {
			setVerificationCode('');
			setMessage(null);
			return;
		}
		setMessage('Enter the code shown on the remote device.');
	}

	async function copyCurrentUrl() {
		if (!remoteAccess.shareUrl) {
			return;
		}
		setMessage(
			(await copyUrl(remoteAccess.shareUrl))
				? 'Remote access link copied.'
				: 'Copy is not available.'
		);
	}

	async function shareCurrentUrl() {
		if (!remoteAccess.shareUrl || !navigator.share) {
			return;
		}
		try {
			await navigator.share({
				title: 'My WordPress remote access',
				url: remoteAccess.shareUrl,
			});
		} catch (error) {
			if ((error as { name?: string })?.name === 'AbortError') {
				return;
			}
			logger.error('Failed to share remote access link:', error);
			setMessage('Could not share remote access link.');
		}
	}

	const isStarting = remoteAccess.status === 'connecting';
	const isActive = remoteAccess.isActive && remoteAccess.shareUrl;
	const isConnected = remoteAccess.status === 'connected';
	const connectUrl = `${window.location.origin}/connect`;

	return (
		<div className={css.aboutSection}>
			<h4 className={css.aboutSectionTitle}>Remote Access</h4>
			<p>
				Open this running WordPress on another device while this host
				device stays nearby.
			</p>
			<div className={css.remoteAccessControls}>
				{isActive ? (
					<>
						{!isConnected && (
							<div className={css.remoteAccessCodeBlock}>
								<span>Open on the other device:</span>
								<strong>{connectUrl}</strong>
								<span>Enter code:</span>
								<b>{remoteAccess.accessCode}</b>
							</div>
						)}
						{remoteAccess.status === 'pending-approval' && (
							<form
								className={css.remoteAccessApproval}
								role="status"
								onSubmit={approveAccess}
							>
								<span>
									Another device is asking to use this
									WordPress. Enter the code shown there.
								</span>
								<input
									value={formatVerificationCode(
										verificationCode
									)}
									onChange={(event) =>
										setVerificationCode(event.target.value)
									}
									inputMode="numeric"
									autoComplete="one-time-code"
									placeholder="12"
									aria-label="Remote access verification code"
									className={css.remoteAccessApprovalInput}
								/>
								<button
									type="submit"
									className={css.backupNowButton}
									disabled={
										normalizeVerificationCode(
											verificationCode
										).length !== 2
									}
								>
									Allow
								</button>
							</form>
						)}
						{remoteAccess.metrics && (
							<RemoteAccessDiagnostics
								metrics={remoteAccess.metrics}
								label={
									isConnected
										? 'Remote device connected'
										: 'Remote access traffic'
								}
							/>
						)}
						<div className={css.remoteAccessButtons}>
							<button
								type="button"
								className={css.backupNowButton}
								onClick={copyCurrentUrl}
							>
								Copy link
							</button>
							{'share' in navigator && (
								<button
									type="button"
									className={css.backupNowButton}
									onClick={shareCurrentUrl}
								>
									Share
								</button>
							)}
							<button
								type="button"
								className={css.textButton}
								onClick={stopAccess}
							>
								Stop
							</button>
						</div>
					</>
				) : (
					<button
						type="button"
						className={css.backupNowButton}
						disabled={!playground || isStarting}
						onClick={startAccess}
					>
						{isStarting
							? 'Starting remote access...'
							: 'Start remote access'}
					</button>
				)}
				{message && (
					<div className={css.remoteAccessStatus} role="status">
						{message}
					</div>
				)}
			</div>
		</div>
	);
}

function formatVerificationCode(value: string): string {
	return normalizeVerificationCode(value);
}

function RemoteAccessDiagnostics({
	metrics,
	label,
}: {
	metrics: NonNullable<ReturnType<typeof getRemoteAccessStatus>['metrics']>;
	label: string;
}) {
	return (
		<details className={css.remoteAccessDiagnostics}>
			<summary>{label}</summary>
			<div className={css.remoteAccessMetrics}>
				<span>Handshake {metrics.handshakeAttempts}</span>
				<span>{metrics.handshakeState}</span>
				<span>Local ICE {metrics.localCandidates}</span>
				<span>Remote ICE {metrics.remoteCandidates}</span>
				<span>Received {metrics.received}</span>
				<span>Pending {metrics.pending}</span>
				<span>Processing {metrics.processing}</span>
				<span>Done {metrics.completed}</span>
				<span>Failed {metrics.failed}</span>
			</div>
			<div className={css.remoteAccessLastRequest}>
				{metrics.lastMethod && metrics.lastPath
					? `${metrics.lastMethod} ${metrics.lastPath}`
					: 'Waiting for remote access requests'}
				{metrics.lastStatus ? ` · ${metrics.lastStatus}` : ''}
			</div>
			{metrics.lastError && (
				<div className={css.remoteAccessLastError}>
					{metrics.lastError}
				</div>
			)}
		</details>
	);
}

async function copyUrl(url: string): Promise<boolean> {
	try {
		if (!navigator.clipboard) {
			return false;
		}
		await navigator.clipboard.writeText(url);
		return true;
	} catch {
		return false;
	}
}

// ── Backup ────────────────────────────────────────────────────

type AutoBackupInterval = NonNullable<SiteMetadata['autoBackupInterval']>;

const autoBackupOptions: { value: AutoBackupInterval; label: string }[] = [
	{ value: 'none', label: 'No auto-download' },
	{ value: 'daily', label: 'Auto-download daily' },
	{ value: 'every-2-days', label: 'Auto-download every 2 days' },
	{ value: 'weekly', label: 'Auto-download weekly' },
];

function BackupSection() {
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const { isDependentMode, performBackup, isBackingUp } = useBackup();
	// In dependent mode the client only exposes navigation methods, so it
	// can't be used for `importWordPressFiles`. Treat it as absent here so
	// the Restore button stays disabled.
	const rawPlayground = usePlaygroundClient();
	const playground = isDependentMode ? null : rawPlayground;
	const [showHistory, setShowHistory] = useState(false);
	const [isRestoring, setIsRestoring] = useState(false);
	const restoreInputRef = useRef<HTMLInputElement>(null);

	if (!activeSite || activeSite.metadata.storage === 'none') {
		return null;
	}

	const handleRestoreClick = () => {
		restoreInputRef.current?.click();
	};

	const handleRestore = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		const resetInput = () => {
			if (restoreInputRef.current) {
				restoreInputRef.current.value = '';
			}
		};
		if (!file || !playground) {
			resetInput();
			return;
		}

		const proceed = window.confirm(
			'Restoring a backup will replace all current content. Continue?'
		);
		if (!proceed) {
			resetInput();
			return;
		}

		setIsRestoring(true);
		try {
			await importWordPressFiles(playground, { wordPressFilesZip: file });
			await flushWordPressMount(playground);
			await playground.goTo('/');
			logPersonalWpEvent('backup_restored');
			window.location.reload();
		} catch (error) {
			logger.error(error);
			window.alert(
				'Unable to restore backup. Is it a valid WordPress Playground export?'
			);
		} finally {
			setIsRestoring(false);
			resetInput();
		}
	};

	const { backupHistory = [], autoBackupInterval = 'daily' } =
		activeSite.metadata;
	const autoBackupSelectValue =
		autoBackupInterval === 'ignore' ? 'none' : autoBackupInterval;
	const lastBackup = backupHistory[0];

	const lastBackupText = lastBackup
		? `Last download: ${getRelativeDate(new Date(lastBackup.timestamp))}`
		: 'Never backed up';

	const handleAutoBackupChange = (e: ChangeEvent<HTMLSelectElement>) => {
		dispatch(
			updateSiteMetadata({
				slug: activeSite.slug,
				metadata: {
					autoBackupInterval: e.target.value as AutoBackupInterval,
				},
			})
		);
	};

	return (
		<div className={css.aboutSection}>
			<h4 className={css.aboutSectionTitle}>Backup</h4>
			{isDependentMode ? (
				<p>
					Backups are managed from the main tab that has the active
					connection.
				</p>
			) : (
				<>
					<p>
						Your site is stored in this browser. Browser data can be
						cleared unexpectedly, so regular backups keep your
						WordPress safe.
					</p>
					<div className={css.backupControls}>
						<div className={css.backupRow}>
							<select
								className={css.backupSelect}
								value={autoBackupSelectValue}
								onChange={handleAutoBackupChange}
							>
								{autoBackupOptions.map((option) => (
									<option
										key={option.value}
										value={option.value}
									>
										{option.label}
									</option>
								))}
							</select>
							<button
								className={css.backupNowButton}
								onClick={performBackup}
								disabled={isBackingUp || isRestoring}
								type="button"
							>
								{isBackingUp ? 'Backing up...' : 'Backup now'}
							</button>
							<input
								type="file"
								ref={restoreInputRef}
								onChange={handleRestore}
								accept=".zip,application/zip"
								style={{ display: 'none' }}
							/>
							<button
								className={css.backupNowButton}
								onClick={handleRestoreClick}
								disabled={
									!playground || isBackingUp || isRestoring
								}
								type="button"
							>
								<Icon icon={upload} size={16} />
								{isRestoring ? 'Restoring...' : 'Restore'}
							</button>
						</div>
						<span className={css.backupStatus}>
							{lastBackupText}
							{backupHistory.length > 0 && (
								<button
									className={css.historyToggle}
									onClick={() => setShowHistory(!showHistory)}
									type="button"
								>
									{showHistory
										? 'hide history'
										: `${backupHistory.length} backup${backupHistory.length === 1 ? '' : 's'}`}
								</button>
							)}
						</span>
					</div>
					{showHistory && (
						<ul className={css.backupHistory}>
							{backupHistory.map((entry, index) => (
								<li
									key={index}
									className={css.backupHistoryItem}
								>
									<span>{entry.filename}</span>
									<span className={css.backupHistoryDate}>
										{getRelativeDate(
											new Date(entry.timestamp)
										)}
									</span>
								</li>
							))}
						</ul>
					)}
				</>
			)}
		</div>
	);
}

async function flushWordPressMount(playground: PlaygroundClient) {
	const documentRoot = await playground.documentRoot;
	if (await playground.hasOpfsMount(documentRoot)) {
		await playground.flushOpfs(documentRoot);
	}
}

// ── Recovery & Reset ──────────────────────────────────────────

function RecoverySection() {
	const activeSite = useActiveSite();
	const { isDependentMode } = useBackup();
	const [showRecovery, setShowRecovery] = useState(false);
	const [showReset, setShowReset] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	async function handleStartOver() {
		if (!activeSite || activeSite.metadata.storage === 'none') {
			return;
		}
		const { backupHistory = [] } = activeSite.metadata;
		const hasBackup = backupHistory.length > 0;
		const message = hasBackup
			? 'Are you sure? This will delete all data and reset WordPress.'
			: 'Are you sure? You have no backups — all data will be permanently lost.';
		if (!window.confirm(message)) {
			return;
		}
		setIsDeleting(true);
		try {
			broadcastSiteReset(activeSite.slug);
			await opfsSiteStorage?.delete(activeSite.slug);
			window.location.href =
				window.location.origin + window.location.pathname;
		} catch (error) {
			logger.error(error);
			alert('Failed to reset. Please try again.');
			setIsDeleting(false);
		}
	}

	return (
		<div className={css.aboutSection}>
			<h4 className={css.aboutSectionTitle}>Troubleshooting</h4>
			<p>
				If WordPress crashed,{' '}
				<button
					className={css.textButton}
					onClick={() => setShowRecovery(!showRecovery)}
					type="button"
				>
					enter recovery mode
				</button>
				.
				{!isDependentMode && (
					<>
						{' '}
						Or{' '}
						<button
							className={css.textButton}
							onClick={() => setShowReset(!showReset)}
							type="button"
						>
							start over
						</button>
						.
					</>
				)}
			</p>
			{showRecovery && (
				<a
					href={getHealthCheckRecoveryUrl()}
					className={css.recoveryLink}
					onClick={() => logPersonalWpEvent('health_check_installed')}
				>
					Install Health Check &amp; Troubleshoot
				</a>
			)}
			{showReset && !isDependentMode && (
				<button
					className={css.dangerButton}
					onClick={handleStartOver}
					disabled={isDeleting}
					type="button"
				>
					<Icon icon={trash} size={16} />
					<span>
						{isDeleting ? 'Deleting...' : 'Delete everything'}
					</span>
				</button>
			)}
		</div>
	);
}

// ── About Tab (composed) ──────────────────────────────────────

function AboutTab({ siteSlug }: { siteSlug: string }) {
	const clientInfo = usePlaygroundClientInfo();
	const isDependentMode = clientInfo?.isDependentMode ?? false;

	return (
		<div className={css.aboutTab}>
			<h3 className={css.aboutHeading}>My WordPress</h3>
			<p>
				A full WordPress running entirely in your browser — no server,
				no account, completely free and private. Your data stays on your
				device.
			</p>

			<InstallAppsSection siteSlug={siteSlug} />
			{!isDependentMode && (
				<>
					<RemoteAccessSection />
					<BackupSection />
					<RecoverySection />
				</>
			)}
			{isDependentMode && <DependentTabToolsNotice />}

			<div className={css.aboutSection}>
				<a
					href="https://playground.wordpress.net"
					target="_blank"
					rel="noopener noreferrer"
					className={css.externalLink}
				>
					<Icon icon={external} size={16} />
					<span>Open playground.wordpress.net</span>
				</a>
			</div>
		</div>
	);
}

function DependentTabToolsNotice() {
	return (
		<div className={css.dependentTabToolsNotice}>
			<h4>Runtime-only: backups, recovery, reset</h4>
			<p>
				This tab can view, navigate, and install apps. Backups,
				recovery, and reset controls need the tab running the WordPress
				runtime.
			</p>
		</div>
	);
}

export function SiteInfoPanel({
	className,
	site,
	mobileUi,
	siteViewHidden,
}: {
	className: string;
	site: SiteInfo;
	mobileUi?: boolean;
	siteViewHidden?: boolean;
}) {
	const dispatch = useAppDispatch();

	// Load the last active tab for this site
	const validTabs = ['about', 'files', 'database', 'logs'];
	const [initialTabName] = useState(() => {
		const lastTab = getSiteLastTab(site.slug);
		if (lastTab && validTabs.includes(lastTab)) {
			return lastTab;
		}
		return 'about';
	});

	// Resolve documentRoot from playground client, or use fallback for direct OPFS access
	// Initialize to "/" for OPFS sites so the file browser can render immediately
	const [documentRoot, setDocumentRoot] = useState<string | null>(
		site.metadata.storage === 'opfs' ? '/' : null
	);

	// Save the tab when it changes
	const handleTabSelect = (tabName: string) => {
		setSiteLastTab(site.slug, tabName);
	};

	const clientInfo = useAppSelector((state) =>
		selectClientInfoBySiteSlug(state, site.slug)
	);
	// The dependent-mode client is a minimal stub exposing only `goTo` and
	// `getCurrentURL` — calling PHP-runtime methods (`isDir`, `fileExists`,
	// `documentRoot`, …) on it throws. Use the navigation client for the
	// header buttons but treat the runtime client as absent so file/database
	// panels fall back to OPFS access or render a disabled state.
	const navigationClient = clientInfo?.client;
	const playground =
		clientInfo && !clientInfo.isDependentMode
			? clientInfo.client
			: undefined;

	// Resolve documentRoot from playground, or use fallback for direct OPFS access
	useEffect(() => {
		if (playground) {
			void playground.documentRoot.then((root) => {
				setDocumentRoot(root);
			});
		} else if (site.metadata.storage === 'opfs') {
			// When accessing OPFS directly (no client), the root is "/".
			// This also handles the case where playground becomes null after being set
			// (e.g., site crashes mid-session), resetting documentRoot for direct OPFS access.
			setDocumentRoot('/');
		} else {
			setDocumentRoot(null);
		}
	}, [playground, site.metadata.storage]);

	function navigateTo(path: string) {
		if (siteViewHidden) {
			dispatch(setSiteManagerOpen(false));
		}

		if (navigationClient) {
			navigationClient.goTo(path);
		}
	}

	usePlaygroundClientInfo(site.slug);

	return (
		<section
			className={classNames(className, css.siteInfoPanel, {
				[css.isMobile]: mobileUi,
			})}
		>
			<Flex
				direction="column"
				gap={1}
				justify="flex-start"
				expanded={true}
				className={css.siteInfoPanelContent}
			>
				<FlexItem style={{ flexShrink: 0 }}>
					<Flex
						direction="row"
						gap={2}
						justify="space-between"
						align="flex-start"
						expanded={true}
						className={`${css.padded} ${css.siteInfoHeader}`}
						style={{ paddingBottom: 10 }}
					>
						{mobileUi && (
							<FlexItem style={{ marginLeft: -20 }}>
								<Button
									variant="link"
									label="Back to Playground"
									icon={() => (
										<Icon icon={chevronLeft} size={38} />
									)}
									className={css.grayLinkDark}
									onClick={() => {
										dispatch(setSiteManagerOpen(false));
									}}
								/>
							</FlexItem>
						)}
						<FlexItem style={{ flexGrow: 1 }}>
							<h2 className={css.siteInfoHeaderDetailsName}>
								Site Tools
							</h2>
						</FlexItem>
						{mobileUi ? (
							<FlexItem style={{ flexShrink: 0 }}>
								<Button
									variant="primary"
									onClick={() => {
										dispatch(setSiteManagerOpen(false));
									}}
								>
									Open site
								</Button>
							</FlexItem>
						) : (
							<>
								<FlexItem className={css.siteInfoHeaderAction}>
									<Button
										variant="tertiary"
										disabled={!navigationClient}
										onClick={() => navigateTo('/wp-admin/')}
									>
										WP Admin
									</Button>
								</FlexItem>
								<FlexItem className={css.siteInfoHeaderAction}>
									<Button
										variant="secondary"
										disabled={!navigationClient}
										onClick={() => navigateTo('/')}
									>
										Homepage
									</Button>
								</FlexItem>
								<FlexItem>
									<Button
										icon={close}
										label="Close Site Tools"
										onClick={() => {
											dispatch(setSiteManagerOpen(false));
										}}
										className={css.closeButton}
									/>
								</FlexItem>
							</>
						)}
					</Flex>
				</FlexItem>
				<FlexItem style={{ flexGrow: 1 }}>
					<TabPanel
						className={css.tabs}
						initialTabName={initialTabName}
						onSelect={handleTabSelect}
						tabs={[
							{
								name: 'about',
								title: 'About',
							},
							{
								name: 'files',
								title: 'Files',
							},
							{
								name: 'database',
								title: 'Database',
							},
							{
								name: 'logs',
								title: 'Logs',
							},
						]}
					>
						{(tab) => (
							<>
								<div
									className={classNames(
										css.tabContents,
										css.padded,
										{
											[css.tabHidden]:
												tab.name !== 'about',
										}
									)}
									hidden={tab.name !== 'about'}
								>
									<AboutTab siteSlug={site.slug} />
								</div>
								<div
									className={classNames(
										css.tabContents,
										css.fileBrowserTab,
										{
											[css.tabHidden]:
												tab.name !== 'files',
										}
									)}
									hidden={tab.name !== 'files'}
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
												isVisible={tab.name === 'files'}
												documentRoot={documentRoot}
											/>
										)}
									</Suspense>
								</div>
								<div
									className={classNames(
										css.tabContents,
										css.padded,
										{
											[css.tabHidden]:
												tab.name !== 'database',
										}
									)}
									hidden={tab.name !== 'database'}
								>
									<SiteDatabasePanel
										playground={playground}
									/>
								</div>
								<div
									className={classNames(
										css.tabContents,
										css.padded,
										{
											[css.tabHidden]:
												tab.name !== 'logs',
										}
									)}
									hidden={tab.name !== 'logs'}
								>
									<div
										className={classNames(css.logsWrapper)}
									>
										<SiteLogs className={css.logsSection} />
									</div>
								</div>
							</>
						)}
					</TabPanel>
				</FlexItem>
			</Flex>
		</section>
	);
}
