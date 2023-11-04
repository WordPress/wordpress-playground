import { startPlaygroundWeb } from '@wp-playground/client';
import { login } from '@wp-playground/blueprints';
import { setupPlaygroundSync } from '.';
import { ParentWindowTransport } from './transports';

export async function runDemo(iframe: HTMLIFrameElement, clientId: string) {
	const playground = await startPlaygroundWeb({
		iframe,
		remoteUrl: 'http://localhost:4400/remote.html',
	});

	await setupPlaygroundSync(playground, {
		// To build a multi-session app with seamless page refresh
		// and transitions between devices, store this idOffset and
		// all SQL and FS between page refreshes.
		// Use them to reinstate the state on new devices and after a
		// page refresh.
		autoincrementOffset: Math.round(Math.random() * 1_000_000),
		transport: new ParentWindowTransport(),
		logger: {
			log(...args: any[]) {
				console.log(`[${clientId}]`, ...args);
			},
		},
	});

	await login(playground, { username: 'admin', password: 'password' });
	await playground.goTo('/');
}
