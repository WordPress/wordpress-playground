import { createRoot } from 'react-dom/client';
import './styles.css';

import { collectWindowErrors, logger } from '@php-wasm/logger';
import { Provider } from 'react-redux';
import store from './lib/state/redux/store';
import { Layout } from './components/layout';
import { EnsurePlaygroundSite } from './components/ensure-playground-site';
import {
	RemoteAccessViewer,
	getRemoteAccessSessionId,
} from './components/remote-access-viewer';
import {
	RemoteAccessConnect,
	isRemoteAccessConnectRoute,
} from './components/remote-access-connect';
import { AppUpdateGate, AppUpdateNotice } from './components/app-update-notice';
import { AppUpdateProvider } from './lib/pwa-update/use-app-update';

collectWindowErrors(logger);

const root = createRoot(document.getElementById('root')!);
const remoteAccessSessionId = getRemoteAccessSessionId();

root.render(<PersonalWPApp />);

function PersonalWPApp() {
	return (
		<AppUpdateProvider>
			<AppUpdateGate>
				<AppUpdateNotice />
				{remoteAccessSessionId ? (
					<RemoteAccessViewer sessionId={remoteAccessSessionId} />
				) : isRemoteAccessConnectRoute() ? (
					<RemoteAccessConnect />
				) : (
					<Provider store={store}>
						<EnsurePlaygroundSite>
							<Layout />
						</EnsurePlaygroundSite>
					</Provider>
				)}
			</AppUpdateGate>
		</AppUpdateProvider>
	);
}
