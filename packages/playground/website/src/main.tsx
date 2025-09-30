import { createRoot } from 'react-dom/client';
import './styles.css';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { Provider } from 'react-redux';
import store from './lib/state/redux/store';
import { Layout } from './components/layout';
import { EnsurePlaygroundSite } from './components/ensure-playground-site';

collectWindowErrors(logger);

const rootElement = document.getElementById('root');
if (!rootElement) {
	throw new Error('Root element not found');
}

const root = createRoot(rootElement);

root.render(
	<Provider store={store}>
		<EnsurePlaygroundSite>
			<Layout />
		</EnsurePlaygroundSite>
	</Provider>
);
