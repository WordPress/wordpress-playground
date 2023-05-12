import { startServer } from '@wp-now/wp-now';
import { parentPort } from 'worker_threads';

async function start(config: any) {
	const server = await startServer(config);
	parentPort!.postMessage({
		...server.options,
		command: 'server-started',
		url: server.url,
	});
}

parentPort!.on('message', (message) => {
	switch (message.command) {
		case 'start-server':
			start(message.config);
			break;
	}
});
