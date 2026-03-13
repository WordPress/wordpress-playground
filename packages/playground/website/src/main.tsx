import { createRoot } from 'react-dom/client';
import './styles.css';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { Provider } from 'react-redux';
import { EnsurePlaygroundSite } from './components/ensure-playground-site';
import { Layout } from './components/layout';
import store from './lib/state/redux/store';

collectWindowErrors(logger);

const root = createRoot(document.getElementById('root')!);
root.render(
	<Provider store={store}>
		<EnsurePlaygroundSite>
			<Layout />
		</EnsurePlaygroundSite>
	</Provider>
);
