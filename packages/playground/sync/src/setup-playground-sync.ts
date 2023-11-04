import { PlaygroundClient } from '@wp-playground/remote';
import { installSqlSyncMuPlugin, overrideAutoincrementSequences } from './sql';
import { recordFSOperations, replayFSOperations } from './fs';
import { SQLQueryMetadata, recordSQLQueries, replaySQLQueries } from './sql';
import { PlaygroundSyncTransport, TransportMessage } from './transports';
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
		const fsOperations = changes
			.filter(({ scope }) => scope === 'fs')
			.map(({ details }) => details) as FilesystemOperation[];
		await replayFSOperations(playground, fsOperations);

		const sqlQueries = changes
			.filter(({ scope }) => scope === 'sql')
			.map(({ details }) => details) as SQLQueryMetadata[];
		await replaySQLQueries(playground, sqlQueries);
	});

	let localChanges: TransportMessage[] = [];
	recordSQLQueries(playground, (query: SQLQueryMetadata) => {
		localChanges.push({ scope: 'sql', details: query });
	});
	recordFSOperations(playground, (op: FilesystemOperation) => {
		localChanges.push({ scope: 'fs', details: op });
	});

	// Flush the journal at most every 3 seconds
	const flushJournal = () => {
		localChanges = middlewares.reduce(
			(acc, middleware) => middleware.beforeSend(acc),
			localChanges
		);
		if (!localChanges.length) {
			return;
		}
		transport.sendChanges(localChanges);
		localChanges = [];
	};

	const loopAfterInterval = (f: Function, ms: number) => {
		f();
		setTimeout(loopAfterInterval, ms, f, ms);
	};

	loopAfterInterval(flushJournal, 3000);
}
