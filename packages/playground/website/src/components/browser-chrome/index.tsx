import React, { useEffect } from 'react';
import Toast from '../Toast';
import css from './style.module.css';
import AddressBar from '../address-bar';
import classNames from 'classnames';
import useQuery from '../../hooks/useQuery';
import { setCookie, getCookie } from '../../util/util';

interface BrowserChromeProps {
	children?: React.ReactNode;
	toolbarButtons?: React.ReactElement[];
	url?: string;
	showAddressBar?: boolean;
	onUrlChange?: (url: string) => void;
}

export default function BrowserChrome({
	children,
	url,
	onUrlChange,
	showAddressBar = true,
	toolbarButtons,
}: BrowserChromeProps) {
	// Check if the user is onboarding for the first time.
	const onBoarding = useQuery('onBoarding');

	// Show the toast message.
	const [showToast, setShowToast] = React.useState(false);

	const addressBarClass = classNames(css.addressBarSlot, {
		[css.isHidden]: !showAddressBar,
	});

	useEffect(() => {
		if (onBoarding && parseInt(onBoarding) === 1) {
			const isOnboarded = getCookie('onBoarding');
			if (isOnboarded !== '1') {
				setCookie('onBoarding', '1', 1);
				setShowToast(true);
			} else {
				setShowToast(false);
			}
		}
	}, [onBoarding]);
	
	return (
		<div className={css.wrapper}>
			<div className={css.window}>
				<div className={css.toolbar}>
					<WindowControls />
					<div className={addressBarClass}>
						<AddressBar url={url} onUpdate={onUrlChange} />
					</div>
					{showToast && <Toast />} 
					<div className={css.toolbarButtons}>
						{toolbarButtons?.map(
							(button: React.ReactElement, idx) =>
								React.cloneElement(button, {
									key: button.key || idx,
								})
						)}
					</div>
				</div>
				<div className={css.content}>{children}</div>
			</div>
		</div>
	);
}

function WindowControls() {
	return (
		<div className={css.windowControls}>
			<div className={`${css.windowControl} ${css.isNeutral}`}></div>
			<div className={`${css.windowControl} ${css.isNeutral}`}></div>
			<div className={`${css.windowControl} ${css.isNeutral}`}></div>
		</div>
	);
}

