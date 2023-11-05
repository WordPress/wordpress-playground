import { PlaygroundClient } from '@wp-playground/remote';
import { installSqlSyncMuPlugin, overrideAutoincrementSequences } from './sql';
import { journalFSOperations, replayFSJournal } from './fs';
import { SQLJournalEntry, journalSQLQueries, replaySQLJournal } from './sql';
import { PlaygroundSyncTransport, TransportEnvelope } from './transports';
import { FilesystemOperation } from '@php-wasm/fs-journal';
import { SyncMiddleware, marshallSiteURLMiddleware } from './middleware';
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
		const fsOperations = changes
			.filter(({ scope }) => scope === 'fs')
			.map(({ contents: details }) => details) as FilesystemOperation[];
		await replayFSJournal(playground, fsOperations);

		const sqlQueries = changes
			.filter(({ scope }) => scope === 'sql')
			.map(({ contents: details }) => details) as SQLJournalEntry[];
		await replaySQLJournal(playground, sqlQueries);
	});

	let localChanges: TransportEnvelope[] = [];
	journalSQLQueries(playground, (query: SQLJournalEntry) => {
		localChanges.push({ scope: 'sql', contents: query });
	});
	journalFSOperations(playground, (op: FilesystemOperation) => {
		localChanges.push({ scope: 'fs', contents: op });
	});

	// Flush the journal at most every 3 seconds
	const flushJournal = async () => {
		let flushedChanges = localChanges;
		localChanges = [];
		for (const middleware of middlewares) {
			flushedChanges = await middleware.beforeSend(flushedChanges);
		}
		if (!flushedChanges.length) {
			return;
		}
		transport.sendChanges(flushedChanges);
	};

	const loopAfterInterval = async (f: Function, ms: number) => {
		await f();
		setTimeout(loopAfterInterval, ms, f, ms);
	};

	loopAfterInterval(flushJournal, 3000);
}
