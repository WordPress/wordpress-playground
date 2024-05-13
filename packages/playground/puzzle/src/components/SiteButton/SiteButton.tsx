import { Button } from '@wordpress/components';
import './SiteButton.scss';
import { check, wordpress } from '@wordpress/icons';
import React, { useEffect, useState } from 'react';

const mainCta = 'Take me to my site';

export const SiteButton = ({ onClick, newAction, isBusy }) => {
	const [title, setTitle] = useState<string>();

	useEffect(() => {
		if (newAction) {
			setTitle('Added ' + newAction.title);
		} else {
			setTitle(mainCta);
		}
	}, [newAction]);

	if (!title) {
		return null;
	}

	const classNames = ['scan__action'];
	let icon = wordpress;
	if (title !== mainCta) {
		classNames.push('scan__action--success');
		icon = check;
	}

	return (
		<Button
			onClick={onClick}
			variant="secondary"
			className={classNames.join(' ')}
			icon={icon}
			isBusy={isBusy}
		>
			{title}
		</Button>
	);
};
