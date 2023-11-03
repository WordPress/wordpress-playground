/*
 * TODO:
 * * !! SQLITE stubbornly sets the sequence value to MAX(id)+1
 * * Add unit tests
 * * Confirm everything works in cases like:
 *   * Unique constraint violations
 *   * Failed SQL queries
 *   * Queries without transactions
 *   * Commits and rollbacks in transactions
 *   * Transactions without the final commit (request died prematurely)
 *   * Nested transactions
 *   * Conflicting SQL queries
 *   * Conflicting FS operations
 * * Do not sync transients, site URL, etc.
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
 * * When the remote peer receives a query, it replays it on its end
 *   as it is.
 */

import { phpVar, phpVars, startPlaygroundWeb } from '@wp-playground/client';
import { login } from '@wp-playground/blueprints';
import { FilesystemOperation, IsomorphicLocalPHP } from '@php-wasm/universal';
import { Semaphore } from '@php-wasm/util';
import patchedSqliteTranslator from './class-wp-sqlite-translator.php?raw';

const playground = await startPlaygroundWeb({
	iframe: document.getElementById('wp') as HTMLIFrameElement,
	remoteUrl: 'http://localhost:4400/remote.html',
});
await playground.writeFile(
	'/wordpress/wp-content/plugins/sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-translator.php',
	patchedSqliteTranslator
);
const idOffset = Math.round(Math.random() * 1_000_000);
const clientId = new URLSearchParams(document.location.search).get('id');
console.log({
	clientId,
	idOffset,
});

const initializationResult = await playground.run({
	code: `<?php
	require '/wordpress/wp-load.php';

	playground_override_autoincrement_algorithm(${phpVar(idOffset)});
	`,
});
if (clientId === 'left') {
	if (initializationResult.errors) {
		console.log(initializationResult.text);
		console.log(initializationResult.errors);
		throw new Error();
	}
}

await login(playground, { username: 'admin', password: 'password' });
await playground.goTo('/');

type ChangeScope = 'fs' | 'sql';
function broadcastChange(scope: ChangeScope, details: any) {
	window.top?.postMessage(
		{
			type: 'playground-change',
			scope,
			details,
		},
		'*'
	);
}
function onChangeReceived<T extends SQLQueryMetadata[] | FSChange>(
	scope: ChangeScope,
	fn: (details: T) => void
) {
	window.addEventListener('message', (event) => {
		if (event.data.type !== 'playground-change') {
			return;
		}
		if (event.data.scope !== scope) {
			return;
		}
		fn(event.data.details);
	});
}

type FSChange = {
	type: 'fs';
} & FilesystemOperation;

type SQLQueryMetadata =
	| {
			type: 'sql';
			subtype: 'replay-query';
			query: string;
			query_type: string;
			table_name: string;
			auto_increment_column: string;
			last_insert_id: number;
	  }
	| {
			type: 'sql';
			subtype: 'reconstruct-query';
			query_type: 'INSERT';
			row: Record<string, unknown>;
			table_name: string;
			auto_increment_column: string;
			last_insert_id: number;
	  };

type SQLTransactionCommand =
	| {
			type: 'sql';
			subtype: 'transaction';
			command: 'START TRANSACTION';
			success: boolean;
	  }
	| {
			type: 'sql';
			subtype: 'transaction';
			command: 'COMMIT';
			success: boolean;
	  }
	| {
			type: 'sql';
			subtype: 'transaction';
			command: 'ROLLBACK';
			success: boolean;
	  };

let committedQueries: SQLQueryMetadata[] = [];
let activeTransaction: SQLQueryMetadata[] | null = null;
playground.onMessage(async (messageString) => {
	const message = JSON.parse(messageString) as
		| SQLQueryMetadata
		| SQLTransactionCommand;
	if (message.type !== 'sql') {
		return;
	}
	if (message.subtype === 'transaction') {
		if (!message.success) {
			return;
		}
		switch (message.command) {
			case 'START TRANSACTION':
				activeTransaction = [];
				break;
			case 'COMMIT':
				if (activeTransaction?.length) {
					committedQueries = [
						...committedQueries,
						...activeTransaction,
					];
				}
				activeTransaction = null;
				break;
			case 'ROLLBACK':
				activeTransaction = null;
				break;
		}
		// @TODO: also rollback any active transactions when PHP request
		//        terminates. For example, by implementing
		//        php.addEventListener('request.done', () => { ... });
		return;
	}

	if (
		message.subtype === 'replay-query' ||
		message.subtype === 'reconstruct-query'
	) {
		if (message.query_type === 'SELECT') {
			return;
		}

		if (activeTransaction) {
			activeTransaction.push(message);
		} else {
			committedQueries.push(message);
		}
	}

	debouncedFlushSQLQueries();
});

let flushTimeout: number | null = null;
function debouncedFlushSQLQueries() {
	if (null !== flushTimeout) {
		clearTimeout(flushTimeout);
	}
	flushTimeout = setTimeout(() => {
		console.log(`[${clientId}] Broadcasting sql!`, {
			clientId,
			committedTransactions: committedQueries,
		});
		flushTimeout = null;
		const dataToBroadcast = committedQueries;
		committedQueries = [];
		broadcastChange('sql', dataToBroadcast);
	}, 3000) as any;
}

onChangeReceived<SQLQueryMetadata[]>('sql', async (queries) => {
	console.log(`[${clientId}][onChangeReceived][SQL]`, queries);
	await replaySqlQuery(queries);
});

async function replaySqlQuery(queries: SQLQueryMetadata[]) {
	const js = phpVars({ queries });
	console.log(js);
	await playground
		.run({
			code: `<?php
		// Prevent reporting changes from queries we're just replaying
		$GLOBALS['@REPLAYING_SQL'] = true;

		// Only load WordPress and replay the SQL queries now
		require '/wordpress/wp-load.php';
		playground_sync_replay_queries(${js.queries});
	`,
		})
		.then((r) => {
			if (r.text.trim() || r.errors.trim()) {
				console.log(`[${clientId}] `, r.text);
				console.log(`[${clientId}] `, r.errors);
			}
		})
		.catch((e) => {
			console.log(js.queries);
			console.dir(e);
			console.log(e);
			console.error(e);
		});
}

const journal: FilesystemOperation[] = [];
playground.journalMemfs(async (op: FilesystemOperation) => {
	if (
		op.path.endsWith('/.ht.sqlite') ||
		op.path.endsWith('/.ht.sqlite-journal')
	) {
		return;
	}
	if (op.operation === 'UPDATE_FILE') {
		op.data = await playground.readFileAsBuffer(op.path);
	}
	console.log(`[${clientId}] Journaling`, op);
	journal.push(op);
	broadcastChange('fs', op);
});

const fsLock = new Semaphore({ concurrency: 1 });
onChangeReceived<FSChange>('fs', async (op) => {
	const release = await fsLock.acquire();
	try {
		console.log(`[${clientId}][FS] `, op);
		await playground.atomic(
			function (php: IsomorphicLocalPHP, op: FilesystemOperation) {
				php.__journalingDisabled = true;
				try {
					if (op.operation === 'CREATE') {
						if (op.nodeType === 'file') {
							php.writeFile(op.path, ' ');
						} else {
							php.mkdir(op.path);
						}
					} else if (op.operation === 'DELETE') {
						if (op.nodeType === 'file') {
							php.unlink(op.path);
						} else {
							php.rmdir(op.path, {
								recursive: true,
							});
						}
					} else if (op.operation === 'UPDATE_FILE') {
						php.writeFile(op.path, op.data);
					} else if (op.operation === 'RENAME') {
						php.mv(op.path, op.toPath);
					}
				} finally {
					php.__journalingDisabled = false;
				}
			}.toString(),
			[op]
		);
	} finally {
		release();
	}
});

// Use this as a unit test later on:
// const result = await playground.run({
// 	code: `<?php
// 	require '/wordpress/wp-load.php';
// 	$wpdb->query("BEGIN");
// 	$result = $wpdb->query("INSERT INTO wp_posts(to_ping,pinged,post_content_filtered,post_excerpt, post_author, post_title, post_content, post_status) VALUES('','','','', 1, 'this is rolled back and we dont want to see this', '', 'publish')");
// 	var_dump($result);
// 	$wpdb->query("ROLLBACK");
// 	$wpdb->query("BEGIN");
// 	$result = $wpdb->query("INSERT INTO wp_posts(to_ping,pinged,post_content_filtered,post_excerpt, post_author, post_title, post_content, post_status) VALUES('','','','', 1, 'this is committed and we do want to see this', '', 'publish')");
// 	var_dump($result);
// 	$wpdb->query("COMMIT");
// 	`,
// });
// console.log('I just executed the thing, here is the result: ', result.text);

// Refresh after applying incoming changes. Is this actually useful, though?
// let refreshTimeout: any = null;
// if (refreshTimeout) {
//     clearTimeout(refreshTimeout);
// }
// refreshTimeout = setTimeout(() => {
//     client2.getCurrentURL().then((url) => {
//         client2.goTo(url);
//     });
// }, 150);

// const result = await playground.run({
// 	code: `<?php
// 	require '/wordpress/wp-load.php';
// 	$result = $wpdb->query("INSERT INTO wp_posts(ID,to_ping,pinged,post_content_filtered,post_excerpt, post_author, post_title, post_content, post_status) VALUES(10000000,'','','','', 1, 'this is rolled back and we dont want to see this', '', 'publish')");
// 	echo "\\ninserting new post into wp_posts: ";
// 	var_dump($result);
// 	echo "Insert id: \\n";
// 	var_dump($wpdb->insert_id);
// 	echo "Last error: \\n";
// 	var_dump($wpdb->last_error);
// 	echo "\\nupdating playground_sequence ";
// 	$result = $wpdb->query("update playground_sequence set seq=200;");
// 	var_dump($result);
// 	echo "\\ninserting new post into wp_posts ";
// 	$result = $wpdb->query("INSERT INTO wp_posts(to_ping,pinged,post_content_filtered,post_excerpt, post_author, post_title, post_content, post_status) VALUES('','','','', 1, 'this is committed and we do want to see this', '', 'publish')");
// 	var_dump($result);
// 	var_dump($wpdb->insert_id);
// 	echo "\\ninserting another new post into wp_posts ";
// 	$result = $wpdb->query("INSERT INTO wp_posts(to_ping,pinged,post_content_filtered,post_excerpt, post_author, post_title, post_content, post_status) VALUES('','','','', 1, 'this is committed and we do want to see 33this', '', 'publish')");
// 	var_dump($result);
// 	var_dump($wpdb->insert_id);

// 	`,
// });
