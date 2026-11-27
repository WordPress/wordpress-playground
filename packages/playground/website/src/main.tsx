import { createRoot } from 'react-dom/client';
import './styles.css';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { Provider } from 'react-redux';
import store from './lib/state/redux/store';
import { initializeDock } from './lib/state/redux/slice-ui';
import { getInitialDockState } from './lib/state/url/dock-query';
import { Layout } from './components/layout';
import { EnsurePlaygroundSite } from './components/ensure-playground-site';

collectWindowErrors(logger);

store.dispatch(
	initializeDock(getInitialDockState(new URL(window.location.href)))
);

const root = createRoot(document.getElementById('root')!);
root.render(
	<Provider store={store}>
		<EnsurePlaygroundSite>
			<Layout />
		</EnsurePlaygroundSite>
	</Provider>
);
