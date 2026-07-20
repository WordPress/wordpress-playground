// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
	initializeOpenerBlueprintReceiver,
	OPENER_BLUEPRINT_MAX_FILES,
	OPENER_BLUEPRINT_MAX_TOTAL_BYTES,
	OpenerBlueprintReceiver,
	validateOpenerBlueprintRun,
} from './opener-blueprint-protocol';

describe('initializeOpenerBlueprintReceiver', () => {
	it('installs the listener only for the opener source parameter', () => {
		const inactiveHost = createHost();
		expect(
			initializeOpenerBlueprintReceiver(
				new URL('https://playground.test/'),
				inactiveHost.host
			)
		).toBeUndefined();
		expect(inactiveHost.host.addEventListener).not.toHaveBeenCalled();

		const activeHost = createHost();
		const receiver = initializeOpenerBlueprintReceiver(
			new URL('https://playground.test/?blueprint-source=opener'),
			activeHost.host
		);

		expect(receiver).toBeInstanceOf(OpenerBlueprintReceiver);
		expect(activeHost.host.addEventListener).toHaveBeenCalledOnce();
		expect(activeHost.opener.postMessage).toHaveBeenCalledWith(
			{
				type: 'playground-blueprint:ready',
				protocolVersion: 1,
			},
			'*'
		);
		receiver?.dispose();
	});
});

describe('OpenerBlueprintReceiver', () => {
	it('filters messages by source, version, and type, and replies to hello', () => {
		const { receiver, dispatchMessage, opener } = createReceiver();
		opener.postMessage.mockClear();

		dispatchMessage(
			{
				type: 'playground-blueprint:hello',
				protocolVersion: 1,
			},
			'https://opener.test',
			{ postMessage: vi.fn() }
		);
		dispatchMessage({
			type: 'playground-blueprint:hello',
			protocolVersion: 2,
		});
		dispatchMessage({ type: 'unknown', protocolVersion: 1 });
		expect(opener.postMessage).not.toHaveBeenCalled();

		dispatchMessage({
			type: 'playground-blueprint:hello',
			protocolVersion: 1,
			extraField: true,
		});
		expect(opener.postMessage).toHaveBeenCalledWith(
			{
				type: 'playground-blueprint:ready',
				protocolVersion: 1,
			},
			'*'
		);
		receiver.dispose();
	});

	it('accepts the first valid run and pins later messages to its origin', async () => {
		const { receiver, dispatchMessage, opener } = createReceiver();
		opener.postMessage.mockClear();
		const runPromise = receiver.waitForRun();

		dispatchMessage(validRunMessage(), 'https://opener.test');
		expect(receiver.state).toBe('booting');
		const acceptedRun = await runPromise;
		expect(acceptedRun).toEqual({
			blueprint: {},
			files: [],
			runId: expect.any(String),
		});
		expect(receiver.getAcceptedRun(acceptedRun.runId)).toBe(acceptedRun);
		expect(receiver.getAcceptedRun('another-run')).toBeUndefined();
		expect(opener.postMessage).toHaveBeenLastCalledWith(
			{
				type: 'playground-blueprint:accepted',
				protocolVersion: 1,
			},
			'https://opener.test'
		);

		dispatchMessage(validRunMessage(), 'https://different.test');
		expect(opener.postMessage).toHaveBeenLastCalledWith(
			{
				type: 'playground-blueprint:rejected',
				protocolVersion: 1,
				reason: 'already-running',
			},
			'https://opener.test'
		);

		receiver.reportProgress(140, 'Finishing');
		expect(opener.postMessage).toHaveBeenLastCalledWith(
			{
				type: 'playground-blueprint:progress',
				protocolVersion: 1,
				value: 100,
				caption: 'Finishing',
			},
			'https://opener.test'
		);
		receiver.reportBooted('/wp-admin/');
		expect(receiver.state).toBe('booted');
		expect(receiver.getAcceptedRun(acceptedRun.runId)).toBeUndefined();
		expect(opener.postMessage).toHaveBeenLastCalledWith(
			{
				type: 'playground-blueprint:booted',
				protocolVersion: 1,
				landingPage: '/wp-admin/',
			},
			'https://opener.test'
		);
		receiver.dispose();
	});

	it('uses a wildcard target for a file opener after accepting its run', () => {
		const { receiver, dispatchMessage, opener } = createReceiver();
		opener.postMessage.mockClear();

		dispatchMessage(validRunMessage(), 'null');
		receiver.reportError(new Error('Boot failed'));

		expect(opener.postMessage).toHaveBeenLastCalledWith(
			{
				type: 'playground-blueprint:error',
				protocolVersion: 1,
				message: 'Boot failed',
			},
			'*'
		);
		expect(receiver.state).toBe('error');
		receiver.dispose();
	});

	it('rejects a malformed run without throwing from the message listener', async () => {
		const { receiver, dispatchMessage, opener } = createReceiver();
		opener.postMessage.mockClear();
		const runPromise = receiver.waitForRun();

		expect(() =>
			dispatchMessage(
				{
					type: 'playground-blueprint:run',
					protocolVersion: 1,
					blueprint: 'not an object',
				},
				'https://opener.test'
			)
		).not.toThrow();
		await expect(runPromise).rejects.toThrow('plain object');
		expect(receiver.state).toBe('error');
		expect(opener.postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({
				type: 'playground-blueprint:rejected',
				protocolVersion: 1,
			}),
			'https://opener.test'
		);

		dispatchMessage(validRunMessage(), 'https://opener.test');
		expect(opener.postMessage).toHaveBeenLastCalledWith(
			{
				type: 'playground-blueprint:rejected',
				protocolVersion: 1,
				reason: 'already-running',
			},
			'https://opener.test'
		);
		receiver.dispose();
	});
});

describe('validateOpenerBlueprintRun', () => {
	it('accepts the file count and total byte limits exactly', () => {
		const files = Array.from({ length: OPENER_BLUEPRINT_MAX_FILES }, () =>
			validFile()
		);
		Object.defineProperty(files[0].bytes, 'byteLength', {
			value: OPENER_BLUEPRINT_MAX_TOTAL_BYTES,
		});

		expect(
			validateOpenerBlueprintRun({ blueprint: {}, files })
		).not.toBeInstanceOf(Error);
	});

	it('rejects more than 200 files', () => {
		const files = Array.from(
			{ length: OPENER_BLUEPRINT_MAX_FILES + 1 },
			() => validFile()
		);

		expect(validateOpenerBlueprintRun({ blueprint: {}, files })).toEqual(
			expect.any(Error)
		);
	});

	it('rejects more than 512 MB in total', () => {
		const file = validFile();
		Object.defineProperty(file.bytes, 'byteLength', {
			value: OPENER_BLUEPRINT_MAX_TOTAL_BYTES + 1,
		});

		expect(
			validateOpenerBlueprintRun({ blueprint: {}, files: [file] })
		).toEqual(expect.any(Error));
	});

	it.each([
		['a non-object Blueprint', { blueprint: 'nope' }],
		['an array Blueprint', { blueprint: [] }],
		['a non-array files value', { blueprint: {}, files: {} }],
		['a null files value', { blueprint: {}, files: null }],
		[
			'bytes other than an ArrayBuffer',
			{
				blueprint: {},
				files: [
					{
						...validFile(),
						bytes: new Uint8Array(),
					},
				],
			},
		],
		[
			'an unknown destination',
			{
				blueprint: {},
				files: [{ ...validFile(), destination: 'somewhere' }],
			},
		],
		[
			'a relative VFS path',
			{
				blueprint: {},
				files: [{ ...validFile(), path: 'relative.txt' }],
			},
		],
		[
			'a VFS traversal path',
			{
				blueprint: {},
				files: [
					{
						...validFile(),
						path: '/wordpress/../tmp/file.txt',
					},
				],
			},
		],
	])('rejects %s', (_label, message) => {
		expect(validateOpenerBlueprintRun(message)).toEqual(expect.any(Error));
	});
});

function validRunMessage() {
	return {
		type: 'playground-blueprint:run',
		protocolVersion: 1,
		blueprint: {},
	};
}

function validFile() {
	return {
		name: 'file.txt',
		bytes: new ArrayBuffer(0),
		destination: 'vfs',
		path: '/wordpress/file.txt',
	};
}

function createReceiver() {
	const testHost = createHost();
	const receiver = new OpenerBlueprintReceiver(testHost.host);
	return { receiver, ...testHost };
}

function createHost() {
	let messageListener: ((event: MessageEvent) => void) | undefined;
	const opener = { postMessage: vi.fn() };
	const host = {
		opener,
		addEventListener: vi.fn(
			(_type: 'message', listener: (event: MessageEvent) => void) => {
				messageListener = listener;
			}
		),
		removeEventListener: vi.fn(),
	};
	return {
		host,
		opener,
		dispatchMessage(
			data: unknown,
			origin = 'https://opener.test',
			source: unknown = opener
		) {
			messageListener?.(
				new MessageEvent('message', {
					data,
					origin,
					source: source as WindowProxy,
				})
			);
		},
	};
}
