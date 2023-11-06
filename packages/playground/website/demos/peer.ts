import { startPlaygroundWeb } from '@wp-playground/client';
import { login } from '@wp-playground/blueprints';
import {
	setupPlaygroundSync,
	ParentWindowTransport,
	loggerMiddleware,
} from '@wp-playground/sync';

export async function runDemo(
	iframe: HTMLIFrameElement,
	clientId: string,
	autoincrementOffset: number
) {
	const playground = await startPlaygroundWeb({
		iframe,
		remoteUrl: 'http://localhost:4400/remote.html',
	});
	const siteURL = await playground.absoluteUrl;
	console.log({ clientId, siteURL });
	await setupPlaygroundSync(playground, {
		autoincrementOffset,
		transport: new ParentWindowTransport(),
		middlewares: [loggerMiddleware(clientId)],
	});

	await login(playground, { username: 'admin', password: 'password' });
	await playground.goTo('/');
}
