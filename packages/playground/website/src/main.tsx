import { createRoot } from 'react-dom/client';
import './styles.css';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { Provider } from 'react-redux';
import store from './lib/state/redux/store';
import { Layout } from './components/layout';
import { EnsurePlaygroundSite } from './components/ensure-playground-site';
import { initializeI18n } from './lib/i18n';

collectWindowErrors(logger);

const root = createRoot(document.getElementById('root')!);
initializeI18n().finally(() => {
	root.render(
		<Provider store={store}>
			<EnsurePlaygroundSite>
				<Layout />
			</EnsurePlaygroundSite>
		</Provider>
	);
});
