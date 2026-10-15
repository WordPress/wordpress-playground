import { runInThisContext } from 'node:vm';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { retryPlaygroundStartup } from '../../../../vite-extensions/vite-service-worker-recovery';

describe('startup service worker recovery', () => {
	let worker: EventTarget & { state: string };
	let serviceWorker: EventTarget & {
		controller: unknown;
		getRegistration: ReturnType<typeof vi.fn>;
	};
	let registration: {
		installing: unknown;
		waiting: unknown;
		active: unknown;
		update: ReturnType<typeof vi.fn>;
	};
	let reload: ReturnType<typeof vi.fn>;
	let button: HTMLButtonElement;
	let message: HTMLElement;
	let retry: typeof retryPlaygroundStartup;

	beforeEach(() => {
		vi.useFakeTimers();
		worker = Object.assign(new EventTarget(), { state: 'activated' });
		registration = {
			installing: null,
			waiting: null,
			active: worker,
			update: vi.fn().mockResolvedValue(undefined),
		};
		serviceWorker = Object.assign(new EventTarget(), {
			controller: worker,
			getRegistration: vi.fn().mockResolvedValue(registration),
		});
		reload = vi.fn();
		vi.stubGlobal('window', {
			location: {
				href: 'https://playground.test/?wp=6.8#blueprint',
				reload,
			},
		});
		vi.stubGlobal('navigator', { serviceWorker });
		vi.spyOn(console, 'error').mockImplementation(() => {});
		button = {
			disabled: false,
			textContent: 'Try again',
		} as HTMLButtonElement;
		message = { textContent: '' } as HTMLElement;
		// Execute the serialized function, as the HTML does, without imported dependencies.
		retry = runInThisContext(`(${retryPlaygroundStartup.toString()})`);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('requests an update before reloading an unchanged active worker', async () => {
		await retry(button, message);
		expect(serviceWorker.getRegistration).toHaveBeenCalledWith(
			window.location.href
		);
		expect(registration.update).toHaveBeenCalledOnce();
		expect(reload).toHaveBeenCalledOnce();
	});

	it('waits for both activation and control before reloading', async () => {
		const replacement = Object.assign(new EventTarget(), {
			state: 'installing',
		});
		registration.installing = replacement;
		const pending = retry(button, message);
		await vi.advanceTimersByTimeAsync(0);
		expect(reload).not.toHaveBeenCalled();
		replacement.state = 'activated';
		replacement.dispatchEvent(new Event('statechange'));
		await vi.advanceTimersByTimeAsync(0);
		expect(reload).not.toHaveBeenCalled();
		serviceWorker.controller = replacement;
		serviceWorker.dispatchEvent(new Event('controllerchange'));
		await pending;
		expect(reload).toHaveBeenCalledOnce();
	});

	it('shows an update failure and permits another attempt', async () => {
		registration.update.mockRejectedValueOnce(new Error('HTTP 403'));
		await retry(button, message);
		expect(reload).not.toHaveBeenCalled();
		expect(message.textContent).toContain('HTTP 403');
		expect(button.disabled).toBe(false);
		await retry(button, message);
		expect(reload).toHaveBeenCalledOnce();
	});

	it('does not reload after installation fails', async () => {
		worker.state = 'redundant';
		await retry(button, message);
		expect(reload).not.toHaveBeenCalled();
		expect(message.textContent).toContain('failed to install');
	});

	it('bounds a stalled update and ignores its late completion', async () => {
		let finishUpdate!: () => void;
		registration.update.mockReturnValue(
			new Promise<void>((resolve) => {
				finishUpdate = resolve;
			})
		);
		const pending = retry(button, message);
		await vi.advanceTimersByTimeAsync(15000);
		await pending;
		expect(button.disabled).toBe(false);
		expect(message.textContent).toContain('timed out');
		finishUpdate();
		await vi.advanceTimersByTimeAsync(0);
		expect(reload).not.toHaveBeenCalled();
	});

	it('reloads normally when no worker is registered', async () => {
		serviceWorker.getRegistration.mockResolvedValue(undefined);
		await retry(button, message);
		expect(registration.update).not.toHaveBeenCalled();
		expect(reload).toHaveBeenCalledOnce();
	});
});
