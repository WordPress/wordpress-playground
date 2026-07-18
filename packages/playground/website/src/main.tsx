import { createRoot } from 'react-dom/client';
import './styles.css';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { Provider } from 'react-redux';
import store from './lib/state/redux/store';
import { Layout } from './components/layout';
import { EnsurePlaygroundSite } from './components/ensure-playground-site';
import { initializeOpenerBlueprintReceiver } from './lib/opener-blueprint-protocol';

collectWindowErrors(logger);
initializeOpenerBlueprintReceiver();

const root = createRoot(document.getElementById('root')!);
root.render(
	<Provider store={store}>
		<EnsurePlaygroundSite>
			<Layout />
		</EnsurePlaygroundSite>
	</Provider>
);
