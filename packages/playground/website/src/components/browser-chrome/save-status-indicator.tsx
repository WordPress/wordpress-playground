import React, { useEffect, useRef, useState } from 'react';
import css from './save-status-indicator.module.css';
import calloutCss from '../dock-callout.module.css';
import classNames from 'classnames';
import {
	useAppSelector,
	getActiveClientInfo,
	useActiveSite,
	useAppDispatch,
} from '../../lib/state/redux/store';
import {
	setDockPaneOpen,
	setDockPaneSection,
	setSiteSlugToSave,
} from '../../lib/state/redux/slice-ui';
import { Button, Dropdown, Icon, Tooltip } from '@wordpress/components';
import {
	check,
	cautionFilled,
	chevronDown,
	close,
	wordpress,
} from '@wordpress/icons';
import {
	isAutosavedSite,
	MAX_AUTOSAVED_SITES,
	type SiteInfo,
} from '../../lib/state/redux/slice-sites';
import type { ClientInfo, OpfsSync } from '../../lib/state/redux/slice-clients';
import { isOpfsAvailable } from '../../lib/state/opfs/opfs-site-storage';
import { useLocalFsAvailability } from '../../lib/hooks/use-local-fs-availability';
import { logger } from '@php-wasm/logger';
import { Spinner } from '../spinner';

type SaveStatus =
	| 'saved'
	| 'autosaved'
	| 'unsaved'
	| 'saving'
	| 'loading'
	| 'error';
type SyncOperation = 'save' | 'autosave';

/**
 * Compact persistence status for the Dock. The actionable states (autosaved,
 * unsaved, error) open the save surface directly on click, with the explanation
 * carried by a hover/focus tooltip rather than an extra explain-then-act popover.
 */
export function SaveStatusIndicator({
	disabled = false,
}: {
	disabled?: boolean;
}) {
	const clientInfo = useAppSelector(getActiveClientInfo);
	const siteImportProgress = useAppSelector(
		(state) => state.ui.siteImportProgress
	);
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const previousStatusRef = useRef<{
		status: SaveStatus | undefined;
		siteSlug: string | undefined;
	}>();
	const [isReloadingFromDisk, setIsReloadingFromDisk] = useState(false);
	const [statusAnnouncement, setStatusAnnouncement] = useState('');

	const opfsSync = clientInfo?.opfsSync;
	const status = siteImportProgress
		? 'loading'
		: getSaveStatus(activeSite, clientInfo);
	const siteSlug = activeSite?.slug;
	const syncOperation = getSyncOperation({ site: activeSite, opfsSync });
	const localFsAvailability = useLocalFsAvailability(clientInfo?.client);
	const canStorePermanently =
		isOpfsAvailable || localFsAvailability === 'available';
	const isLocalFs = activeSite?.metadata.storage === 'local-fs';

	useEffect(() => {
		const previousStatus = previousStatusRef.current;
		previousStatusRef.current = {
			status,
			siteSlug,
		};

		// Do not describe an already-finished save as a new completion when the
		// user switches Playgrounds. The next real sync will populate the region.
		if (
			!status ||
			!previousStatus?.status ||
			previousStatus.siteSlug !== siteSlug
		) {
			setStatusAnnouncement('');
			return;
		}

		// Clear the previous result while a new sync runs. This prevents stale
		// status text and makes a repeated message such as "Autosave complete" a
		// new live-region update when the operation finishes.
		if (status === 'saving') {
			setStatusAnnouncement('');
			return;
		}

		const message = getStatusAnnouncement({
			previousStatus: previousStatus.status,
			status,
			syncOperation,
		});
		if (message) {
			setStatusAnnouncement(message);
		}
	}, [siteSlug, status, syncOperation]);

	const withStatusAnnouncement = (indicator: React.ReactElement) => (
		<>
			<SaveStatusAnnouncement announcement={statusAnnouncement} />
			{indicator}
		</>
	);

	const openStorePermanently = () => {
		if (disabled) {
			return;
		}
		// The status always acts on the active Playground, not an inactive site
		// that may have opened the standalone save modal earlier.
		dispatch(setSiteSlugToSave(undefined));
		dispatch(setDockPaneSection('save'));
		dispatch(setDockPaneOpen(true));
	};

	// Re-reads the linked local directory into the running Playground so edits
	// made to the files on disk (outside Playground) show up. Re-mounts OPFS with
	// an opfs-to-memfs sync, then reloads the page to reflect the new files.
	const reloadFilesFromDisk = async () => {
		const client = clientInfo?.client;
		const opfsMountDescriptor = clientInfo?.opfsMountDescriptor;
		const url = clientInfo?.url;
		if (!client || !opfsMountDescriptor || !url) {
			return;
		}
		setIsReloadingFromDisk(true);
		try {
			const docroot = await client.documentRoot;
			await client.unmountOpfs(docroot);
			await client.mountOpfs({
				device: opfsMountDescriptor.device,
				mountpoint: docroot,
				initialSyncDirection: 'opfs-to-memfs',
			});
			await client.goTo(url);
		} catch (error) {
			logger.error(
				'Error reloading files from the local directory.',
				error
			);
		} finally {
			setIsReloadingFromDisk(false);
		}
	};

	if (!status) {
		return null;
	}

	if (status === 'loading') {
		// The runtime hasn't connected yet — a calm spinner instead of a
		// premature "Autosaved"/"Saved" claim. Not actionable while loading.
		return withStatusAnnouncement(
			<div className={classNames(css.indicator, css.loading)}>
				<Spinner size={16} />
				<span className={css.label}>Loading…</span>
			</div>
		);
	}

	if (status === 'saved') {
		// Local-directory Playgrounds fold their one extra action — re-reading
		// files edited on disk outside Playground — into the status itself, so
		// the dock shows a single "Saved" control instead of a status chip plus
		// a separate, unclear "Sync local files" button.
		if (isLocalFs) {
			return withStatusAnnouncement(
				<Dropdown
					popoverProps={{
						placement: 'top',
						shift: true,
						noArrow: false,
						className: classNames(
							calloutCss.popover,
							css.savedMenuPopover
						),
					}}
					renderToggle={({ isOpen, onToggle }) => (
						<button
							type="button"
							className={classNames(
								css.indicator,
								css.saved,
								css.actionable
							)}
							onClick={onToggle}
							disabled={disabled}
							aria-expanded={isOpen}
							aria-haspopup="dialog"
							title="Saved to a local directory."
						>
							<Icon icon={check} size={18} />
							<span className={css.label}>Saved</span>
							<Icon icon={chevronDown} size={16} />
						</button>
					)}
					renderContent={({ onClose }) => (
						<aside
							className={calloutCss.card}
							role="dialog"
							aria-label="Local directory save status"
						>
							<div className={calloutCss.header}>
								<div className={calloutCss.eyebrow}>
									Local directory
								</div>
								<Button
									className={calloutCss.dismiss}
									icon={close}
									label="Close local directory status"
									onClick={onClose}
								/>
							</div>
							<div className={calloutCss.identity}>
								<span
									className={calloutCss.avatar}
									aria-hidden="true"
								>
									<Icon icon={wordpress} size={28} />
								</span>
								<div className={calloutCss.identityCopy}>
									<div className={calloutCss.identityTitle}>
										{activeSite?.metadata.name}
									</div>
									<div className={calloutCss.identityMeta}>
										Saved directly to the linked folder
									</div>
								</div>
							</div>
							<Button
								variant="primary"
								className={calloutCss.primaryAction}
								disabled={disabled || isReloadingFromDisk}
								isBusy={isReloadingFromDisk}
								onClick={async () => {
									await reloadFilesFromDisk();
									onClose();
								}}
							>
								{isReloadingFromDisk
									? 'Reloading…'
									: 'Reload files from disk'}
							</Button>
							<p className={calloutCss.hint}>
								Reload to pick up edits made to the folder
								outside Playground.
							</p>
						</aside>
					)}
				/>
			);
		}
		return withStatusAnnouncement(
			<div
				className={classNames(css.indicator, css.saved)}
				title="Stored permanently in this browser."
			>
				<Icon icon={check} size={18} />
				<span className={css.label}>Saved</span>
			</div>
		);
	}

	if (status === 'autosaved') {
		return withStatusAnnouncement(
			<Tooltip
				text={`Recent autosave — deleted after ${MAX_AUTOSAVED_SITES} newer autosaves. Click to store it permanently.`}
				placement="top"
			>
				<button
					className={classNames(
						css.indicator,
						css.autosaved,
						css.actionable
					)}
					onClick={openStorePermanently}
					type="button"
					disabled={disabled}
				>
					<span className={css.label}>Autosaved</span>
				</button>
			</Tooltip>
		);
	}

	if (status === 'saving') {
		const progress =
			opfsSync?.status === 'syncing' ? opfsSync.progress : undefined;
		const progressPercent = getProgressPercent(progress);
		const syncLabel = getSyncLabel({ site: activeSite, opfsSync });
		// A progressbar exposes exact progress when a screen reader user
		// navigates to it without broadcasting every file-count update.
		return withStatusAnnouncement(
			<div
				className={classNames(css.indicator, css.saving)}
				aria-label={
					syncOperation === 'autosave'
						? 'Autosave progress'
						: 'Save progress'
				}
				aria-valuemax={100}
				aria-valuemin={0}
				aria-valuenow={progressPercent}
				role="progressbar"
			>
				<span
					className={css.progressRing}
					style={
						{
							'--save-progress': `${progressPercent}%`,
						} as React.CSSProperties
					}
					aria-hidden="true"
				/>
				<span className={css.label}>{syncLabel}</span>
			</div>
		);
	}

	if (status === 'error') {
		return withStatusAnnouncement(
			<Tooltip text="Saving failed. Click to try again." placement="top">
				<button
					className={classNames(css.indicator, css.error)}
					onClick={openStorePermanently}
					type="button"
					disabled={disabled}
				>
					<Icon icon={cautionFilled} size={18} />
					<span className={css.label}>
						{getFailedSyncLabel(syncOperation)}
					</span>
				</button>
			</Tooltip>
		);
	}

	// Unsaved. When permanent storage is available, clicking stores it; when it
	// isn't, there is no action to offer, so it reads as plain status text.
	if (canStorePermanently) {
		return withStatusAnnouncement(
			<Tooltip
				text="Temporary Playground — everything is lost on refresh. Click to store it permanently."
				placement="top"
			>
				<button
					className={classNames(
						css.indicator,
						css.unsaved,
						css.actionable
					)}
					onClick={openStorePermanently}
					type="button"
					disabled={disabled}
				>
					<Icon icon={cautionFilled} size={18} />
					<span className={css.label}>Unsaved</span>
				</button>
			</Tooltip>
		);
	}

	return withStatusAnnouncement(
		<div
			className={classNames(css.indicator, css.unsaved)}
			title="Temporary Playground — lost on refresh. Saving is unavailable in this browser."
		>
			<Icon icon={cautionFilled} size={18} />
			<span className={css.label}>Unsaved</span>
		</div>
	);
}

/**
 * Keeps completion and failure announcements separate from queryable progress.
 *
 * The region stays mounted while the visual indicator changes. `role="status"`
 * is implicitly polite and atomic, so only changes to `announcement` are spoken.
 */
function SaveStatusAnnouncement({ announcement }: { announcement: string }) {
	return (
		<div className="sr-only" role="status">
			{announcement}
		</div>
	);
}

/**
 * Returns the result to announce for a save lifecycle transition.
 *
 * Progress updates keep `status` at `saving` and never enter this live region.
 * Errors are announced only when entered so later state updates cannot repeat
 * the same failure indefinitely.
 */
function getStatusAnnouncement({
	previousStatus,
	status,
	syncOperation,
}: {
	previousStatus: SaveStatus;
	status: SaveStatus;
	syncOperation: SyncOperation;
}) {
	if (status === 'error' && previousStatus !== 'error') {
		return getFailedSyncLabel(syncOperation);
	}
	if (previousStatus !== 'saving') {
		return undefined;
	}
	if (status === 'saved' || status === 'autosaved') {
		return syncOperation === 'autosave'
			? 'Autosave complete'
			: 'Save complete';
	}
	return undefined;
}

/**
 * Collapses site storage and OPFS sync state into one browser-chrome status.
 *
 * A stored Playground whose iframe client hasn't connected yet is still loading,
 * so it reads as 'loading' rather than claiming a settled "Saved"/"Autosaved" —
 * the runtime isn't up and nothing is being persisted yet. 'saving' is reserved
 * for an actual OPFS sync in progress (which only happens once connected).
 */
function getSaveStatus(
	site: SiteInfo | undefined,
	clientInfo: ClientInfo | undefined
): SaveStatus | undefined {
	if (!site) {
		return undefined;
	}
	const opfsSync = clientInfo?.opfsSync;
	const isAutosaved = isAutosavedSite(site);
	if (opfsSync?.status === 'error') {
		return 'error';
	}
	if (opfsSync?.status === 'syncing') {
		return 'saving';
	}
	const storage = site?.metadata.storage;
	if (storage === 'none' || !storage) {
		return 'unsaved';
	}
	// A stored Playground whose runtime hasn't connected yet is still loading —
	// don't claim it's "Saved"/"Autosaved" until it's actually up.
	if (!clientInfo) {
		return 'loading';
	}
	if (isAutosaved) {
		return 'autosaved';
	}
	return 'saved';
}

/**
 * `initialOpfsSyncPending` alone is not enough to mean "autosaving": explicit
 * browser saves also do their first MEMFS-to-OPFS sync after boot. Known
 * autosaved Playgrounds keep the completed-state label while the pending OPFS
 * sync finishes because they are already represented as autosaves in Site Manager.
 */
function getSyncLabel({
	site,
	opfsSync,
}: {
	site: SiteInfo | undefined;
	opfsSync: OpfsSync | undefined;
}) {
	if (opfsSync?.operation === 'save') {
		return 'Saving';
	}
	if (site && isAutosavedSite(site)) {
		return 'Autosaved';
	}
	return opfsSync?.operation === 'autosave' ? 'Autosaving' : 'Saving';
}

/**
 * Uses the explicit sync operation when available and falls back to the stored
 * site lifecycle while the initial client is still booting.
 */
function getSyncOperation({
	site,
	opfsSync,
}: {
	site: SiteInfo | undefined;
	opfsSync: OpfsSync | undefined;
}): SyncOperation {
	return (
		opfsSync?.operation ??
		(site && isAutosavedSite(site) ? 'autosave' : 'save')
	);
}

function getFailedSyncLabel(syncOperation: SyncOperation) {
	return syncOperation === 'autosave' ? 'Autosave failed' : 'Save failed';
}

/** Turns OPFS file-count progress into the bounded percentage used by the ring. */
function getProgressPercent(
	progress: Extract<OpfsSync, { status: 'syncing' }>['progress']
) {
	if (!progress || progress.total <= 0) {
		return 0;
	}
	return Math.min(100, Math.round((progress.files / progress.total) * 100));
}
