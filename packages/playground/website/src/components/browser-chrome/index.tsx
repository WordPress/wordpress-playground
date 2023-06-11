import React from 'react';
import Modal from '../modal';
import css from './style.module.css';
import AddressBar from '../address-bar';
import classNames from 'classnames';
import util from "../../util/util.js";

interface BrowserChromeProps {
	children?: React.ReactNode;
	toolbarButtons?: React.ReactElement[];
	url?: string;
	showAddressBar?: boolean;
	onUrlChange?: (url: string) => void;
}

// Check if the user is onboarding for the first time.
const isOnboarding = util.isOnboardedFirstTime();

// Welcome message to be displayed in the modal.
const WELCOME_MSG = `Welcome to our brand new WordPress Plyground website! We are thrilled to have you here. 
Whether you're a first-time visitor or a returning customer, we would like to remind you once:`

// Reminder message to be displayed in the modal.
const REMINDER = `All your modifications made here are private, and stored temporarily in the session and will be lost upon refreshing the page.`;

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
					{!isOnboarding && (
						<Modal>
							<div>
								  {WELCOME_MSG}
								<br></br>
								<p>
									<strong>{REMINDER}</strong>
								</p>
							</div>
						</Modal>
					)}
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
