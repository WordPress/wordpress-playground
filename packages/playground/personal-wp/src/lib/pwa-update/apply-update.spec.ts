import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyAppUpdate } from './apply-update';

describe('applyAppUpdate', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('reloads immediately when service workers are unavailable', async () => {
		const reload = vi.fn();

		await applyAppUpdate({
			serviceWorker: undefined,
			reload,
		});

		expect(reload).toHaveBeenCalledOnce();
	});

	it('updates the service worker and reloads after controllerchange', async () => {
		const reload = vi.fn();
		const registration = {
			update: vi.fn(async () => {}),
		};
		const listeners = new Set<EventListener>();
		const serviceWorker = {
			addEventListener: vi.fn(
				(_type: 'controllerchange', listener: EventListener) => {
					listeners.add(listener);
				}
			),
			removeEventListener: vi.fn(
				(_type: 'controllerchange', listener: EventListener) => {
					listeners.delete(listener);
				}
			),
			getRegistration: vi.fn(async () => registration),
		};

		const updatePromise = applyAppUpdate({
			serviceWorker,
			reload,
			timeoutMs: 1000,
		});
		await Promise.resolve();
		for (const listener of listeners) {
			listener({} as Event);
		}
		await updatePromise;

		expect(registration.update).toHaveBeenCalledOnce();
		expect(reload).toHaveBeenCalledOnce();
	});

	it('reloads after the timeout when update fails', async () => {
		vi.useFakeTimers();
		const reload = vi.fn();
		const serviceWorker = {
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			getRegistration: vi.fn(async () => ({
				update: vi.fn(async () => {
					throw new Error('update failed');
				}),
			})),
		};

		const updatePromise = applyAppUpdate({
			serviceWorker,
			reload,
			timeoutMs: 50,
		});
		await Promise.resolve();
		await vi.advanceTimersByTimeAsync(50);
		await updatePromise;

		expect(reload).toHaveBeenCalledOnce();
	});
});
