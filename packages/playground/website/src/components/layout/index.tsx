import css from './style.module.css';

import { SiteView } from '../site-view/site-view';
import { SiteManager } from '../site-manager';
import { useRef } from '@wordpress/element';
import { CSSTransition } from 'react-transition-group';
import { __experimentalUseNavigator as useNavigator } from '@wordpress/components';
import { useAppSelector } from '../../lib/redux-store';
import { PlaygroundConfiguration } from '../playground-configuration-group/form';

export function Layout() {
	const siteViewRef = useRef<HTMLDivElement>(null);

	const activeSite = useAppSelector((state) => state.activeSite!);
	const blueprint = activeSite.originalBlueprint || {};
	const storage = activeSite.storage;
	// @TODO: Use SiteMetadata directly
	const currentConfiguration: PlaygroundConfiguration = {
		storage: storage ?? 'none',
		wp: activeSite.wpVersion,
		php: activeSite.phpVersion,
		withExtensions: activeSite.phpExtensionBundle === 'kitchen-sink',
		withNetworking: blueprint?.features?.networking || false,
		resetSite: false,
	};

	const {
		goTo,
		location: { path },
	} = useNavigator();

	return (
		<div className={css.layout}>
			{/* We could use the <NavigatorScreen /> component here, but it doesn't
			    seem to play well with CSSTransition. */}
			<CSSTransition
				in={path?.startsWith('/manager')}
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
					<SiteManager siteViewRef={siteViewRef} />
				</div>
			</CSSTransition>
			<div className={css.siteView}>
				{path?.startsWith('/manager') && (
					<div
						className={css.siteViewOverlay}
						onClick={() => goTo('/')}
					/>
				)}
				<SiteView
					siteViewRef={siteViewRef}
					blueprint={blueprint}
					currentConfiguration={currentConfiguration}
					storage={storage}
					className={css.siteViewContent}
					hideToolbar={path?.startsWith('/manager')}
				/>
			</div>
		</div>
	);
}
