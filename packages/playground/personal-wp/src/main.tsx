import { createRoot } from 'react-dom/client';
import './styles.css';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { Provider } from 'react-redux';
import store from './lib/state/redux/store';
import { Layout } from './components/layout';
import { EnsurePlaygroundSite } from './components/ensure-playground-site';
import { encodeStringAsBase64 } from './lib/base64';

collectWindowErrors(logger);

// Convert hash fragment blueprints to blueprint-url query param early,
// before any URL modifications happen. This ensures the blueprint survives
// the OAuth redirect flow.
(function preserveHashBlueprintAsQueryParam() {
	const url = new URL(window.location.href);
	if (url.hash && !url.searchParams.has('blueprint-url')) {
		const fragment = decodeURIComponent(url.hash.substring(1));
		if (fragment.startsWith('{')) {
			const dataUri =
				'data:application/json;base64,' +
				encodeStringAsBase64(fragment);
			url.searchParams.set('blueprint-url', dataUri);
			url.hash = '';
			window.history.replaceState({}, '', url.toString());
		}
	}
})();

const root = createRoot(document.getElementById('root')!);
root.render(
	<Provider store={store}>
		<EnsurePlaygroundSite>
			<Layout />
		</EnsurePlaygroundSite>
	</Provider>
);
