import css from './style.module.css';

import { CSSTransition } from 'react-transition-group';
import type { PlaygroundReduxState } from '../../lib/state/redux/store';
import { useAppSelector } from '../../lib/state/redux/store';
import { useRef } from 'react';
import { LogModal } from '../log-modal';
import { StartErrorModal } from '../start-error-modal';
import type { DisplayMode } from '../playground-viewport';
import {
	supportedDisplayModes,
	PlaygroundViewport,
} from '../playground-viewport';
import { MissingSiteModal } from '../missing-site-modal';
import { modalSlugs } from '../../lib/state/redux/slice-ui';
import { SiteManager } from '../site-manager';
import { useAutoBackup } from '../../lib/hooks/use-auto-backup';

const displayMode = getDisplayModeFromQuery();
function getDisplayModeFromQuery(): DisplayMode {
	const query = new URLSearchParams(document.location.search);
	return supportedDisplayModes.includes(query.get('mode') as any)
		? (query.get('mode') as DisplayMode)
		: 'browser-full-screen';
}

export function Layout() {
	const siteManagerIsOpen = useAppSelector(
		(state) => state.ui.siteManagerIsOpen
	);
	const siteManagerWrapperRef = useRef<HTMLDivElement>(null);

	useAutoBackup();

	return (
		<div className={`${css.layout}`}>
			<Modals />
			<CSSTransition
				nodeRef={siteManagerWrapperRef}
				in={siteManagerIsOpen}
				timeout={500}
				classNames={{
					enter: css.siteManagerWrapperEnter,
					enterActive: css.siteManagerWrapperEnterActive,
					exit: css.siteManagerWrapperExit,
					exitActive: css.siteManagerWrapperExitActive,
				}}
				unmountOnExit
			>
				<div
					ref={siteManagerWrapperRef}
					className={css.siteManagerWrapper}
				>
					<SiteManager />
				</div>
			</CSSTransition>
			<div className={css.siteView}>
				<div className={css.siteViewContent}>
					<PlaygroundViewport displayMode={displayMode} />
				</div>
			</div>
		</div>
	);
}

function Modals() {
	const currentModal = useAppSelector(
		(state: PlaygroundReduxState) => state.ui.activeModal
	);

	if (currentModal === modalSlugs.LOG) {
		return <LogModal />;
	} else if (currentModal === modalSlugs.START_ERROR) {
		return <StartErrorModal />;
	} else if (currentModal === modalSlugs.MISSING_SITE_PROMPT) {
		return <MissingSiteModal />;
	}

	return;
}
