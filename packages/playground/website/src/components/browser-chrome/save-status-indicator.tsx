import React, { useState } from 'react';
import css from './save-status-indicator.module.css';
import classNames from 'classnames';
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
	dismissAutosaveNudge,
	addDeclinedAutosaveRestoreFingerprint,
} from '../../lib/state/redux/slice-ui';
import {
	Icon,
	Tooltip,
	Popover,
	Dropdown,
	Button,
} from '@wordpress/components';
import { check, cautionFilled, chevronDown, update } from '@wordpress/icons';
import {
	isAutosavedSite,
	MAX_AUTOSAVED_SITES,
	type SiteInfo,
} from '../../lib/state/redux/slice-sites';
import type { ClientInfo, OpfsSync } from '../../lib/state/redux/slice-clients';
import { isOpfsAvailable } from '../../lib/state/opfs/opfs-site-storage';
import { useLocalFsAvailability } from '../../lib/hooks/use-local-fs-availability';
import { useSitesAPI } from '../../lib/state/redux/site-management-api-middleware';
import { logger } from '@php-wasm/logger';
import { RestoreAutosaveNudge } from '../ensure-playground-site/restore-autosave-nudge';

type SaveStatus = 'saved' | 'autosaved' | 'unsaved' | 'saving' | 'error';

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
	const sitesAPI = useSitesAPI();
	const autosaveNudge = useAppSelector((state) => state.ui.autosaveNudge);
	const [nudgeAnchor, setNudgeAnchor] = useState<HTMLElement | null>(null);
	const [nudgeBusy, setNudgeBusy] = useState(false);
	const [nudgeError, setNudgeError] = useState<string>();
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

	const handleRestoreAutosave = async () => {
		if (!autosaveNudge) {
			return;
		}
		setNudgeError(undefined);
		setNudgeBusy(true);
		try {
			await sitesAPI.setActiveSite(autosaveNudge.siteSlug);
			dispatch(dismissAutosaveNudge());
		} catch (error) {
			logger.error('Error restoring autosaved Playground.', error);
			setNudgeError(
				'Could not restore the autosave. Try again or keep the new Playground.'
			);
		} finally {
			setNudgeBusy(false);
		}
	};

	const handleKeepNew = async () => {
		if (!autosaveNudge) {
			return;
		}
		setNudgeError(undefined);
		setNudgeBusy(true);
		try {
			await sitesAPI.autosaveTemporarySite(undefined, {
				updateUrl: false,
				excludeFromPruning: [autosaveNudge.siteSlug],
			});
			dispatch(
				addDeclinedAutosaveRestoreFingerprint(
					autosaveNudge.setupUrlFingerprint
				)
			);
			dispatch(dismissAutosaveNudge());
		} catch (error) {
			logger.error(
				'Error autosaving the new Playground after declining restore.',
				error
			);
			setNudgeError(
				'Could not keep the new Playground. Please try again.'
			);
		} finally {
			setNudgeBusy(false);
		}
	};

	const autosaveNudgePopover = autosaveNudge && nudgeAnchor && (
		<Popover
			anchor={nudgeAnchor}
			placement="top"
			offset={12}
			focusOnMount={false}
			className={css.autosaveNudgePopover}
			onClose={() => dispatch(dismissAutosaveNudge())}
		>
			<RestoreAutosaveNudge
				whenCreated={autosaveNudge.whenCreated}
				error={nudgeError}
				isBusy={nudgeBusy}
				onRestore={handleRestoreAutosave}
				onKeepNew={handleKeepNew}
				onDismiss={() => dispatch(dismissAutosaveNudge())}
			/>
		</Popover>
	);

	if (!status) {
		return null;
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
		const progressPercent = getProgressPercent(progress);
		return (
			<div
				className={classNames(css.indicator, css.saving)}
				aria-label={`${getSyncLabel({
					site: activeSite,
					opfsSync,
				})} ${progressPercent}%`}
				role="status"
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
				<span className={css.label}>
					{getSyncLabel({ site: activeSite, opfsSync })}
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
			<span className={css.statusAnchor} ref={setNudgeAnchor}>
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
				{autosaveNudgePopover}
			</span>
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
 * A newly-created OPFS site has saved metadata before its iframe client exists,
 * so `initialOpfsSyncPending` must still render as an in-progress save.
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
	if (
		opfsSync?.status === 'syncing' ||
		(!clientInfo && site.metadata.initialOpfsSyncPending)
	) {
		return 'saving';
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
 * Turns OPFS file-count progress into the bounded percentage used by the ring.
 */
function getProgressPercent(
	progress: Extract<OpfsSync, { status: 'syncing' }>['progress']
) {
	if (!progress || progress.total <= 0) {
		return 0;
	}
	return Math.min(100, Math.round((progress.files / progress.total) * 100));
}
