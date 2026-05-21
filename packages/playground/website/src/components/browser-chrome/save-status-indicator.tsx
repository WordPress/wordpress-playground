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

type SaveStatus = 'saved' | 'autosaved' | 'unsaved' | 'saving' | 'error';

function getSaveStatus(
	site: SiteInfo | undefined,
	clientInfo: ClientInfo | undefined
): SaveStatus {
	const opfsSync = clientInfo?.opfsSync;
	const isAutosaved = site ? isAutosavedSite(site) : false;
	if (isAutosaved && (!clientInfo || opfsSync?.status === 'syncing')) {
		return 'saving';
	}
	if (opfsSync?.status === 'syncing') {
		return 'saving';
	}
	if (opfsSync?.status === 'error') {
		return 'error';
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

function getSyncLabel({
	isAutosaved,
	progress,
}: {
	isAutosaved: boolean;
	progress: Extract<OpfsSync, { status: 'syncing' }>['progress'];
}) {
	if (isAutosaved) {
		if (progress) {
			return `Unsaved ${progress.files}/${progress.total}`;
		}
		return 'Unsaved';
	}
	if (
		progress?.phase === 'flushing' ||
		(progress && progress.total > 0 && progress.files >= progress.total)
	) {
		return 'Finalizing save...';
	}
	if (progress) {
		return `Saving ${progress.files}/${progress.total}...`;
	}
	return 'Saving...';
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
		return (
			<div
				className={classNames(
					css.indicator,
					isAutosaved ? css.unsaved : css.saving
				)}
			>
				<span className={css.spinner} />
				<span className={css.label}>
					{getSyncLabel({ isAutosaved, progress })}
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
					{isAutosaved ? 'Autosave failed' : 'Save failed'}
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
						<button
							className={css.primaryAction}
							onClick={handleSaveClick}
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
