import React from 'react';
import css from './style.module.css';
import AddressBar from '../address-bar';
import classNames from 'classnames';
import {
	useAppSelector,
	getActiveClientInfo,
} from '../../lib/state/redux/store';
import {
	SavedPlaygroundsOverlay,
	type OverlayViewMode,
} from '../saved-playgrounds-overlay';
import { SaveStatusIndicator } from './save-status-indicator';
import { isSiteSavingDisabled } from '../../lib/state/url/router';
import { Dock } from '../dock';

const query = new URL(document.location.href).searchParams;
const overlayParam = query.get('overlay');
const shouldOpenOverlay = overlayParam !== null;
const isSavingDisabled = isSiteSavingDisabled();

interface BrowserChromeProps {
	children?: React.ReactNode;
	className?: string;
}

export default function BrowserChrome({
	children,
	className,
}: BrowserChromeProps) {
	const clientInfo = useAppSelector(getActiveClientInfo);
	const showAddressBar = !!clientInfo;
	const url = clientInfo?.url;
	const addressBarClass = classNames(css.addressBarSlot, {
		[css.isHidden]: !showAddressBar,
	});
	const wrapperClass = classNames(
		css.wrapper,
		css.hasFullSizeWindow,
		className
	);
	const [isPlaygroundsOverlayOpen, setIsPlaygroundsOverlayOpen] =
		React.useState(shouldOpenOverlay);
	const [overlayInitialViewMode, setOverlayInitialViewMode] =
		React.useState<OverlayViewMode>(
			overlayParam === 'blueprints' ? 'blueprints' : 'main'
		);
	const closePlaygroundsOverlay = () => {
		setIsPlaygroundsOverlayOpen(false);
		setOverlayInitialViewMode('main'); // Reset for next manual open

		// Remove overlay parameter from URL so reload doesn't reopen overlay
		const url = new URL(window.location.href);
		if (url.searchParams.has('overlay')) {
			url.searchParams.delete('overlay');
			window.history.replaceState({}, '', url.toString());
		}
	};

	return (
		<div className={wrapperClass} data-cy="simulated-browser">
			<div className={`${css.window} browser-chrome-window`}>
				<header className={css.toolbar} aria-label="Playground toolbar">
					<div className={addressBarClass}>
						<AddressBar
							url={url}
							onUpdate={(newUrl) =>
								clientInfo?.client.goTo(newUrl)
							}
						/>
					</div>

					{!isSavingDisabled && <SaveStatusIndicator />}
				</header>
				<div className={css.content}>{children}</div>
				<Dock
					onOpenPlaygrounds={() => {
						setOverlayInitialViewMode('main');
						setIsPlaygroundsOverlayOpen(true);
					}}
					onOpenBlueprints={() => {
						setOverlayInitialViewMode('blueprints');
						setIsPlaygroundsOverlayOpen(true);
					}}
				/>
			</div>
			{isPlaygroundsOverlayOpen && (
				<SavedPlaygroundsOverlay
					onClose={closePlaygroundsOverlay}
					initialViewMode={overlayInitialViewMode}
				/>
			)}
		</div>
	);
}
