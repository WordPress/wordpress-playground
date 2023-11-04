import { startPlaygroundWeb } from '@wp-playground/client';
import { login } from '@wp-playground/blueprints';
import { setupPlaygroundSync } from '.';
import { ParentWindowTransport } from './transports';
import { loggerMiddleware, marshallSiteURLMiddleware } from './middleware';
import { pruneSQLQueriesMiddleware } from './middleware/prune-sql-queries';

export async function runDemo(iframe: HTMLIFrameElement, clientId: string, autoincrementOffset: number) {
	const playground = await startPlaygroundWeb({
		iframe,
		remoteUrl: 'http://localhost:4400/remote.html',
	});
	const siteURL = await playground.absoluteUrl;
	console.log({ clientId, siteURL });
	await setupPlaygroundSync(playground, {
		autoincrementOffset,
		transport: new ParentWindowTransport(),
		middlewares: [
			pruneSQLQueriesMiddleware(),
			marshallSiteURLMiddleware(siteURL),
			loggerMiddleware(clientId),
		],
	});

	await login(playground, { username: 'admin', password: 'password' });
	await playground.goTo('/');
}
