import React, { useEffect, useState } from 'react';

import './Loader.scss';
import { Notice, Spinner } from '@wordpress/components';

export const Loader = () => {
	const [showNotice, setShowNotice] = useState(false);
	useEffect(() => {
		// Prompt user to allow the camera access
		const noticeTimeout = setTimeout(() => {
			setShowNotice(true);
		}, 5000);
		return () => {
			setShowNotice(false);
			clearTimeout(noticeTimeout);
		};
	}, []);
	return (
		<div className="loader">
			{showNotice && (
				<Notice
					status="warning"
					isDismissible
					className="scan__error"
					onRemove={() => setShowNotice(false)}
				>
					Allow camera access to scan the puzzle.
				</Notice>
			)}
			<Spinner />
		</div>
	);
};
