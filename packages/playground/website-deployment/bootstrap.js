/** Static entry point shared by the app and sandbox; application code loads only after verification. */
const entry = document.querySelector('meta[name="playground-entry"]').content;
const role = entry === 'wordpress-bridge.html' ? 'sandbox' : 'app';

try {
	const release = await selectRelease();
	if (
		location.origin !==
		(role === 'app' ? release.appOrigin : release.wordPressOrigin)
	) {
		throw new Error(
			'This Playground page was loaded on the incorrect hostname.'
		);
	}
	const workerUrl = new URL(
		`/${role}-sw-${release.release}.js`,
		location.origin
	);
	workerUrl.searchParams.set('release', release.release);
	const registration = await navigator.serviceWorker.register(workerUrl, {
		type: 'module',
		scope: '/',
		updateViaCache: 'none',
	});
	try {
		await registration.update();
	} catch (error) {
		if (!registration.active) throw error;
	}
	const worker =
		registration.installing ?? registration.waiting ?? registration.active;
	if (!worker)
		throw new Error('The Playground service worker is unavailable.');
	await waitFor(() => worker.state === 'activated', worker, 'statechange');
	await waitFor(
		() => navigator.serviceWorker.controller?.scriptURL === workerUrl.href,
		navigator.serviceWorker,
		'controllerchange'
	);
	const status = await message(worker, { type: 'playground-worker-status' });
	if (
		status.protocol !== 1 ||
		status.role !== role ||
		status.release !== release.release
	) {
		throw new Error(
			'The Playground service worker does not match the selected release.'
		);
	}
	const root = `/releases/${release.release}/`;
	if (role === 'app') {
		const pinned = await message(worker, {
			type: 'playground-pin-release',
			root,
		});
		if (pinned.protocol !== 1 || pinned.root !== root)
			throw new Error('Unable to select the Playground release.');
		// The first navigation predates worker installation. Cache its small bootstrap
		// explicitly so a later offline navigation can run this same startup protocol.
		await Promise.all([fetch('/bootstrap.js'), fetch(location.href)]);
	}
	const response = await fetch(root + entry);
	if (!response.ok)
		throw new Error(`Playground startup failed: HTTP ${response.status}.`);
	const html = await response.text();
	// The installer pins resource URLs; preserve the document URL, query and blueprint fragment.
	document.open();
	document.write(html);
	document.close();
} catch (error) {
	console.error(error);
	const message = document.createElement('p');
	message.textContent =
		'Playground could not start. Check your connection and browser storage settings, then try again.';
	const retry = document.createElement('button');
	retry.textContent = 'Try again';
	retry.addEventListener('click', () => window.location.reload());
	document.body.replaceChildren(message, retry);
}

async function selectRelease() {
	let release;
	try {
		// Previous app workers already fetch / network-first. This also revalidates
		// an initial navigation supplied by the browser HTTP cache.
		const response = await fetch('/', { cache: 'no-store' });
		if (!response.ok)
			throw new Error('The Playground release selector is unavailable.');
		const html = new DOMParser().parseFromString(
			await response.text(),
			'text/html'
		);
		release = JSON.parse(
			html.getElementById('playground-release').textContent
		);
	} catch (error) {
		const controller = navigator.serviceWorker?.controller;
		if (!controller) throw error;
		const status = await message(controller, {
			type: 'playground-worker-status',
		});
		if (
			status.protocol !== 1 ||
			status.role !== role ||
			!/^release\.[a-zA-Z0-9]+$/.test(status.release)
		)
			throw error;
		const response = await fetch(
			`/releases/${status.release}/release.json`
		);
		if (!response.ok) throw error;
		release = await response.json();
	}
	if (
		release.protocol !== 1 ||
		typeof release.release !== 'string' ||
		!/^release\.[a-zA-Z0-9]+$/.test(release.release) ||
		new URL(release.appOrigin).origin !== release.appOrigin ||
		new URL(release.wordPressOrigin).origin !== release.wordPressOrigin ||
		release.appOrigin === release.wordPressOrigin
	)
		throw new Error('Invalid Playground release selector.');
	return release;
}

function waitFor(ready, target, event) {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(
			() =>
				finish(
					new Error(
						'The Playground service worker did not take control.'
					)
				),
			15000
		);
		const check = () => {
			if (target.state === 'redundant')
				finish(
					new Error(
						'The Playground service worker failed to install.'
					)
				);
			else if (ready()) finish();
		};
		function finish(error) {
			clearTimeout(timeout);
			target.removeEventListener(event, check);
			if (error) reject(error);
			else resolve();
		}
		target.addEventListener(event, check);
		check();
	});
}

function message(worker, data) {
	return new Promise((resolve, reject) => {
		const channel = new MessageChannel();
		const timeout = setTimeout(() => {
			channel.port1.close();
			reject(new Error('The Playground service worker did not respond.'));
		}, 10000);
		channel.port1.onmessage = (event) => {
			clearTimeout(timeout);
			channel.port1.close();
			resolve(event.data);
		};
		worker.postMessage(data, [channel.port2]);
	});
}
