import { useEffect, useState } from 'react';
import { Button } from '@wordpress/components';
import { Modal } from './components/modal';
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

collectWindowErrors(logger);

const root = createRoot(document.getElementById('root')!);
const remoteAccessSessionId = getRemoteAccessSessionId();

root.render(
	remoteAccessSessionId ? (
		<RemoteAccessViewer sessionId={remoteAccessSessionId} />
	) : isRemoteAccessConnectRoute() ? (
		<RemoteAccessConnect />
	) : (
		<PersonalWP />
	)
);

function PersonalWP() {
	const [reloadRequired, setReloadRequired] = useState(false);
	const [readyToReload, setReadyToReload] = useState(false);
	const [retirementFailed, setRetirementFailed] = useState(false);
	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			if (event.origin !== window.location.origin) return;
			if (
				!Array.from(document.querySelectorAll('iframe')).some(
					(iframe) => iframe.contentWindow === event.source
				)
			)
				return;
			if (event.data?.type === 'playground-runtime-closed') {
				setReadyToReload(true);
				setRetirementFailed(false);
			}
			if (event.data?.type === 'shared-runtime-retirement-error') {
				setRetirementFailed(true);
				logger.error(event.data.error);
			}
			if (event.data?.type === 'playground-reload-required') {
				setReloadRequired(true);
				if (event.data.ready) setReadyToReload(true);
			}
		};
		const onServiceWorkerMessage = (event: MessageEvent) => {
			if (event.data?.type === 'playground-reload-required') {
				setReloadRequired(true);
				if (event.data.ready) setReadyToReload(true);
			}
		};
		window.addEventListener('message', onMessage);
		navigator.serviceWorker?.addEventListener(
			'message',
			onServiceWorkerMessage
		);
		return () => {
			window.removeEventListener('message', onMessage);
			navigator.serviceWorker?.removeEventListener(
				'message',
				onServiceWorkerMessage
			);
		};
	}, []);

	return (
		<>
			<Provider store={store}>
				<EnsurePlaygroundSite>
					<Layout />
				</EnsurePlaygroundSite>
			</Provider>
			{/* Keep the remote document alive until the worker finishes flushing. */}
			{reloadRequired && (
				<Modal
					title="A new version is available"
					small
					isDismissible={false}
					onRequestClose={() => {}}
				>
					<p>
						{retirementFailed
							? "WordPress couldn't finish saving. Keep this tab open."
							: readyToReload
								? 'Reload this tab to continue using WordPress.'
								: 'Saving WordPress changes before restarting.'}
					</p>
					<Button
						variant="primary"
						disabled={!readyToReload}
						isBusy={!readyToReload && !retirementFailed}
						onClick={() => window.location.reload()}
					>
						Reload this tab
					</Button>
				</Modal>
			)}
		</>
	);
}
