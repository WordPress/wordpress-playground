import { startPlaygroundWeb } from '@wp-playground/client';
import { login } from '@wp-playground/blueprints';
import { FilesystemOperation } from '@php-wasm/universal';
import { recordFSOperations, replayFSOperations } from './fs';
import {
	SQLQueryMetadata,
	recordSQLQueries,
	replaySQLQueries,
	installSqlSyncMuPlugin,
} from './sql';
import { ParentWindowTransport, TransportMessage } from './transports';
import { debounce } from './utils';

const playground = await startPlaygroundWeb({
	iframe: document.getElementById('wp') as HTMLIFrameElement,
	remoteUrl: 'http://localhost:4400/remote.html',
});

// This is to improve the log messages a bit when running two clients in the same tab.
// @TODO: Remove this
const clientId: string | null = new URLSearchParams(
	document.location.search
).get('id');

// @TODO: Offset strategy. If we just discard this after each session and then
//        pick a new one, we'll quickly run into conflicts. Let's figure out
//        what is needed here. Do we have to synchronize this with the remote peer?
//        Remember it for later? How do we restore the values from the local playground_sequence
//        table? etc.
export const idOffset = Math.round(Math.random() * 1_000_000);
console.log({ clientId, idOffset });

await installSqlSyncMuPlugin(playground, idOffset);

let changes: TransportMessage[] = [];
const debouncedFlush = debounce(() => {
	console.log(`[${clientId}] Sending changes!`, changes);
	transport.sendChanges(changes);
	changes = [];
}, 3000);

recordSQLQueries(playground, (queries: SQLQueryMetadata[]) => {
	changes.push({ scope: 'sql', details: queries });
	debouncedFlush();
});
recordFSOperations(playground, (ops: FilesystemOperation[]) => {
	changes.push({ scope: 'fs', details: ops });
	debouncedFlush();
});

const transport = new ParentWindowTransport();
transport.onChangesReceived(async (changes) => {
	for (const { scope, details } of changes) {
		console.log(`[${clientId}][onChangeReceived][${scope}]`, details);
		if (scope === 'fs') {
			await replayFSOperations(playground, details);
		} else if (scope === 'sql') {
			await replaySQLQueries(playground, details);
		}
	}
});

await login(playground, { username: 'admin', password: 'password' });
await playground.goTo('/');
