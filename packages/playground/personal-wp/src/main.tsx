import { createRoot } from 'react-dom/client';
import './styles.css';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { Provider } from 'react-redux';
import store from './lib/state/redux/store';
import { Layout } from './components/layout';
import { EnsurePlaygroundSite } from './components/ensure-playground-site';
import {
	DesktopAccessViewer,
	getDesktopAccessSessionId,
} from './components/desktop-access-viewer';
import {
	DesktopAccessConnect,
	isDesktopAccessConnectRoute,
} from './components/desktop-access-connect';

collectWindowErrors(logger);

const root = createRoot(document.getElementById('root')!);
const desktopAccessSessionId = getDesktopAccessSessionId();

root.render(
	desktopAccessSessionId ? (
		<DesktopAccessViewer sessionId={desktopAccessSessionId} />
	) : isDesktopAccessConnectRoute() ? (
		<DesktopAccessConnect />
	) : (
		<Provider store={store}>
			<EnsurePlaygroundSite>
				<Layout />
			</EnsurePlaygroundSite>
		</Provider>
	)
);
