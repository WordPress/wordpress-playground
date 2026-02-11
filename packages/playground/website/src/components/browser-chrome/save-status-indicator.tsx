import React from 'react';
import css from './save-status-indicator.module.css';
import classNames from 'classnames';
import {
	useAppSelector,
	getActiveClientInfo,
	useActiveSite,
} from '../../lib/state/redux/store';
import { Icon } from '@wordpress/components';
import { check, cautionFilled } from '@wordpress/icons';
import { isOpfsAvailable } from '../../lib/state/opfs/opfs-site-storage';

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

	const storage = activeSite?.metadata?.storage;
	const opfsSync = clientInfo?.opfsSync;
	const status = getSaveStatus(storage, opfsSync);

	if (status === 'saved') {
		return (
			<div className={classNames(css.indicator, css.saved)}>
				<Icon icon={check} size={18} />
				<span className={css.label}>Saved Playground</span>
			</div>
		);
	}

	if (status === 'error') {
		return (
			<div className={classNames(css.indicator, css.error)}>
				<Icon icon={cautionFilled} size={18} />
				<span className={css.label}>Save failed</span>
			</div>
		);
	}

	// Saving — either auto-save just started or sync is in progress.
	if (status === 'saving' || (status === 'unsaved' && isOpfsAvailable)) {
		const progress =
			opfsSync?.status === 'syncing'
				? (opfsSync as any).progress
				: undefined;
		const pct =
			progress && progress.total > 0
				? Math.round((progress.files / progress.total) * 100)
				: 0;
		return (
			<div
				className={classNames(css.indicator, css.saving)}
				style={
					{
						'--save-progress': `${pct}%`,
					} as React.CSSProperties
				}
			>
				<span className={css.label}>Saving Playground</span>
			</div>
		);
	}

	// No OPFS — truly unsaved, no auto-save possible.
	return (
		<div className={classNames(css.indicator, css.unsaved)}>
			<Icon icon={cautionFilled} size={18} />
			<span className={css.label}>Unsaved Playground</span>
		</div>
	);
}
