import React, { useState, useEffect } from 'react';
import css from './style.module.css';
import AddressBar from '../address-bar';
import { close } from '@wordpress/icons';
import classNames from 'classnames';
import { usePlaygroundContext } from '../playground-viewport/context';

interface BrowserChromeProps {
	children?: React.ReactNode;
	toolbarButtons?: Array<React.ReactElement | false | null>;
	url?: string;
	showAddressBar?: boolean;
	initialIsFullSize?: boolean;
	storage?: string;
	onUrlChange?: (url: string) => void;
}

export default function BrowserChrome({
	children,
	url,
	onUrlChange,
	showAddressBar = true,
	toolbarButtons,
	initialIsFullSize = false,
	storage,
}: BrowserChromeProps) {
	const [isFullSize, setIsFullSize] = useState(initialIsFullSize);

	const addressBarClass = classNames(css.addressBarSlot, {
		[css.isHidden]: !showAddressBar,
	});
	const wrapperClass = classNames(css.wrapper, {
		[css.hasSmallWindow]: !isFullSize,
		[css.hasFullSizeWindow]: isFullSize,
	});

	const [noticeHidden, setNoticeHidden] = useState(
		document.cookie.includes('hideExperimentalNotice=true')
	);

	const hideNotice = () => {
		document.cookie = 'hideExperimentalNotice=true';
		setNoticeHidden(true);
	};
	useEffect(() => {
		const hideNoticeTimeout = setTimeout(hideNotice, 20000);
		return () => {
			clearTimeout(hideNoticeTimeout);
		};
	}, []);

	const { playground } = usePlaygroundContext();

	const opfsStorages = ['browser', 'device'];

	const experimentalNoticeClass = classNames(css.experimentalNotice, {
		[css.isHidden]: noticeHidden,
	});

	return (
		<div className={wrapperClass} data-cy="simulated-browser">
			<div className={css.window}>
				<header className={css.toolbar} aria-label="Playground toolbar">
					<div className={css.windowControls}>
						<div
							className={`${css.windowControl} ${css.isRed}`}
							onClick={async () => {
								if (
									!window.confirm(
										'This will wipe out all data and start a new site. Do you want to proceed?'
									)
								) {
									return;
								}
								if (opfsStorages.includes(storage)) {
									await playground?.resetVirtualOpfs();
								}
								window.location.reload();
							}}
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
				</header>
				<div className={css.content}>{children}</div>
				<div className={experimentalNoticeClass} onClick={hideNotice}>
					{close}
					This is a cool fun experimental WordPress running in your
					browser :) All your changes are private and gone after a
					page refresh.
				</div>
			</div>
		</div>
	);
}
