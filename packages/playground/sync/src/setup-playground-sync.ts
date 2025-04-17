import type { PlaygroundClient } from '@wp-playground/remote';
import { installSqlSyncMuPlugin, overrideAutoincrementSequences } from './sql';
import { journalFSOperations } from './fs';
import type { SQLJournalEntry } from './sql';
import { journalSQLQueries, replaySQLJournal } from './sql';
import type { PlaygroundSyncTransport, TransportEnvelope } from './transports';
import type { FilesystemOperation } from '@php-wasm/fs-journal';
import type { SyncMiddleware } from './middleware';
import { marshallSiteURLMiddleware } from './middleware';
import { pruneSQLQueriesMiddleware } from './middleware/prune-sql-queries';
import { hydrateFsWritesMiddleware } from './middleware/hydrate-fs-writes';

export interface SyncOptions {
	autoincrementOffset: number;
	transport: PlaygroundSyncTransport;
	middlewares?: SyncMiddleware[];
}

export async function setupPlaygroundSync(
	playground: PlaygroundClient,
	{ autoincrementOffset, transport, middlewares = [] }: SyncOptions
) {
	middlewares = [
		pruneSQLQueriesMiddleware(),
		marshallSiteURLMiddleware(await playground.absoluteUrl),
		hydrateFsWritesMiddleware(playground),
		...middlewares,
	];

	await installSqlSyncMuPlugin(playground);
	await overrideAutoincrementSequences(playground, autoincrementOffset);

	transport.onChangesReceived(async (changes) => {
		for (const middleware of middlewares) {
			changes = await middleware.afterReceive(changes);
		}
		await playground.replayFSJournal(changes.fs);
		await replaySQLJournal(playground, changes.sql);
	});

	let localChanges: TransportEnvelope = { fs: [], sql: [] };
	journalSQLQueries(playground, (query: SQLJournalEntry) => {
		localChanges.sql.push(query);
	});
	journalFSOperations(playground, (op: FilesystemOperation) => {
		localChanges.fs.push(op);
	});

	// Flush the journal at most every 3 seconds
	const flushJournal = async () => {
		let flushedChanges = localChanges;
		localChanges = { fs: [], sql: [] };
		for (const middleware of middlewares) {
			flushedChanges = await middleware.beforeSend(flushedChanges);
		}
		if (!flushedChanges.sql.length && !flushedChanges.fs.length) {
			return;
		}
		transport.sendChanges(flushedChanges);
	};

	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	const loopAfterInterval = async (f: Function, ms: number) => {
		await f();
		setTimeout(loopAfterInterval, ms, f, ms);
	};

	loopAfterInterval(flushJournal, 3000);
}
