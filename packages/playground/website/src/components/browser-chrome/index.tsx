import React from 'react';
import Toast from '../Toast';
import css from './style.module.css';
import AddressBar from '../address-bar';
import classNames from 'classnames';

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
	const addressBarClass = classNames(css.addressBarSlot, {
		[css.isHidden]: !showAddressBar,
	});
	
	return (
		<div className={css.wrapper}>
			<div className={css.window}>
				<div className={css.toolbar}>
					<WindowControls />
					<div className={addressBarClass}>
						<AddressBar url={url} onUpdate={onUrlChange} />
					</div>
					<Toast />
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

