import { createRoot } from 'react-dom/client';
import './styles.css';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { Provider } from 'react-redux';
import store from './lib/state/redux/store';
import { Layout } from './components/layout';
import { EnsurePlaygroundSite } from './components/ensure-playground-site';
import {
	SharedPlaygroundViewer,
	getShareSessionId,
} from './components/shared-playground-viewer';

collectWindowErrors(logger);

// Check if this is a guest viewing a shared Playground
const shareSessionId = getShareSessionId();

const root = createRoot(document.getElementById('root')!);

if (shareSessionId) {
	// Render the shared playground viewer for guests
	root.render(<SharedPlaygroundViewer sessionId={shareSessionId} />);
} else {
	// Render the normal Playground app
	root.render(
		<Provider store={store}>
			<EnsurePlaygroundSite>
				<Layout />
			</EnsurePlaygroundSite>
		</Provider>
	);
}
