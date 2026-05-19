import { useState, useEffect } from 'react';
import css from './sharing-status-indicator.module.css';
import { useAppDispatch } from '../../lib/state/redux/store';
import { modalSlugs, setActiveModal } from '../../lib/state/redux/slice-ui';
import {
	getSharingStatus,
	subscribeToSharingStatus,
	type SharingStatus,
} from '../../lib/sharing-service';

export function SharingStatusIndicator() {
	const dispatch = useAppDispatch();
	const [sharingStatus, setSharingStatus] = useState<SharingStatus>(() =>
		getSharingStatus()
	);

	useEffect(() => {
		const unsubscribe = subscribeToSharingStatus(setSharingStatus);
		return unsubscribe;
	}, []);

	const handleClick = () => {
		dispatch(setActiveModal(modalSlugs.SHARE_PLAYGROUND));
	};

	// Only show when actively sharing (connected)
	if (!sharingStatus.isActive || sharingStatus.status !== 'connected') {
		return null;
	}

	return (
		<button
			className={css.indicator}
			onClick={handleClick}
			type="button"
			title="Click to manage sharing"
		>
			<span className={css.liveDot} />
			<span className={css.label}>Sharing</span>
		</button>
	);
}
