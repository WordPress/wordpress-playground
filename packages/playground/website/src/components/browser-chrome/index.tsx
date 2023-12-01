import React from 'react';
import css from './style.module.css';
import AddressBar from '../address-bar';
import classNames from 'classnames';

interface BrowserChromeProps {
	children?: React.ReactNode;
	toolbarButtons?: Array<React.ReactElement | false | null>;
	url?: string;
	showAddressBar?: boolean;
	isFullSize?: boolean;
	onUrlChange?: (url: string) => void;
}

export default function BrowserChrome({
	children,
	url,
	onUrlChange,
	isFullSize,
	showAddressBar = true,
	toolbarButtons,
}: BrowserChromeProps) {
	const addressBarClass = classNames(css.addressBarSlot, {
		[css.isHidden]: !showAddressBar,
	});
	const wrapperClass = classNames(css.wrapper, {
		[css.hasSmallWindow]: !isFullSize,
		[css.hasFullSizeWindow]: isFullSize,
	});
	return (
		<div className={wrapperClass} data-cy="simulated-browser">
			<div className={css.window}>
				<div className={css.toolbar}>
					<WindowControls />

					<div className={addressBarClass}>
						<AddressBar url={url} onUpdate={onUrlChange} />
					</div>

					<div className={css.toolbarButtons}>{toolbarButtons}</div>
				</div>
				<div className={css.content}>{children}</div>
				<div className={css.experimentalNotice}>
					This is a cool fun experimental WordPress running in your
					browser :) All your changes are private and gone after a
					page refresh.
				</div>
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
