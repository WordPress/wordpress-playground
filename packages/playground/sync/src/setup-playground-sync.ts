import { PlaygroundClient } from '@wp-playground/remote';
import { installSqlSyncMuPlugin, overrideAutoincrementSequences } from './sql';
import { recordFSOperations, replayFSOperations } from './fs';
import { SQLQueryMetadata, recordSQLQueries, replaySQLQueries } from './sql';
import { PlaygroundSyncTransport, TransportMessage } from './transports';
import { debounce } from './utils';
import { FilesystemOperation } from '@php-wasm/universal';
import type { SyncMiddleware } from './middleware';

export interface SyncOptions {
	autoincrementOffset: number;
	transport: PlaygroundSyncTransport;
	middlewares?: SyncMiddleware[];
}

export async function setupPlaygroundSync(
	playground: PlaygroundClient,
	{ autoincrementOffset, transport, middlewares = [] }: SyncOptions
) {
	await installSqlSyncMuPlugin(playground);
	await overrideAutoincrementSequences(playground, autoincrementOffset);

	transport.onChangesReceived(async (changes) => {
		changes = middlewares.reduce(
			(acc, middleware) => middleware.afterReceive(acc),
			changes
		);
		for (const { scope, details } of changes) {
			if (scope === 'fs') {
				await replayFSOperations(playground, details);
			} else if (scope === 'sql') {
				await replaySQLQueries(playground, details);
			}
		}
	});

	let localChanges: TransportMessage[] = [];
	const debouncedFlush = debounce(() => {
		localChanges = middlewares.reduce(
			(acc, middleware) => middleware.beforeSend(acc),
			localChanges
		);
		transport.sendChanges(localChanges);
		localChanges = [];
	}, 3000);

	recordSQLQueries(playground, (queries: SQLQueryMetadata[]) => {
		localChanges.push({ scope: 'sql', details: queries });
		debouncedFlush();
	});
	recordFSOperations(playground, (ops: FilesystemOperation[]) => {
		localChanges.push({ scope: 'fs', details: ops });
		debouncedFlush();
	});
}
