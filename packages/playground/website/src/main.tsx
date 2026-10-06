import { claimOriginSetup, isSiteOrigin } from './lib/origin-isolation';
import { createRoot } from 'react-dom/client';
import './styles.css';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { Provider } from 'react-redux';
import store from './lib/state/redux/store';
import { Layout } from './components/layout';
import { EnsurePlaygroundSite } from './components/ensure-playground-site';

collectWindowErrors(logger);

const originClaim = isSiteOrigin(window.location.origin)
	? await claimOriginSetup()
	: undefined;
const root = createRoot(document.getElementById('root')!);
root.render(
	<Provider store={store}>
		<EnsurePlaygroundSite
			setup={originClaim?.setup}
			originWasUsed={originClaim?.wasUsed}
		>
			<Layout />
		</EnsurePlaygroundSite>
	</Provider>
);
