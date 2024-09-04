import { createRoot } from 'react-dom/client';
import './styles.css';
import css from './style.module.css';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { SiteView } from './components/site-view/site-view';
import { SiteManager } from './components/site-manager';
import { Provider } from 'react-redux';
import { useEffect } from '@wordpress/element';
import store from './lib/webapp-state/redux-store';
import {
	__experimentalNavigatorProvider as NavigatorProvider,
	__experimentalNavigatorScreen as NavigatorScreen,
} from '@wordpress/components';
import { resolveRuntimeConfiguration } from './lib/webapp-state/resolve-configuration-from-url';

collectWindowErrors(logger);

function Main() {
	useEffect(() => {
		async function init() {
			const config = await resolveRuntimeConfiguration(
				new URL(document.location.href)
			);

			if (
				config.runtime.siteSlug &&
				config.runtime.storage !== 'browser'
			) {
				alert(
					'Site slugs only work with browser storage. The site slug will be ignored.'
				);
			}

			// @TODO: Activate the requested site.
			//        Load an existing site if it was requested through site slug. Do
			//        not execute the Blueprint.
			//        Create a new site if that was requested through query args.
			//        Perhaps "bootWebApp()" should be its own function, and perhaps
			//        it should execute redux actions based on the query args. I'm not sure
			//        whether parsing the entire query args to a "runtime config" is the
			//        right approach here as we'll end up ignoring some of these values
			//        in either boot scenario:
			//
			//        1. Load an existing site
			//        2. Create a new site
			//
			//        Also, keep in mind we can switch between these two scenarios
			//        using buttons in the app, and then we'll want to make sure
			//        refreshing the page does something sensible, e.g. does not
			//        create a new site every time.
		}

		init();
	}, []);

	return (
		<Provider store={store}>
			<NavigatorProvider
				initialPath="/"
				className={css.playgroundNavigator}
			>
				<NavigatorScreen
					path="/manager"
					className={css.playgroundNavigatorScreen}
				>
					<SiteManager />
				</NavigatorScreen>
				<NavigatorScreen path="/">
					<div />
				</NavigatorScreen>
				<SiteView />
			</NavigatorProvider>
		</Provider>
	);
}

const root = createRoot(document.getElementById('root')!);
root.render(<Main />);
