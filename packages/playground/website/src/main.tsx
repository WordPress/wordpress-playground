import { createRoot } from 'react-dom/client';
import './styles.css';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { Provider } from 'react-redux';
import store from './lib/state/redux/store';
import { Layout } from './components/layout';
import { EnsurePlaygroundSite } from './components/ensure-playground-site';
import { activatePlaygroundPrPreview } from './lib/playground-pr-preview';

collectWindowErrors(logger);

activatePlaygroundPrPreview()
	.then((activated) => {
		if (!activated) {
			renderApp();
		}
	})
	.catch((error) => {
		logger.error(error);
		renderPreviewError(error);
	});

function renderApp() {
	const root = createRoot(document.getElementById('root')!);
	root.render(
		<Provider store={store}>
			<EnsurePlaygroundSite>
				<Layout />
			</EnsurePlaygroundSite>
		</Provider>
	);
}

function renderPreviewError(error: Error) {
	const root = document.getElementById('root')!;
	root.textContent =
		error.message || 'Unable to activate the requested PR preview.';
}
