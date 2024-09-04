import css from './style.module.css';

import { SiteView } from '../site-view/site-view';
import { SiteManager } from '../site-manager';
import { useRef } from '@wordpress/element';
import { CSSTransition } from 'react-transition-group';
import { __experimentalUseNavigator as useNavigator } from '@wordpress/components';
import { Blueprint, PlaygroundClient } from '@wp-playground/client';
import { StorageType } from '../../types';
import { PlaygroundConfiguration } from '../playground-configuration-group/form';

export function Layout({
	playground,
	url,
	iframeRef,
	blueprint,
	storage,
	currentConfiguration,
	siteSlug,
	setSiteSlug,
}: {
	playground: PlaygroundClient;
	url: string;
	iframeRef: React.RefObject<HTMLIFrameElement>;
	blueprint: Blueprint;
	storage: StorageType;
	currentConfiguration: PlaygroundConfiguration;
	siteSlug: string | undefined;
	setSiteSlug: (siteSlug?: string) => void;
}) {
	const siteViewRef = useRef<HTMLDivElement>(null);

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
					<SiteManager
						onSiteChange={setSiteSlug}
						siteViewRef={siteViewRef}
					/>
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
					playground={playground}
					url={url}
					iframeRef={iframeRef}
					className={css.siteViewContent}
					hideToolbar={path?.startsWith('/manager')}
				/>
			</div>
		</div>
	);
}
