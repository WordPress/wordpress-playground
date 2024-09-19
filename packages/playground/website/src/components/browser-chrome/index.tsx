import React, { useState } from 'react';
import css from './style.module.css';
import AddressBar from '../address-bar';
import classNames from 'classnames';
import { OpenSiteManagerButton } from '../open-site-manager-button';
import { Button, Modal } from '@wordpress/components';
import { createLogger } from 'vite';

interface BrowserChromeProps {
	children?: React.ReactNode;
	toolbarButtons?: Array<React.ReactElement | false | null>;
	url?: string;
	showAddressBar?: boolean;
	onUrlChange?: (url: string) => void;
	hideToolbar?: boolean;
	className?: string;
}

export default function BrowserChrome({
	children,
	url,
	onUrlChange,
	showAddressBar = true,
	toolbarButtons,
	hideToolbar,
	className,
}: BrowserChromeProps) {
	const addressBarClass = classNames(css.addressBarSlot, {
		[css.isHidden]: !showAddressBar,
	});
	const wrapperClass = classNames(css.wrapper, css.hasFullSizeWindow);

	const query = new URL(document.location.href).searchParams;

	const [isModalClosed, setIsModalClosed] = useState(
		query.get('onboarding') === '0' ||
			document.cookie.includes('hideExperimentalNotice=true')
	);

	const hideModal = () => {
		setIsModalClosed(true);
		document.cookie = 'hideExperimentalNotice=true';
	};

	/**
	 * Temporary feature flag to enable the site manager
	 * while using browser storage.
	 *
	 * TODO: Remove this once the site manager supports all storage options.
	 */
	const searchQuery = new URLSearchParams(window.location.search);
	const showSiteManager = searchQuery.get('storage') === 'browser';

	return (
		<div
			className={`${wrapperClass} ${className}`}
			data-cy="simulated-browser"
		>
			<div className={`${css.window} browser-chrome-window`}>
				<header
					className={`${css.toolbar} ${
						showSiteManager ? css.hasSiteManager : ''
					} ${hideToolbar ? css.toolbarHidden : ''}`}
					aria-label="Playground toolbar"
				>
					<div className={css.windowControls}>
						{showSiteManager && <OpenSiteManagerButton />}
						{!showSiteManager && (
							<>
								<div
									className={`${css.windowControl} ${css.isNeutral}`}
								></div>
								<div
									className={`${css.windowControl} ${css.isNeutral}`}
								></div>
								<div
									className={`${css.windowControl} ${css.isNeutral}`}
								></div>
							</>
						)}
					</div>

					<div className={addressBarClass}>
						<AddressBar url={url} onUpdate={onUrlChange} />
					</div>

					<div className={css.toolbarButtons}>{toolbarButtons}</div>
				</header>
				<div className={css.content}>{children}</div>
				{!isModalClosed && (
					<Modal title="Howdy!" onRequestClose={hideModal}>
						<p>
							This is a cool and fun experimental WordPress
							running in your browser.
						</p>
						<p>
							{' '}
							All your changes are private and gone after a page
							refresh.
						</p>
						<p>
							<Button variant="primary" onClick={hideModal}>
								Ok, let's go! 🚀
							</Button>
						</p>
					</Modal>
				)}
			</div>
		</div>
	);
}
