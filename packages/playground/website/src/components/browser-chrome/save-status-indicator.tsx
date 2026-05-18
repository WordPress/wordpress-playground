import React from 'react';
import css from './save-status-indicator.module.css';
import classNames from 'classnames';
import {
	useAppSelector,
	getActiveClientInfo,
	useActiveSite,
	useAppDispatch,
} from '../../lib/state/redux/store';
import { modalSlugs, setActiveModal } from '../../lib/state/redux/slice-ui';
import { Icon } from '@wordpress/components';
import { check, cautionFilled } from '@wordpress/icons';
import {
	isAutosavedSite,
	preserveSite,
	type SiteInfo,
} from '../../lib/state/redux/slice-sites';
import type { OpfsSync } from '../../lib/state/redux/slice-clients';

type SaveStatus = 'saved' | 'autosaved' | 'unsaved' | 'saving' | 'error';

function getSaveStatus(
	site: SiteInfo | undefined,
	opfsSync: OpfsSync | undefined
): SaveStatus {
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
	if (site && isAutosavedSite(site)) {
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
	if (
		progress?.phase === 'flushing' ||
		(progress && progress.total > 0 && progress.files >= progress.total)
	) {
		return isAutosaved ? 'Finalizing autosave...' : 'Finalizing save...';
	}
	if (progress) {
		return isAutosaved
			? `Autosaving ${progress.files}/${progress.total}...`
			: `Saving ${progress.files}/${progress.total}...`;
	}
	return isAutosaved ? 'Autosaving...' : 'Saving...';
}

export function SaveStatusIndicator() {
	const clientInfo = useAppSelector(getActiveClientInfo);
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();

	const opfsSync = clientInfo?.opfsSync;
	const status = getSaveStatus(activeSite, opfsSync);
	const isAutosaved = activeSite ? isAutosavedSite(activeSite) : false;

	const handleSaveClick = () => {
		dispatch(setActiveModal(modalSlugs.SAVE_SITE));
	};

	const handleKeepClick = () => {
		if (activeSite) {
			void dispatch(preserveSite(activeSite.slug));
		}
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
			<div className={classNames(css.indicator, css.autosaved)}>
				<Icon icon={check} size={18} />
				<span className={css.label}>Autosaved Playground</span>
				<button
					className={css.saveButton}
					onClick={handleKeepClick}
					type="button"
				>
					Keep
				</button>
			</div>
		);
	}

	if (status === 'saving') {
		const progress =
			opfsSync?.status === 'syncing' ? opfsSync.progress : undefined;
		return (
			<div className={classNames(css.indicator, css.saving)}>
				<span className={css.spinner} />
				<span className={css.label}>
					{getSyncLabel({ isAutosaved, progress })}
				</span>
				{isAutosaved && (
					<button
						className={css.saveButton}
						onClick={handleKeepClick}
						type="button"
					>
						Keep
					</button>
				)}
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
		<div className={classNames(css.indicator, css.unsaved)}>
			<Icon icon={cautionFilled} size={18} />
			<span className={css.label}>Unsaved Playground</span>
			<button
				className={css.saveButton}
				onClick={handleSaveClick}
				type="button"
			>
				Save
			</button>
		</div>
	);
}
