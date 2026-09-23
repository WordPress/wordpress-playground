/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { parentPort, workerData } from 'node:worker_threads';

const { exposeAPI } = await import(workerData.moduleUrl);
const [setReady] = exposeAPI(
	{
		ping(value) {
			return `pong:${value}`;
		},
		never() {
			return new Promise(() => {});
		},
	},
	undefined,
	parentPort
);
setReady();
parentPort.postMessage('fixture-ready');
