/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { exposeAPI } from '@php-wasm/universal';

let attempt = 0;

window.addEventListener('message', (event) => {
	if (
		event.source !== window.parent ||
		event.origin !== location.origin ||
		event.data?.protocol !== 'wordpress-playground-rpc-bootstrap' ||
		event.data?.version !== 1 ||
		event.data?.kind !== 'connect' ||
		typeof event.data?.session !== 'string' ||
		event.ports.length !== 1
	) {
		return;
	}

	attempt++;
	const port = event.ports[0];
	if (attempt === 1) {
		port.postMessage({
			protocol: 'wordpress-playground-rpc',
			version: 2,
			session: event.data.session,
			kind: 'hello-ack',
		});
		port.close();
		return;
	}
	if (attempt === 2) {
		port.postMessage({
			protocol: 'wordpress-playground-rpc',
			version: 1,
			session: event.data.session,
			kind: 'protocol-error',
		});
		port.close();
		return;
	}

	const [setReady] = exposeAPI(
		{
			ping(value: string) {
				return `recovered:${value}`;
			},
		},
		undefined,
		port
	);
	setReady();
});
