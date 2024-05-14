import React from 'react';

import './Loader.scss';
import { Spinner } from '@wordpress/components';

export const Loader = () => {
	return (
		<div className="loader">
			<Spinner />
		</div>
	);
};
