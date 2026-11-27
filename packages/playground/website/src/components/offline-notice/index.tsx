import { Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import css from './style.module.css';

export function OfflineNotice() {
	return (
		<Notice
			status="warning"
			isDismissible={false}
			className={css.offlineNotice}
		>
			{__(
				'Some features may not be available because you are offline.',
				'playground-website'
			)}
		</Notice>
	);
}
