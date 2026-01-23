import { Notice } from '@wordpress/components';
import css from './style.module.css';

export function OfflineNotice() {
	return (
		<Notice
			status="warning"
			isDismissible={false}
			className={css.offlineNotice}
		>
			Some features may not available because you are offline.
		</Notice>
	);
}
