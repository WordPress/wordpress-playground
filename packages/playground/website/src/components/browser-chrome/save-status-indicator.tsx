import React, { useRef, useState } from 'react';
import css from './save-status-indicator.module.css';
import classNames from 'classnames';
import {
	useAppSelector,
	getActiveClientInfo,
	useActiveSite,
	useAppDispatch,
} from '../../lib/state/redux/store';
import { modalSlugs, setActiveModal } from '../../lib/state/redux/slice-ui';
import { Icon, Popover } from '@wordpress/components';
import { backup, check, cautionFilled } from '@wordpress/icons';
import {
	isAutosavedSite,
	preserveSite,
	type SiteInfo,
} from '../../lib/state/redux/slice-sites';
import type { ClientInfo, OpfsSync } from '../../lib/state/redux/slice-clients';
import { isOpfsAvailable } from '../../lib/state/opfs/opfs-site-storage';
import { useLocalFsAvailability } from '../../lib/hooks/use-local-fs-availability';

type SaveStatus = 'saved' | 'autosaved' | 'unsaved' | 'saving' | 'error';

/**
 * Returns the status shown by the save indicator for the active Playground.
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
 * Returns the in-progress label for the save indicator.
 */
function getSyncLabel({
	site,
	opfsSync,
}: {
	site: SiteInfo | undefined;
	opfsSync: OpfsSync | undefined;
}) {
	return opfsSync?.operation === 'autosave' ||
		(site &&
			(isAutosavedSite(site) || site.metadata.initialOpfsSyncPending))
		? 'Autosaving'
		: 'Saving';
}

/**
 * Returns a bounded integer percentage for OPFS sync progress.
 */
function getProgressPercent(
	progress: Extract<OpfsSync, { status: 'syncing' }>['progress']
) {
	if (!progress || progress.total <= 0) {
		return 0;
	}
	return Math.min(100, Math.round((progress.files / progress.total) * 100));
}

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

	const handleSaveClick = () => {
		setIsPopoverOpen(false);
		dispatch(setActiveModal(modalSlugs.SAVE_SITE));
	};

	const handleKeepClick = () => {
		setIsPopoverOpen(false);
		if (activeSite) {
			void dispatch(preserveSite(activeSite.slug));
		}
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
								your recent autosaves. It will be deleted after
								5 newer autosaves unless you store it
								permanently.
							</p>
							<button
								className={css.primaryAction}
								onClick={handleKeepClick}
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
				onClick={handleSaveClick}
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

	// Unsaved - temporary playground that will be lost on refresh
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
								onClick={handleSaveClick}
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
