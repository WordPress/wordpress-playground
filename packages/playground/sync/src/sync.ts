/*
 * TODO:
 * ✅ !! SQLITE stubbornly sets the sequence value to MAX(id)+1
 * * Do not sync transients, site URL, etc.
 * * Add unit tests for cases like:
 *   * Failed SQL queries
 *   * Transactions without the final commit (request died prematurely)
 *   * Conflicting SQL queries
 *   * Conflicting FS operations
 *   * Nested transactions
 *   * Unique constraint violations
 *   * Queries without transactions
 *   * Commits and rollbacks in transactions
 */

/**
 * SQL syncing strategy:
 *
 * * When the local WordPress issues a query, we record it in a buffer
 *   and broadcast it to the remote peer.
 * * Whenever an autoincrement value is generated:
 *    1. We override the SQLite-assigned sequence value with the next
 *       relevant value from playground_sequence.
 *    2. We fetch the entire row from the database and transmit it as
 *       JSON to the remote peer.
 * * The remote peer receives the query and executes it.
 */

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
