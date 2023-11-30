import React, { useState } from 'react';
import css from './style.module.css';
import AddressBar from '../address-bar';
import classNames from 'classnames';

interface BrowserChromeProps {
	children?: React.ReactNode;
	toolbarButtons?: Array<React.ReactElement | false | null>;
	url?: string;
	showAddressBar?: boolean;
	initialIsFullSize?: boolean;
	onUrlChange?: (url: string) => void;
}

export default function BrowserChrome({
	children,
	url,
	onUrlChange,
	showAddressBar = true,
	toolbarButtons,
	initialIsFullSize = false,
}: BrowserChromeProps) {
	const [isFullSize, setIsFullSize] = useState(initialIsFullSize);

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
					<div className={css.windowControls}>
						<div
							className={`${css.windowControl} ${css.isNeutral}`}
						></div>
						<div
							className={`${css.windowControl} ${css.isNeutral}`}
						></div>
						<div
							className={`${css.windowControl} ${css.isGreen} ${css.isActive}`}
							onClick={() => setIsFullSize(!isFullSize)}
						></div>
					</div>

					<div className={addressBarClass}>
						<AddressBar url={url} onUpdate={onUrlChange} />
					</div>

					<div className={css.toolbarButtons}>{toolbarButtons}</div>
				</div>
				<div className={css.content}>{children}</div>
			</div>
		</div>
	);
}
