import css from './style.module.css';

import { SiteView } from '../site-view/site-view';
import { SiteManager } from '../site-manager';
import { CSSTransition } from 'react-transition-group';
import {
	useAppSelector,
	useAppDispatch,
	setSiteManagerIsOpen,
	useActiveSite,
} from '../../lib/redux-store';

export function Layout() {
	const siteManagerIsOpen = useAppSelector(
		(state) => state.siteManagerIsOpen
	);
	const dispatch = useAppDispatch();
	const activeSite = useActiveSite()!;
	if (!activeSite) {
		// @TODO: Why does this happen for a brief moment when updating a local site?
		return null;
	}
	const blueprint = activeSite.metadata.originalBlueprint || {};
	const storage = activeSite.metadata.storage;

	return (
		<div className={css.layout}>
			<CSSTransition
				in={siteManagerIsOpen}
				timeout={500}
				classNames={{
					enter: css.sidebarEnter,
					enterActive: css.sidebarEnterActive,
					exit: css.sidebarExit,
					exitActive: css.sidebarExitActive,
				}}
				unmountOnExit
			>
				<div className={css.sidebar}>
					<SiteManager />
				</div>
			</CSSTransition>
			<div className={css.siteView}>
				{siteManagerIsOpen && (
					<div
						className={css.siteViewOverlay}
						onClick={() => {
							dispatch(setSiteManagerIsOpen(false));
						}}
					/>
				)}
				<SiteView
					blueprint={blueprint}
					storage={storage}
					className={css.siteViewContent}
					hideToolbar={siteManagerIsOpen}
				/>
			</div>
		</div>
	);
}
