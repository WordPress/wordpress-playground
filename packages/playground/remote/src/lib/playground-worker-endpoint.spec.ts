import { describe, expect, it, vi } from 'vitest';

describe('PlaygroundWorkerEndpoint OPFS flushing', () => {
	it('flushes the active OPFS mount', async () => {
		const endpoint = await createEndpoint({
			'/wordpress': createOpfsMount(),
		});

		await endpoint.flushOpfs('/wordpress');

		expect(endpoint.opfsMounts['/wordpress'].flush).toHaveBeenCalledTimes(
			1
		);
	});

	it('throws when flushing a missing OPFS mount', async () => {
		const endpoint = await createEndpoint({});

		await expect(endpoint.flushOpfs('/wordpress')).rejects.toThrow(
			'No OPFS mount found at "/wordpress".'
		);
	});

	it('flushes before unmounting an OPFS mount', async () => {
		const opfsMount = createOpfsMount();
		const order: string[] = [];
		opfsMount.flush.mockImplementation(async () => {
			order.push('flush');
		});
		const unmount = vi.fn(async () => {
			order.push('unmount');
		});
		const endpoint = await createEndpoint(
			{ '/wordpress': opfsMount },
			{ '/wordpress': unmount }
		);

		await endpoint.unmountOpfs('/wordpress');

		expect(order).toEqual(['flush', 'unmount']);
		expect(endpoint.opfsMounts['/wordpress']).toBeUndefined();
		expect(endpoint.unmounts['/wordpress']).toBeUndefined();
	});
});

async function createEndpoint(
	opfsMounts: Record<string, ReturnType<typeof createOpfsMount>>,
	unmounts: Record<string, () => Promise<void>> = {}
) {
	vi.stubGlobal('caches', { open: vi.fn(async () => ({})) });
	const { PlaygroundWorkerEndpoint } =
		await import('./playground-worker-endpoint');
	const endpoint = Object.create(PlaygroundWorkerEndpoint.prototype) as any;
	endpoint.opfsMounts = opfsMounts;
	endpoint.unmounts = unmounts;
	return endpoint as {
		flushOpfs(mountpoint: string): Promise<void>;
		unmountOpfs(mountpoint: string): Promise<void>;
		opfsMounts: typeof opfsMounts;
		unmounts: typeof unmounts;
	};
}

function createOpfsMount() {
	return {
		flush: vi.fn(async () => {}),
		unmount: vi.fn(async () => {}),
	};
}
