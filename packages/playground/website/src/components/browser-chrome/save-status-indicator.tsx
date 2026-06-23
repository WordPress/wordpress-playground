import React, { useRef, useState } from 'react';
import css from './save-status-indicator.module.css';
import classNames from 'classnames';
import {
	useAppSelector,
	getActiveClientInfo,
	useActiveSite,
	useAppDispatch,
} from '../../lib/state/redux/store';
import {
	modalSlugs,
	setActiveModal,
	setSiteSlugToSave,
} from '../../lib/state/redux/slice-ui';
import { Icon, Popover } from '@wordpress/components';
import { backup, check, cautionFilled } from '@wordpress/icons';
import {
	isAutosavedSite,
	MAX_AUTOSAVED_SITES,
	type SiteInfo,
} from '../../lib/state/redux/slice-sites';
import type { ClientInfo, OpfsSync } from '../../lib/state/redux/slice-clients';
import { isOpfsAvailable } from '../../lib/state/opfs/opfs-site-storage';
import { useLocalFsAvailability } from '../../lib/hooks/use-local-fs-availability';

type SaveStatus = 'saved' | 'autosaved' | 'unsaved' | 'saving' | 'error';

export function SaveStatusIndicator() {
	const clientInfo = useAppSelector(getActiveClientInfo);
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const statusButtonRef = useRef<HTMLButtonElement>(null);
	const suppressNextTriggerClickRef = useRef(false);
	const [isPopoverOpen, setIsPopoverOpen] = useState(false);

	const opfsSync = clientInfo?.opfsSync;
	const status = getSaveStatus(activeSite, clientInfo);
	const isAutosaved = activeSite ? isAutosavedSite(activeSite) : false;
	const localFsAvailability = useLocalFsAvailability(clientInfo?.client);
	const canStorePermanently =
		isOpfsAvailable || localFsAvailability === 'available';

	const openSaveModal = () => {
		setIsPopoverOpen(false);
		dispatch(setSiteSlugToSave(activeSite?.slug));
		dispatch(setActiveModal(modalSlugs.SAVE_SITE));
	};

	const handleTriggerMouseDown = (
		event: React.MouseEvent<HTMLButtonElement>
	) => {
		if (!isPopoverOpen) {
			return;
		}
		// Closing on mousedown keeps the popover from immediately reopening
		// on the same click event that follows.
		event.preventDefault();
		event.stopPropagation();
		suppressNextTriggerClickRef.current = true;
		setIsPopoverOpen(false);
	};

	const handleTriggerClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		if (suppressNextTriggerClickRef.current) {
			suppressNextTriggerClickRef.current = false;
			return;
		}
		setIsPopoverOpen((isOpen) => !isOpen);
	};

	if (!status) {
		return null;
	}

	if (status === 'saved') {
		return (
			<div className={classNames(css.indicator, css.saved)}>
				<Icon icon={check} size={18} />
				<span className={css.label}>Saved Playground</span>
			</div>
		);
	}

	if (status === 'autosaved') {
		return (
			<>
				<button
					ref={statusButtonRef}
					className={classNames(
						css.indicator,
						css.autosaved,
						css.actionable
					)}
					onMouseDown={handleTriggerMouseDown}
					onClick={handleTriggerClick}
					aria-expanded={isPopoverOpen}
					type="button"
				>
					<Icon icon={backup} size={18} />
					<span className={css.label}>Autosaved</span>
				</button>
				{isPopoverOpen && (
					<Popover
						placement="bottom-end"
						onClose={() => setIsPopoverOpen(false)}
						anchor={statusButtonRef.current}
						focusOnMount="firstElement"
						className={css.popover}
					>
						<div className={css.popoverContent}>
							<div className={css.popoverTitle}>Autosaved</div>
							<p className={css.popoverDescription}>
								This Playground is saved in this browser with
								your recent autosaves. It will be deleted after{' '}
								{MAX_AUTOSAVED_SITES} newer autosaves unless you
								store it in this browser or a local directory.
							</p>
							<button
								className={css.primaryAction}
								onClick={openSaveModal}
								type="button"
							>
								Store permanently
							</button>
						</div>
					</Popover>
				)}
			</>
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
			<button
				className={classNames(css.indicator, css.error)}
				onClick={openSaveModal}
				type="button"
			>
				<Icon icon={cautionFilled} size={18} />
				<span className={css.label}>
					{opfsSync?.operation === 'autosave' || isAutosaved
						? 'Autosave failed'
						: 'Save failed'}
				</span>
			</button>
		);
	}

	return (
		<>
			<button
				ref={statusButtonRef}
				className={classNames(
					css.indicator,
					css.unsaved,
					css.actionable
				)}
				onMouseDown={handleTriggerMouseDown}
				onClick={handleTriggerClick}
				aria-expanded={isPopoverOpen}
				type="button"
			>
				<Icon icon={cautionFilled} size={18} />
				<span className={css.label}>Unsaved</span>
			</button>
			{isPopoverOpen && (
				<Popover
					placement="bottom-end"
					onClose={() => setIsPopoverOpen(false)}
					anchor={statusButtonRef.current}
					focusOnMount="firstElement"
					className={css.popover}
				>
					<div className={css.popoverContent}>
						<div className={css.popoverTitle}>Unsaved</div>
						<p className={css.popoverDescription}>
							This Playground is not stored anywhere. Changes are
							lost when this page is refreshed or closed.
						</p>
						{canStorePermanently && (
							<button
								className={css.primaryAction}
								onClick={openSaveModal}
								type="button"
							>
								Store permanently
							</button>
						)}
					</div>
				</Popover>
			)}
		</>
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
