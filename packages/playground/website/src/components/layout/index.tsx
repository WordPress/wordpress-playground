import css from './style.module.css';

import { SiteView } from '../site-view/site-view';
import { SiteManager } from '../site-manager';
import { CSSTransition } from 'react-transition-group';
import {
	useAppSelector,
	useAppDispatch,
	setSiteManagerIsOpen,
} from '../../lib/redux-store';

export function Layout() {
	const siteManagerIsOpen = useAppSelector(
		(state) => state.siteManagerIsOpen
	);
	const activeSite = useAppSelector((state) => state.activeSite!);
	const blueprint = activeSite.metadata.originalBlueprint || {};
	const storage = activeSite.storage;

	const dispatch = useAppDispatch();

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
