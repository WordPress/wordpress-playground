import { startPlaygroundWeb } from '@wp-playground/client';
import { login } from '@wp-playground/blueprints';
import { FilesystemOperation } from '@php-wasm/universal';
import { recordFSOperations, replayFSOperations } from './fs';
import {
	idOffset,
	SQLQueryMetadata,
	recordSQLQueries,
	replaySQLQueries,
} from './sql';
import { ParentWindowTransport } from './transports';

const playground = await startPlaygroundWeb({
	iframe: document.getElementById('wp') as HTMLIFrameElement,
	remoteUrl: 'http://localhost:4400/remote.html',
});

// This is to improve the log messages a bit when running two clients in the same tab.
// @TODO: Remove this
const clientId: string | null = new URLSearchParams(
	document.location.search
).get('id');

console.log({ clientId, idOffset });

recordSQLQueries(playground, (queries: SQLQueryMetadata[]) => {
	console.log(`[${clientId}] Sending SQL!`, {
		debugClientId: clientId,
		queries,
	});
	transport.broadcastChange({ scope: 'sql', details: queries });
});
recordFSOperations(playground, (op: FilesystemOperation) => {
	console.log(`[${clientId}] Sending file`, op);
	transport.broadcastChange({ scope: 'fs', details: op });
});

const transport = new ParentWindowTransport();
transport.onChangeReceived(async ({ scope, details }) => {
	console.log(`[${clientId}][onChangeReceived][${scope}]`, details);
	if (scope === 'fs') {
		await replayFSOperations(playground, [details]);
	} else if (scope === 'sql') {
		await replaySQLQueries(playground, details);
	}
});

await login(playground, { username: 'admin', password: 'password' });
await playground.goTo('/');

/*

	let flushTimeout: number | null = null;
	function debouncedFlush() {
		if (null !== flushTimeout) {
			clearTimeout(flushTimeout);
		}
		flushTimeout = setTimeout(() => {
			flushTimeout = null;
			const dataToBroadcast = committedQueries;
			committedQueries = [];
			onFlush(dataToBroadcast);
		}, debounceDelay) as any;
	}
*/
