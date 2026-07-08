import React, { useState } from 'react';
import css from './save-status-indicator.module.css';
import classNames from 'classnames';
import { getOpfsSyncProgressPercent } from '../../lib/opfs-sync-progress';
import {
	useAppSelector,
	getActiveClientInfo,
	useActiveSite,
	useAppDispatch,
} from '../../lib/state/redux/store';
import {
	setSiteManagerOpen,
	setSiteManagerSection,
	setSiteSlugToSave,
} from '../../lib/state/redux/slice-ui';
import { Icon, Tooltip, Dropdown, Button } from '@wordpress/components';
import { check, cautionFilled, chevronDown, update } from '@wordpress/icons';
import {
	isAutosavedSite,
	MAX_AUTOSAVED_SITES,
	type SiteInfo,
} from '../../lib/state/redux/slice-sites';
import type { ClientInfo, OpfsSync } from '../../lib/state/redux/slice-clients';
import { isOpfsAvailable } from '../../lib/state/opfs/opfs-site-storage';
import { logger } from '@php-wasm/logger';
import { Spinner } from '../spinner';
import { useLocalFsAvailability } from '../../lib/hooks/use-local-fs-availability';

type SaveStatus =
	| 'saved'
	| 'autosaved'
	| 'unsaved'
	| 'saving'
	| 'loading'
	| 'error';

/**
 * Compact persistence status for the dock. The actionable states (autosaved,
 * unsaved, error) open the "Store permanently" dock pane directly on click —
 * the single most useful thing to do — with the explanation carried by a
 * hover/focus tooltip rather than an extra explain-then-act popover.
 */
export function SaveStatusIndicator() {
	const clientInfo = useAppSelector(getActiveClientInfo);
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const [isReloadingFromDisk, setIsReloadingFromDisk] = useState(false);

	const opfsSync = clientInfo?.opfsSync;
	const status = getSaveStatus(activeSite, clientInfo);
	const isAutosaved = activeSite ? isAutosavedSite(activeSite) : false;
	const localFsAvailability = useLocalFsAvailability(clientInfo?.client);
	const canStorePermanently =
		isOpfsAvailable || localFsAvailability === 'available';
	const isLocalFs = activeSite?.metadata.storage === 'local-fs';

	const openStorePermanently = () => {
		// Open the dock's "Store permanently" pane for the active Playground
		// (clearing any specific target left over from the Save modal flow).
		dispatch(setSiteSlugToSave(undefined));
		dispatch(setSiteManagerSection('save'));
		dispatch(setSiteManagerOpen(true));
	};

	// Re-reads the linked local directory into the running Playground so edits
	// made to the files on disk (outside Playground) show up. Re-mounts the
	// filesystem with an opfs-to-memfs sync, then reloads the page to reflect the
	// new files. Do not flush first: this action is explicitly disk →
	// Playground, and flushing here could overwrite edits made on disk.
	const reloadFilesFromDisk = async () => {
		const client = clientInfo?.client;
		const opfsMountDescriptor = clientInfo?.opfsMountDescriptor;
		const url = clientInfo?.url;
		if (!client || !opfsMountDescriptor || !url) {
			return;
		}
		setIsReloadingFromDisk(true);
		let docroot: string | undefined;
		let mountNeedsRestore = false;
		try {
			docroot = await client.documentRoot;
			await client.unmountOpfs(docroot);
			mountNeedsRestore = true;
			await client.mountOpfs({
				device: opfsMountDescriptor.device,
				mountpoint: docroot,
				initialSyncDirection: 'opfs-to-memfs',
			});
			mountNeedsRestore = false;
			await client.goTo(url);
		} catch (error) {
			if (mountNeedsRestore && docroot) {
				try {
					// Restore the live mount without pushing the current MEMFS
					// snapshot back to disk. The user's explicit action here is
					// disk → Playground, so a failure must not overwrite disk edits
					// with the older in-browser copy.
					await client.mountOpfs({
						device: opfsMountDescriptor.device,
						mountpoint: docroot,
						initialSyncDirection: 'opfs-to-memfs',
					});
				} catch (restoreError) {
					logger.error(
						'Error restoring the local directory mount.',
						restoreError
					);
				}
			}
			logger.error(
				'Error reloading files from the local directory.',
				error
			);
			alert(
				'Unable to reload files from the local directory. Please try again.'
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
		return (
			<div className={classNames(css.indicator, css.loading)}>
				<Spinner size={16} />
				<span className={css.label} role="status">
					Loading…
				</span>
			</div>
		);
	}

	if (status === 'saved') {
		// Local-directory Playgrounds fold their one extra action — re-reading
		// files edited on disk outside Playground — into the status itself, so
		// the dock shows a single "Saved" control instead of a status chip plus
		// a separate, unclear "Sync local files" button.
		if (isLocalFs) {
			return (
				<Dropdown
					className={css.savedMenu}
					popoverProps={{ placement: 'top' }}
					renderToggle={({ isOpen, onToggle }) => (
						<button
							type="button"
							className={classNames(
								css.indicator,
								css.saved,
								css.actionable
							)}
							onClick={onToggle}
							aria-expanded={isOpen}
							title="Saved to a folder on this computer."
						>
							<Icon icon={check} size={18} />
							<span className={css.label}>Saved</span>
							<Icon icon={chevronDown} size={16} />
						</button>
					)}
					renderContent={({ onClose }) => (
						<div className={css.savedMenuContent}>
							<p className={css.savedMenuHint}>
								This Playground is saved to a folder on your
								computer. Changes you make here are written to
								those files.
							</p>
							<Button
								className={css.savedMenuAction}
								icon={update}
								disabled={isReloadingFromDisk}
								onClick={async () => {
									await reloadFilesFromDisk();
									onClose();
								}}
							>
								{isReloadingFromDisk
									? 'Reloading…'
									: 'Reload files from disk'}
							</Button>
						</div>
					)}
				/>
			);
		}
		return (
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
		return (
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
				>
					<span className={css.label}>Autosaved</span>
				</button>
			</Tooltip>
		);
	}

	if (status === 'saving') {
		const progress =
			opfsSync?.status === 'syncing' ? opfsSync.progress : undefined;
		const progressPercent = getOpfsSyncProgressPercent(progress);
		const syncLabel = getSyncLabel(opfsSync);
		return (
			<div className={classNames(css.indicator, css.saving)}>
				{/* The ring carries the live percentage as a progressbar value.
				    It is NOT inside a live region, so screen readers expose the
				    number on demand without re-announcing it on every sync tick. */}
				<span
					className={css.progressRing}
					style={
						{
							'--save-progress': `${progressPercent}%`,
						} as React.CSSProperties
					}
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={progressPercent}
					aria-label={syncLabel}
				/>
				{/* Only the coarse verb is a live region, so it announces "Saving"
				    once instead of spamming "Saving 41%, 42%…". */}
				<span className={css.label} role="status">
					{syncLabel}
				</span>
			</div>
		);
	}

	if (status === 'error') {
		return (
			<Tooltip text="Saving failed. Click to try again." placement="top">
				<button
					className={classNames(css.indicator, css.error)}
					onClick={openStorePermanently}
					type="button"
				>
					<Icon icon={cautionFilled} size={18} />
					<span className={css.label}>
						{opfsSync?.operation === 'autosave' || isAutosaved
							? 'Autosave failed'
							: 'Save failed'}
					</span>
				</button>
			</Tooltip>
		);
	}

	// Unsaved. When permanent storage is available, clicking stores it; when it
	// isn't, there is no action to offer, so it reads as plain status text.
	if (canStorePermanently) {
		return (
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
				>
					<Icon icon={cautionFilled} size={18} />
					<span className={css.label}>Unsaved</span>
				</button>
			</Tooltip>
		);
	}

	return (
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
	// A Playground whose runtime hasn't connected yet is still loading — don't
	// claim it is ready to save or already saved until the client is actually up.
	if (!clientInfo) {
		return 'loading';
	}
	const storage = site?.metadata.storage;
	if (storage === 'none' || !storage) {
		return 'unsaved';
	}
	if (isAutosaved) {
		return 'autosaved';
	}
	return 'saved';
}

/**
 * Uses the sync operation when it is known, then falls back to site lifecycle.
 *
 * This is only shown while a sync is actually in progress, so it always reports
 * the in-progress verb — "Autosaving" for an autosave, "Saving" for an explicit
 * browser save — never the settled "Autosaved" (a spinner next to "Autosaved"
 * would contradict itself).
 */
function getSyncLabel(opfsSync: OpfsSync | undefined) {
	return opfsSync?.operation === 'autosave' ? 'Autosaving' : 'Saving';
}
