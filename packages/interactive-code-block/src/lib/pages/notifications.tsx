import * as React from '@wordpress/element';

import { SnackbarList } from '@wordpress/components';
import { useSelect, useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';

export default function Notifications() {
	const notices = useSelect(
		(select) => (select(noticesStore) as any).getNotices(),
		[]
	);
	const { removeNotice } = useDispatch(noticesStore);
	const snackbarNotices = notices.filter(({ type }) => type === 'snackbar');
	return (
		<SnackbarList
			notices={snackbarNotices}
			className="interactive-code-block__snackbar-list"
			onRemove={removeNotice as any}
		/>
	);
}
