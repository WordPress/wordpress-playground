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

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

function getSaveStatus(
	storage: string | undefined,
	opfsSync: { status: string } | undefined
): SaveStatus {
	if (opfsSync?.status === 'syncing') {
		return 'saving';
	}
	if (opfsSync?.status === 'error') {
		return 'error';
	}
	if (storage === 'none' || !storage) {
		return 'unsaved';
	}
	return 'saved';
}

export function SaveStatusIndicator() {
	const clientInfo = useAppSelector(getActiveClientInfo);
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();

	const storage = activeSite?.metadata?.storage;
	const opfsSync = clientInfo?.opfsSync;
	const status = getSaveStatus(storage, opfsSync);

	const handleSaveClick = () => {
		dispatch(setActiveModal(modalSlugs.SAVE_SITE));
	};

	if (status === 'saved') {
		return (
			<div className={classNames(css.indicator, css.saved)}>
				<Icon icon={check} size={18} />
				<span className={css.label}>Saved Playground</span>
			</div>
		);
	}

	if (status === 'saving') {
		const progress =
			opfsSync?.status === 'syncing'
				? (opfsSync as any).progress
				: undefined;
		return (
			<div className={classNames(css.indicator, css.saving)}>
				<span className={css.spinner} />
				<span className={css.label}>
					{progress
						? `Saving ${progress.files}/${progress.total}...`
						: 'Saving...'}
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
				<span className={css.label}>Save failed</span>
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
