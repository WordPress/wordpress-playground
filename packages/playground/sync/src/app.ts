import { startPlaygroundWeb } from '@wp-playground/client';
import { login } from '@wp-playground/blueprints';
import { setupPlaygroundSync } from '.';
import { ParentWindowTransport } from './transports';

const playground = await startPlaygroundWeb({
	iframe: document.getElementById('wp') as HTMLIFrameElement,
	remoteUrl: 'http://localhost:4400/remote.html',
});

// To distinguish log messages from different Playground clients.
const clientId: string | null =
	new URLSearchParams(document.location.search).get('id') || 'local';

// @TODO: Store this idOffset and all SQL and FS between page refreshes.
//        Use them to reinstate the state after a refresh.
const autoincrementOffset = Math.round(Math.random() * 1_000_000);

await setupPlaygroundSync(playground, {
	autoincrementOffset,
	transport: new ParentWindowTransport(),
	logger: {
		log(...args: any[]) {
			console.log(`[${clientId}]`, ...args);
		},
	},
});

await login(playground, { username: 'admin', password: 'password' });
await playground.goTo('/');
