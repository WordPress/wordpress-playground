import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressTracker } from '@php-wasm/progress';
import type { BlueprintBundle } from '@wp-playground/blueprints';
import type * as Universal from '@php-wasm/universal';

const mocks = vi.hoisted(() => {
	vi.stubGlobal('location', {
		href: 'http://localhost/',
		origin: 'http://localhost',
	});
	return {
		bootPlaygroundV1: vi.fn(),
		bootPlaygroundV2: vi.fn(),
		BlueprintsV1Handler: vi.fn(),
		BlueprintsV2Handler: vi.fn(),
		createBlueprintReflection: vi.fn(),
		consumeAPI: vi.fn(),
	};
});

vi.mock('@wp-playground/blueprints', () => ({
	BlueprintReflection: {
		create: mocks.createBlueprintReflection,
	},
	isBlueprintBundle: (blueprint: any) => Boolean(blueprint?.read),
}));

vi.mock('./blueprints-v1-handler', () => ({
	BlueprintsV1Handler: mocks.BlueprintsV1Handler,
}));

vi.mock('./blueprints-v2-handler', () => ({
	BlueprintsV2Handler: mocks.BlueprintsV2Handler,
}));

vi.mock('@php-wasm/universal', async (importOriginal) => ({
	...(await importOriginal<typeof Universal>()),
	consumeAPI: mocks.consumeAPI,
}));

import { startPlaygroundAPI, startPlaygroundWeb } from './index';

beforeEach(() => {
	mocks.consumeAPI.mockReturnValue({
		isConnected: async () => {},
		isReady: async () => {},
	});
});

describe('startPlaygroundWeb', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('routes Blueprint v1 declarations through the v1 handler', async () => {
		const playground = { connected: true };
		mocks.BlueprintsV1Handler.mockImplementation(() => ({
			bootPlayground: mocks.bootPlaygroundV1,
		}));
		mocks.bootPlaygroundV1.mockResolvedValue(playground);
		const iframe = createIframe();

		await expect(
			startPlaygroundWeb({
				iframe,
				remoteUrl:
					'http://localhost/remote.html?blueprints-runner=v2&existing=1',
				progressTracker: createProgressTracker(),
				blueprint: {
					steps: [],
				},
			})
		).resolves.toBe(playground);

		expect(mocks.BlueprintsV1Handler).toHaveBeenCalledTimes(1);
		expect(mocks.BlueprintsV2Handler).not.toHaveBeenCalled();
		expect(iframe.src).not.toContain('blueprints-runner');
		expect(iframe.src).toContain('existing=1');
	});

	it('routes Blueprint v2 declarations through the v2 handler', async () => {
		const playground = { connected: true };
		mocks.BlueprintsV2Handler.mockImplementation(() => ({
			bootPlayground: mocks.bootPlaygroundV2,
		}));
		mocks.bootPlaygroundV2.mockResolvedValue(playground);
		const iframe = createIframe();

		await expect(
			startPlaygroundWeb({
				iframe,
				remoteUrl: 'http://localhost/remote.html',
				progressTracker: createProgressTracker(),
				blueprint: {
					version: 2,
					siteOptions: {
						blogname: 'V2 site',
					},
				},
			})
		).resolves.toBe(playground);

		expect(mocks.BlueprintsV2Handler).toHaveBeenCalledTimes(1);
		expect(mocks.BlueprintsV1Handler).not.toHaveBeenCalled();
		expect(iframe.src).not.toContain('blueprints-runner');
	});

	it('routes Blueprint v2 bundles through the v2 handler', async () => {
		const playground = { connected: true };
		mocks.BlueprintsV2Handler.mockImplementation(() => ({
			bootPlayground: mocks.bootPlaygroundV2,
		}));
		mocks.bootPlaygroundV2.mockResolvedValue(playground);
		mocks.createBlueprintReflection.mockResolvedValueOnce({
			getVersion: () => 2,
		});
		const iframe = createIframe();
		const bundle = {
			read: vi.fn(),
		} satisfies BlueprintBundle;

		await expect(
			startPlaygroundWeb({
				iframe,
				remoteUrl: 'http://localhost/remote.html',
				progressTracker: createProgressTracker(),
				blueprint: bundle,
			})
		).resolves.toBe(playground);

		expect(mocks.createBlueprintReflection).toHaveBeenCalledWith(bundle);
		expect(mocks.BlueprintsV2Handler).toHaveBeenCalledTimes(1);
		expect(mocks.BlueprintsV1Handler).not.toHaveBeenCalled();
		expect(iframe.src).not.toContain('blueprints-runner');
	});
});

describe('startPlaygroundAPI', () => {
	it.each([
		['a different endpoint', 'http://localhost/remote.html'],
		['an untrusted origin', 'https://example.com/api.html'],
	])('rejects %s', async (_description, apiUrl) => {
		await expect(
			startPlaygroundAPI({
				iframe: createIframe(),
				apiUrl,
			})
		).rejects.toThrow('Invalid API URL');
	});
});

// Terminal failures reject startup; recoverable prompts keep the same call usable.
describe('iframe startup lifecycle', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});
	it('resumes the original startup after storage access and an iframe reload', async () => {
		const fixture = await pendingStartup();
		fixture.send({
			type: 'playground-runtime-startup-error',
			recovery: 'storage-access',
			error: {
				name: 'NotSupportedError',
				message: 'Storage permission required',
			},
		});
		await vi.advanceTimersByTimeAsync(0);
		expect(fixture.state()).toBe('pending');
		fixture.iframe.dispatchEvent(new Event('load'));
		await vi.advanceTimersByTimeAsync(0);
		expect(fixture.state()).toBe('pending');
		fixture.send({ type: 'playground-runtime-startup-started' });
		fixture.connect();
		await expect(fixture.result).resolves.toBeDefined();
	});
	it('leaves a reload-required flow waiting for the application reload', async () => {
		const fixture = await pendingStartup();
		fixture.send({ type: 'playground-reload-required', ready: true });
		await vi.advanceTimersByTimeAsync(0);
		expect(fixture.state()).toBe('pending');
		fixture.connect();
		await fixture.result;
	});
	it('keeps a failed retirement in the existing reload flow', async () => {
		const fixture = await pendingStartup();
		fixture.send({ type: 'playground-reload-required', ready: false });
		fixture.send({
			type: 'playground-runtime-startup-error',
			error: {
				name: 'Error',
				message: 'Failed to save previous runtime',
			},
		});
		await vi.advanceTimersByTimeAsync(0);
		expect(fixture.state()).toBe('pending');
		fixture.connect();
		await fixture.result;
	});
	it.each(['source', 'origin'] as const)(
		'ignores startup errors from the wrong %s',
		async (field) => {
			const fixture = await pendingStartup();
			fixture.send(
				{
					type: 'playground-runtime-startup-error',
					error: { message: 'Spoofed failure' },
				},
				field
			);
			await vi.advanceTimersByTimeAsync(500);
			expect(fixture.state()).toBe('pending');
			fixture.connect();
			await fixture.result;
		}
	);
	it('does not abort an established connection on later errors', async () => {
		const fixture = await pendingStartup();
		fixture.connect();
		await fixture.result;
		const signal = mocks.consumeAPI.mock.calls[
			mocks.consumeAPI.mock.calls.length - 1
		][2] as AbortSignal;
		fixture.send({
			type: 'playground-runtime-startup-error',
			error: { message: 'Late error' },
		});
		await vi.advanceTimersByTimeAsync(0);
		expect(signal.aborted).toBe(false);
	});
	it('acknowledges a terminal error so the iframe can hand retry to the application', async () => {
		const fixture = await pendingStartup();
		fixture.send({
			type: 'playground-runtime-startup-error',
			phase: 'service-worker',
			error: { name: 'TypeError', message: 'Script load failed' },
		});
		await expect(fixture.result).rejects.toMatchObject({
			phase: 'service-worker',
		});
		expect(fixture.iframe.contentWindow!.postMessage).toHaveBeenCalledWith(
			{ type: 'playground-runtime-startup-error-handled' },
			'http://localhost'
		);
	});
});

async function pendingStartup(
	options: { autoLoad?: boolean; loading?: string } = {}
) {
	const iframe = createIframe(options);
	let connect = () => {};
	mocks.consumeAPI.mockImplementation(
		(_remote, _context, signal: AbortSignal) => ({
			isConnected: () =>
				new Promise<void>((resolve, reject) => {
					connect = resolve;
					signal.addEventListener(
						'abort',
						() => reject(signal.reason),
						{ once: true }
					);
				}),
			isReady: async () => {},
		})
	);
	const result = startPlaygroundAPI({
		iframe,
		apiUrl: 'http://localhost/api.html',
	});
	let state = 'pending';
	void result.then(
		() => {
			state = 'resolved';
		},
		() => {
			state = 'rejected';
		}
	);
	await vi.advanceTimersByTimeAsync(0);
	return {
		iframe,
		result,
		connect: () => connect(),
		state: () => state,
		send(data: unknown, wrong?: 'source' | 'origin') {
			const event = Object.assign(new Event('message'), {
				data,
				source: wrong === 'source' ? {} : iframe.contentWindow,
				origin:
					wrong === 'origin'
						? 'https://untrusted.example'
						: 'http://localhost',
			});
			iframe.ownerDocument.defaultView!.dispatchEvent(event);
		},
	};
}

function createIframe({ autoLoad = true, loading = 'eager' } = {}) {
	let src = '';
	const iframe = Object.assign(new EventTarget(), {
		loading,
		ownerDocument: { defaultView: new EventTarget() },
		contentWindow: { postMessage: vi.fn() },
	});
	Object.defineProperty(iframe, 'src', {
		get: () => src,
		set(value: string) {
			src = value;
			if (autoLoad)
				queueMicrotask(() => iframe.dispatchEvent(new Event('load')));
		},
	});
	return iframe as unknown as HTMLIFrameElement;
}

function createProgressTracker() {
	return {
		setCaption: vi.fn(),
		finish: vi.fn(),
	} as unknown as ProgressTracker;
}
