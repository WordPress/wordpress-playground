import React from 'react';
import { Icon, wordpress } from '@wordpress/icons';

import './Footer.scss';

export const Footer = () => {
	return (
		<footer className="footer">
			Powered by <Icon icon={wordpress} />
			<a
				href="https://wordpress.org/playground/"
				target="_blank"
				rel="noreferrer"
			>
				WordPress Playground
			</a>
		</footer>
	);
};
