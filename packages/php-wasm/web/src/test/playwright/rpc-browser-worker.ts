/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { exposeAPI } from '@php-wasm/universal';

self.postMessage('worker-script-started');

const streamTransport = new URL(self.location.href).searchParams.get(
	'rpc-stream-transport'
) as 'native' | 'message-port' | null;
const [setReady] = exposeAPI(
	{
		ping(value: string) {
			return `pong:${value}`;
		},
		never() {
			return new Promise<never>(() => {});
		},
		crash() {
			setTimeout(() => {
				throw new Error('Deliberate worker failure');
			}, 0);
			return new Promise<never>(() => {});
		},
		closeSelf() {
			self.close();
			return new Promise<never>(() => {});
		},
		finiteStream() {
			return new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(
						new TextEncoder().encode('stream-value')
					);
					controller.close();
				},
			});
		},
		openStream() {
			return new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(new TextEncoder().encode('first'));
				},
			});
		},
	},
	undefined,
	undefined,
	{ streamTransport: streamTransport || 'auto' }
);

setReady();
