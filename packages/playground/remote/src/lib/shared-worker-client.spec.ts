import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnSharedPlaygroundWorker } from './shared-worker-client';

beforeEach(() => {
	vi.stubGlobal('document', {
		location: { href: 'https://playground.example/remote.html' },
	});
});

afterEach(() => vi.unstubAllGlobals());

describe('shared PHP worker lifetime', () => {
	it('closes the unused port and falls back when extendedLifetime is ignored', async () => {
		const worker = createWorker();
		vi.stubGlobal(
			'SharedWorker',
			vi.fn(function () {
				return worker;
			})
		);

		expect(await spawnSharedPlaygroundWorker('site')).toBeUndefined();
		expect(worker.port.close).toHaveBeenCalledOnce();
		expect(worker.port.start).not.toHaveBeenCalled();
	});

	it('connects to shared PHP when the browser accepts extendedLifetime', async () => {
		const worker = createWorker();
		vi.stubGlobal(
			'SharedWorker',
			vi.fn(function (_url, options) {
				expect(options.extendedLifetime).toBe(true);
				return worker;
			})
		);

		expect(await spawnSharedPlaygroundWorker('site')).toBe(worker);
		expect(worker.port.close).not.toHaveBeenCalled();
	});
});

function createWorker() {
	const port = Object.assign(new EventTarget(), {
		close: vi.fn(),
		start: vi.fn(() => {
			port.dispatchEvent(
				new MessageEvent('message', { data: 'worker-script-started' })
			);
		}),
	});
	return { port };
}
