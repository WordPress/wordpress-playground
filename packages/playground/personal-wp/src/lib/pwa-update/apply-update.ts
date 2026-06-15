export const APP_UPDATE_RELOAD_TIMEOUT_MS = 3000;

type ServiceWorkerRegistrationLike = {
	update?: () => Promise<void>;
};

type ServiceWorkerContainerLike = {
	addEventListener: (
		type: 'controllerchange',
		listener: EventListener
	) => void;
	removeEventListener: (
		type: 'controllerchange',
		listener: EventListener
	) => void;
	getRegistration?: () => Promise<ServiceWorkerRegistrationLike | undefined>;
	ready?: Promise<ServiceWorkerRegistrationLike>;
};

type ApplyAppUpdateOptions = {
	serviceWorker?: ServiceWorkerContainerLike;
	reload?: () => void;
	timeoutMs?: number;
};

export async function applyAppUpdate({
	serviceWorker = getServiceWorker(),
	reload = reloadCurrentPage,
	timeoutMs = APP_UPDATE_RELOAD_TIMEOUT_MS,
}: ApplyAppUpdateOptions = {}): Promise<void> {
	if (!serviceWorker) {
		reload();
		return;
	}

	let didReload = false;
	const reloadOnce = () => {
		if (didReload) {
			return;
		}
		didReload = true;
		reload();
	};

	let removeControllerChangeListener = () => {};
	const controllerChanged = new Promise<void>((resolve) => {
		const onControllerChange = () => {
			removeControllerChangeListener();
			resolve();
		};
		removeControllerChangeListener = () => {
			serviceWorker.removeEventListener(
				'controllerchange',
				onControllerChange
			);
		};
		serviceWorker.addEventListener('controllerchange', onControllerChange);
	});

	try {
		const registration =
			(await serviceWorker.getRegistration?.()) ??
			(await serviceWorker.ready);
		await registration?.update?.();
	} catch {
		// Reload anyway. A fresh navigation can still pick up no-store HTML.
	}

	await Promise.race([
		controllerChanged,
		new Promise((resolve) => setTimeout(resolve, timeoutMs)),
	]);
	removeControllerChangeListener();
	reloadOnce();
}

function getServiceWorker(): ServiceWorkerContainerLike | undefined {
	if (typeof navigator === 'undefined') {
		return;
	}
	return navigator.serviceWorker;
}

function reloadCurrentPage() {
	window.location.reload();
}
