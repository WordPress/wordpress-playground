/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/src/test/playwright/rpc-browser-harness.html');
});

test('calls browser workers and transfers native and bridged streams', async ({
	page,
}) => {
	const result = await page.evaluate(() =>
		window.rpcAcceptanceHarness.testWorkerCallsAndStreams()
	);
	expect(result).toEqual({
		ping: 'pong:browser',
		nativeStreamValue: 'stream-value',
		bridgeStreamValue: 'stream-value',
	});
});

test('uses a browser MessagePort directly', async ({ page }) => {
	const product = await page.evaluate(() =>
		window.rpcAcceptanceHarness.testBrowserMessagePort()
	);
	expect(product).toBe(42);
});

test('rejects unsafe origins and direct same- or cross-origin Window exposure', async ({
	page,
}) => {
	const errors = await page.evaluate(() =>
		window.rpcAcceptanceHarness.testWindowOriginPolicy()
	);
	expect(errors).toEqual([
		'TypeError',
		'TypeError',
		'TypeError',
		'TypeError',
		'TypeError',
		'TypeError',
	]);
});

test('ignores hostile Window bootstrap traffic before a valid session', async ({
	page,
}) => {
	const result = await page.evaluate(() =>
		window.rpcAcceptanceHarness.testHostileWindowBootstrap()
	);
	expect(result).toEqual({
		wrongSourceAcknowledged: false,
		wrongMarkerAcknowledged: false,
		multiplePortsAcknowledged: false,
		wrongOriginAcknowledged: false,
		pingAfterHostileTraffic: 'frame:still-private',
	});
});

test('ignores malformed private-port responses and retries Window bootstrap', async ({
	page,
}) => {
	const result = await page.evaluate(() =>
		window.rpcAcceptanceHarness.testMalformedBootstrapResponseRecovery()
	);
	expect(result).toBe('recovered:private-port');
});

test('rejects pending calls after worker errors and owner termination', async ({
	page,
}) => {
	const result = await page.evaluate(() =>
		window.rpcAcceptanceHarness.testWorkerFailureAndOwnerTermination()
	);
	expect(result.crashError.endpointTerminated).toBe(true);
	expect(result.crashError.endpointType).toBe('browser-worker');
	expect(result.terminationError.endpointTerminated).toBe(true);
	expect(result.terminationError.endpointType).toBe('browser-worker');
	expect(result.repeatedRelease).toBe('resolved');
});

test('uses owner lifecycle for self-closing workers and open streams', async ({
	page,
}) => {
	const result = await page.evaluate(() =>
		window.rpcAcceptanceHarness.testWorkerSelfTerminationAndStreamCleanup()
	);
	expect(result.selfTerminationError.endpointTerminated).toBe(true);
	expect(result.first).toBe('first');
	expect(result.streamError.endpointTerminated).toBe(true);
});

test('moves Window RPC to a private port and handles removal and navigation', async ({
	page,
}) => {
	const result = await page.evaluate(() =>
		window.rpcAcceptanceHarness.testWindowPrivatePortAndLifecycle()
	);
	expect(result.ping).toBe('frame:private-port');
	expect(result.normalWindowTraffic).toBe(0);
	expect(result.removalError.endpointTerminated).toBe(true);
	expect(result.navigationError.endpointTerminated).toBe(true);
});
