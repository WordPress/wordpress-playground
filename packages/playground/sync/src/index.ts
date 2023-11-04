import { PlaygroundClient } from '@wp-playground/remote';
import { installSqlSyncMuPlugin, overrideAutoincrementSequences } from './sql';
import { recordFSOperations, replayFSOperations } from './fs';
import { SQLQueryMetadata, recordSQLQueries, replaySQLQueries } from './sql';
import { PlaygroundSyncTransport, TransportMessage } from './transports';
import { debounce } from './utils';
import { FilesystemOperation } from '@php-wasm/universal';

export interface SyncOptions {
	autoincrementOffset: number;
	transport: PlaygroundSyncTransport;
}

export async function setupPlaygroundSync(
	playground: PlaygroundClient,
	{ autoincrementOffset, transport }: SyncOptions
) {
	await installSqlSyncMuPlugin(playground);
	await overrideAutoincrementSequences(playground, autoincrementOffset);

	let changes: TransportMessage[] = [];
	const debouncedFlush = debounce(() => {
		transport.sendChanges(changes);
		changes = [];
	}, 3000);

	recordSQLQueries(playground, (queries: SQLQueryMetadata[]) => {
		changes.push({ scope: 'sql', details: queries });
		debouncedFlush();

		// Track autoincrement values like this:
		// for (const query of queries) {
		// 	if (query.subtype === 'reconstruct-insert') {
		// 		storedIds[query.table_name] = query.last_insert_id;
		// 	}
		// }
	});
	recordFSOperations(playground, (ops: FilesystemOperation[]) => {
		changes.push({ scope: 'fs', details: ops });
		debouncedFlush();
	});

	transport.onChangesReceived(async (changes) => {
		for (const { scope, details } of changes) {
			if (scope === 'fs') {
				await replayFSOperations(playground, details);
			} else if (scope === 'sql') {
				await replaySQLQueries(playground, details);
			}
		}
	});
}
