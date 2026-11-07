import type { PlaygroundWorkerEndpoint } from './playground-worker-endpoint';
import { consumeAPI, exposeAPI } from '@php-wasm/universal';
import { createAppRuntimeAPI, createPublicRuntimeAPI } from './runtime-api';

// Contract: public RPC never resolves app storage. Startup mounts, direct calls,
// and inherited/internal worker paths are independent ways this could regress.
describe('runtime storage authority', () => {
	let channel: MessageChannel;
	afterEach(() => {
		channel?.port1.close();
		channel?.port2.close();
	});

	function fixture() {
		const mountOpfs = vi.fn(async () => {});
		const boot = vi.fn<(options: Record<string, unknown>) => Promise<void>>(
			async () => {}
		);
		const internal = vi.fn(() => ({ storage: 'all saved sites' }));
		const worker = {
			__internal_getPHP: internal,
			mountOpfsIntoPhp: internal,
			setPrimaryPHP: internal,
			futureStorageMethod: internal,
			mountOpfs,
			hasOpfsMount: vi.fn(),
			readFileAsText: vi.fn(async () => 'assigned filesystem'),
		};
		const web = { boot, mountOpfs };
		return {
			worker: worker as unknown as Parameters<
				typeof createPublicRuntimeAPI
			>[0],
			web: web as unknown as Parameters<typeof createPublicRuntimeAPI>[1],
			mountOpfs,
			boot,
			internal,
		};
	}
	function connect(api: object) {
		channel = new MessageChannel();
		exposeAPI(api, undefined, channel.port1)[0]();
		return consumeAPI<any>(channel.port2);
	}

	it.each(['opfs', 'local-fs', 'unknown'])(
		'rejects startup storage of type %s before invoking the worker',
		async (type) => {
			const f = fixture();
			const api = connect(createPublicRuntimeAPI(f.worker, f.web));
			await expect(
				api['boot']({
					scope: 'rogue',
					mounts: [
						{
							device: { type, path: '/sites/site-victim' },
							mountpoint: '/wordpress',
							initialSyncDirection: 'opfs-to-memfs',
						},
					],
				})
			).rejects.toThrow('private app runtime connection');
			expect(f.boot).not.toHaveBeenCalled();
			expect(f.mountOpfs).not.toHaveBeenCalled();
		}
	);

	it('does not forward private methods, future methods, or inherited worker state', async () => {
		const f = fixture();
		const api = connect(createPublicRuntimeAPI(f.worker, f.web));
		for (const name of [
			'mountOpfs',
			'mountOpfsIntoPhp',
			'__internal_getPHP',
			'__internal_getRequestHandler',
			'setPrimaryPHP',
			'futureStorageMethod',
			'shutdownSharedRuntime',
			'beginSharedBoot',
		]) {
			await expect(
				api[name]({
					device: { type: 'opfs', path: '/sites/site-victim' },
				})
			).rejects.toThrow();
		}
		await expect(api['opfsMounts']['victim']()).rejects.toThrow();
		await expect(
			api['readFileAsText']('/wordpress/marker.txt')
		).resolves.toBe('assigned filesystem');
		expect(f.internal).not.toHaveBeenCalled();
		expect(f.mountOpfs).not.toHaveBeenCalled();
	});

	it('does not forward new boot fields into the private worker', async () => {
		const f = fixture();
		const api = connect(createPublicRuntimeAPI(f.worker, f.web));
		await api['boot']({
			scope: 'temporary',
			withNetworking: false,
			authorizedStorage: '/sites/site-victim',
			sharedRuntime: 'victim',
		});
		expect(f.boot).toHaveBeenCalledOnce();
		expect(f.boot.mock.calls[0][0]).not.toHaveProperty('authorizedStorage');
		expect(f.boot.mock.calls[0][0]).not.toHaveProperty('sharedRuntime');
	});

	it('preserves live metadata through the worker and window RPC boundaries', async () => {
		const workerChannel = new MessageChannel();
		try {
			exposeAPI(
				{
					absoluteUrl: 'https://sandbox.test/scope:a/',
					documentRoot: '/wordpress',
				},
				undefined,
				workerChannel.port1
			)[0]();
			const worker = consumeAPI<PlaygroundWorkerEndpoint>(
				workerChannel.port2
			);
			const api = connect(createPublicRuntimeAPI(worker, fixture().web));
			expect(await api['absoluteUrl']).toBe(
				'https://sandbox.test/scope:a/'
			);
			expect(await api['documentRoot']).toBe('/wordpress');
		} finally {
			workerChannel.port1.close();
			workerChannel.port2.close();
		}
	});

	it('accepts the app assignment on its separate API without cloning a handle', async () => {
		const f = fixture();
		const api = connect(createAppRuntimeAPI(f.worker, f.web));
		const mount = {
			device: { type: 'opfs', path: '/sites/site-assigned' },
			mountpoint: '/wordpress',
			initialSyncDirection: 'opfs-to-memfs',
		};
		await api['boot']({ scope: 'assigned', mounts: [mount] });
		await api['mountOpfs'](mount);
		expect(f.boot).toHaveBeenCalledWith({
			scope: 'assigned',
			mounts: [mount],
		});
		expect(f.mountOpfs).toHaveBeenCalledWith(mount);
	});
});
