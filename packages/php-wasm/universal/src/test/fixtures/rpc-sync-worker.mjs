/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { parentPort, workerData } from 'node:worker_threads';

const { consumeAPISync, exposeSyncAPI } = await import(workerData.moduleUrl);

class SyncFixtureAPI {
	base = 10;

	add(value) {
		return this.base + value;
	}

	echo(value) {
		return value;
	}

	fail() {
		const error = new RangeError('sync remote failure');
		error.code = 'SYNC_FAILURE';
		throw error;
	}

	async delayed(delay) {
		await new Promise((resolve) => setTimeout(resolve, delay));
		return 'finished';
	}

	loseEndpoint() {
		workerData.port.close();
		return new Promise(() => {});
	}

	async terminateThenReturn() {
		workerData.port.close();
		await new Promise((resolve) => setTimeout(resolve, 20));
		return 'late success';
	}
}

if (workerData.upstreamPort) {
	const upstream = await consumeAPISync(workerData.upstreamPort);
	await exposeSyncAPI(upstream, workerData.port);
} else {
	await exposeSyncAPI(new SyncFixtureAPI(), workerData.port);
}
parentPort.postMessage('ready');
