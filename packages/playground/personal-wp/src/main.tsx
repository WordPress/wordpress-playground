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
import { encodeStringAsBase64 } from '@php-wasm/util';
import { acquireOAuthTokenIfNeeded } from './github/acquire-oauth-token-if-needed';

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

async function start() {
	try {
		await acquireOAuthTokenIfNeeded();
	} catch (error) {
		logger.error(error);
		const url = new URL(window.location.href);
		url.searchParams.delete('code');
		url.searchParams.delete('state');
		window.history.replaceState({}, '', url.toString());
	}

	const root = createRoot(document.getElementById('root')!);
	const remoteAccessSessionId = getRemoteAccessSessionId();
	root.render(
		remoteAccessSessionId ? (
			<RemoteAccessViewer sessionId={remoteAccessSessionId} />
		) : isRemoteAccessConnectRoute() ? (
			<RemoteAccessConnect />
		) : (
			<Provider store={store}>
				<EnsurePlaygroundSite>
					<Layout />
				</EnsurePlaygroundSite>
			</Provider>
		)
	);
}

start();
