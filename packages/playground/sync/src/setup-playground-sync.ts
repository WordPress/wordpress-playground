import { PlaygroundClient } from '@wp-playground/remote';
import { installSqlSyncMuPlugin, overrideAutoincrementSequences } from './sql';
import { journalFSOperations, replayFSJournal } from './fs';
import { SQLJournalEntry, journalSQLQueries, replaySQLJournal } from './sql';
import { PlaygroundSyncTransport, TransportEnvelope } from './transports';
import { FilesystemOperation } from '@php-wasm/universal';
import { SyncMiddleware, marshallSiteURLMiddleware } from './middleware';
import { pruneSQLQueriesMiddleware } from './middleware/prune-sql-queries';

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
		...middlewares,
	];

	await installSqlSyncMuPlugin(playground);
	await overrideAutoincrementSequences(playground, autoincrementOffset);

	transport.onChangesReceived(async (changes) => {
		changes = middlewares.reduce(
			(acc, middleware) => middleware.afterReceive(acc),
			changes
		);
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
