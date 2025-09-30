import { createRoot } from 'react-dom/client';
import './styles.css';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { Provider } from 'react-redux';
import store from './lib/state/redux/store';
import { Layout } from './components/layout';
import { EnsurePlaygroundSite } from './components/ensure-playground-site';
import { FilePickerTreeHarness } from './playwright/harnesses/file-picker-tree-harness';

collectWindowErrors(logger);

const rootElement = document.getElementById('root');
if (!rootElement) {
	throw new Error('Root element not found');
}

const root = createRoot(rootElement);
const searchParams = new URLSearchParams(window.location.search);
const harnessTarget = searchParams.get('playwrightHarness');

if (harnessTarget === 'file-picker-tree') {
	root.render(<FilePickerTreeHarness />);
} else {
	root.render(
		<Provider store={store}>
			<EnsurePlaygroundSite>
				<Layout />
			</EnsurePlaygroundSite>
		</Provider>
	);
}
