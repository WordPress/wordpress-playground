import { createRoot } from 'react-dom/client';
import './styles.css';
import css from './style.module.css';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { Provider } from 'react-redux';
import store from './lib/redux-store';
import { __experimentalNavigatorProvider as NavigatorProvider } from '@wordpress/components';
import { Layout } from './components/layout';
import { EnsurePlaygroundSite } from './components/ensure-playground-site';

collectWindowErrors(logger);

const root = createRoot(document.getElementById('root')!);
root.render(
	<NavigatorProvider initialPath="/" className={css.playgroundNavigator}>
		<Provider store={store}>
			<EnsurePlaygroundSite>
				<Layout />
			</EnsurePlaygroundSite>
		</Provider>
	</NavigatorProvider>
);
