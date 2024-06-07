import { Button, Spinner } from '@wordpress/components';
import { capturePhoto } from '@wordpress/icons';
import React, { useState } from 'react';
import { useScanContext } from '../../context/scan';

import { getImageFromVideo } from '../../site-builder/image';

import './ScanButton.scss';
import { readImageContent } from '../../site-builder/api';

export const ScanButton = ({ onSuccess }: { onSuccess: Function }) => {
	const { videoElement, scanArea, setError } = useScanContext();
	const [loading, setLoading] = useState(false);

	const onClick = async () => {
		if (!videoElement) {
			return;
		}

		const image = getImageFromVideo(videoElement, scanArea);
		if (!image) {
			return;
		}

		setLoading(true);
		setError(null);

		readImageContent(image)
			.then((response) => {
				if (typeof onSuccess === 'function') {
					onSuccess(response);
				}
			})
			.catch((error) => {
				setError(error.message);
			})
			.finally(() => {
				setLoading(false);
			});
	};

	const classNames = ['scan__button'];
	if (loading) {
		classNames.push('scan__button--loading');
	}
	return (
		<div className={classNames.join(' ')}>
			<Button
				onClick={onClick}
				variant="primary"
				icon={capturePhoto}
				disabled={loading}
			>
				{loading && <Spinner />}
			</Button>
		</div>
	);
};
