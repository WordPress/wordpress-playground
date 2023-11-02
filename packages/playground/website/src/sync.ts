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
const result2 = await playground.run({
	code: `<?php
	require '/wordpress/wp-load.php';
	update_option('playground_id_offset', ${phpVar(idOffset)});
	playground_bump_autoincrements();
	`,
});

if (clientId === 'left') {
	console.log(result2.text);

	const result = await playground.run({
		code: `<?php
		require '/wordpress/wp-load.php';
		$result = $wpdb->query("INSERT INTO wp_posts(ID,to_ping,pinged,post_content_filtered,post_excerpt, post_author, post_title, post_content, post_status) VALUES(10000000,'','','','', 1, 'this is rolled back and we dont want to see this', '', 'publish')");
		var_dump($result);
		var_dump($wpdb->insert_id);
		var_dump($wpdb->last_error);
		echo "\\nupdating sqlite_sequence ";
		$result = $wpdb->query("update sqlite_sequence set seq=200;");
		var_dump($result);
		echo "\\ninserting new post into wp_posts ";
		$result = $wpdb->query("INSERT INTO wp_posts(to_ping,pinged,post_content_filtered,post_excerpt, post_author, post_title, post_content, post_status) VALUES('','','','', 1, 'this is committed and we do want to see this', '', 'publish')");
		var_dump($result);
		var_dump($wpdb->insert_id);
		`,
	});
	
	
	console.log(result.text);
	throw new Error();
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

type SQLQueryMetadata = {
	type: 'sql';
	subtype: 'query';
	query: string;
	query_type: string;
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
	if (message.subtype === 'query' && message.query_type === 'SELECT') {
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

	// It's a regular query
	if (activeTransaction) {
		activeTransaction.push(message);
	} else {
		committedQueries.push(message);
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
	await playground
		.run({
			code: `<?php
		// Prevent reporting changes from queries we're just replaying
		$GLOBALS['@REPLAYING_SQL'] = true;

		// Only load WordPress now
		require '/wordpress/wp-load.php';

		$queries = ${js.queries};
		foreach($queries as $query) {
			/**
			 * If we're INSERT-ing to a table with an autoincrement
			 * column, this peer uses a different sequence offset than
			 * the remote peer. Simply replaying inserts won't suffice
			 * to reconcile the changes as we're going to have different
			 * IDs on both ends.
			 * 
			 * We need to:
			 * * Store the autoincrement sequence value
			 * * Replay INSERT
			 * * Immediately update the ID to the same one as the remote assigned
			 * * Restore the original autoincrement sequence value
			 */
			$assign_peer_pk = (
				$query['query_type'] === "INSERT" &&
				!!$query['auto_increment_column'] &&
				!!$query['last_insert_id']
			);
			// Store the autoincrement sequence value:
			if ( $assign_peer_pk ) {
				$pdo = $GLOBALS['@pdo'];
				$stmt = $pdo->prepare("SELECT seq FROM sqlite_sequence WHERE name = :table_name");
				$table_name = $query['table_name'];
				$stmt->bindParam("table_name", $table_name);
				$stmt->execute();
				$row = $stmt->fetch();
				$last_local_pk = $row['seq'];
				$next_local_pk = $last_local_pk + 1;
			}

			// Replay query
			try {
				// PROBLEM: SQLITE stubbornly sets the sequence value to MAX(id)+1 and 
				//          it does that BEFORE inserting. Hmm! Hopefully there is a 
				//          setting to make it more naive and just use seq + 1
				$result = $wpdb->query($query['query']);
				// var_dump($result);
			} catch(PDOException $e) {
				/**
				 * Let's ignore errors related to UNIQUE constraints violation.
				 * Sometimes we'll ignore something we shouldn't, but for the most
				 * part, they are related to surface-level core mechanics like transients.
				 * 
				 * In the future, let's implement pattern matching on queries and
				 * prevent synchronizing things like transients.
				 */
				var_dump($query['query']);
				var_dump("PDO Exception! " . $e->getMessage());
				var_dump($e->getCode());
				if($e->getCode() === 19) {
					continue;
				}
				throw $e;
			}

			if ( $assign_peer_pk ) {
				// Two things just happened:
				// 1. The autoincrement sequence value was bumped
				// 2. A record was created with that bumped value as primary key
				// 
				// Let's:
				// 1. Update that record to have the same ID as assigned by the remote peer
				// 2. Restore the previous autoincrement sequence value

				// ===> Update that record to have the same ID as assigned by the remote peer
				$pk_column = $query['auto_increment_column'];
				$stmt = $pdo->prepare(<<<SQL
					UPDATE $table_name 
						SET $pk_column = :peer_pk
						WHERE $pk_column = :next_local_pk
				SQL
				);
				$stmt->bindParam(':peer_pk', $query['last_insert_id']);
				$stmt->bindParam(':next_local_pk', $next_local_pk);
				// echo "\\n\\nRestoring primary key value from peer\\n\\n";
				// echo "QUERY: \\n";
				// echo $query['query'] . "\\n\\n";
				// echo "REWIND: \\n";
				// echo "UPDATE $table_name SET $pk_column = ". $query['last_insert_id'] ." WHERE $pk_column = $next_local_pk\\n\\n";
				$stmt->execute();

				// ===> Restore the previous autoincrement sequence value
				$stmt = $pdo->prepare(<<<SQL
					UPDATE sqlite_sequence
						SET seq = :last_local_pk
						WHERE name = :table_name
				SQL
				);
				$stmt->bindParam("last_local_pk", $last_local_pk);
				$stmt->bindParam("table_name", $table_name);
				$stmt->execute();
			}
		}
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
