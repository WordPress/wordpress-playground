import { phpVar, phpVars, startPlaygroundWeb } from '@wp-playground/client';
import { login } from '@wp-playground/blueprints';
import { FilesystemOperation } from '@php-wasm/universal';
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
await playground.run({
	code: `<?php
	require '/wordpress/wp-load.php';
	update_option('playground_id_offset', ${phpVar(idOffset)});
	playground_bump_autoincrements();
	`,
});

await login(playground, { username: 'admin', password: 'password' });
await playground.goTo('/');

function broadcastChange(scope: string, details: any) {
	window.top?.postMessage(
		{
			type: 'playground-change',
			scope,
			details,
		},
		'*'
	);
}

type SQLChange = {
	type: 'sql';
	query: string;
	query_type: string;
	table_name: string;
	auto_increment_column: string;
	last_insert_id: number;
};
type FSChange = {
	type: 'fs';
} & FilesystemOperation;

type ChangeType = SQLChange | FSChange;
function onChangeReceived<T extends ChangeType>(
	scope: string,
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

playground.onMessage(async (messageString) => {
	const { type, ...data } = JSON.parse(messageString) as SQLChange;
	if (type !== 'sql') {
		return;
	}
	if (data.query_type === 'SELECT') {
		return;
	}
	broadcastChange('sql', data);
});

onChangeReceived<SQLChange>('sql', async (data) => {
	console.log('[onChangeReceived][SQL]', data);

	const js = phpVars(data);
	playground
		.run({
			code: `<?php
		// Prevent reporting changes from queries we're just replaying
		$GLOBALS['@REPLAYING_SQL'] = true;

		// Only load WordPress now
		require '/wordpress/wp-load.php';

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
		$rewrite_autoincrement = (
			${js.query_type} === "INSERT" &&
			!!${js.auto_increment_column} &&
			!!${js.last_insert_id}
		);
		// Store the autoincrement sequence value:
		if ( $rewrite_autoincrement ) {
			$pdo = $GLOBALS['@pdo'];
			$stmt = $pdo->prepare("SELECT seq FROM sqlite_sequence WHERE name = :table_name");
			$table_name = ${js.table_name};
			$stmt->bindParam("table_name", $table_name);
			$stmt->execute();
			$row = $stmt->fetch();
			$original_sequence = $row['seq'];
		}

		// Replay INSERT
		$wpdb->query(${js.query});

		if ( $rewrite_autoincrement ) {
			// Immediately update the ID to the same one as the remote assigned
			$auto_increment_column = ${js.auto_increment_column};
			$stmt = $pdo->prepare("UPDATE $table_name SET $auto_increment_column = :last_insert_id WHERE $auto_increment_column = :original_sequence");
			$stmt->bindParam(':original_sequence', $original_sequence);
			$last_insert_id = ${js.last_insert_id};
			$stmt->bindParam(':last_insert_id', $last_insert_id);
			$stmt->execute();

			// Restore the original autoincrement sequence value
			$stmt = $pdo->prepare("UPDATE sqlite_sequence SET seq = :original_sequence WHERE name = :table_name");
			$stmt->bindParam("original_sequence", $original_sequence);
			$stmt->bindParam("table_name", $table_name);
			$stmt->execute();
		}
	`,
		})
		.then((r) => {
			console.log({
				text: r.text,
				errors: r.errors,
			});
		})
		.catch((e) => {
			console.error(e);
		});
});

let replayedFsOp = '';
playground.journalMemfs(async (op: FilesystemOperation) => {
	if (
		op.path.endsWith('/.ht.sqlite') ||
		op.path.endsWith('/.ht.sqlite-journal')
	) {
		return;
	}
	const opString = JSON.stringify(op.path);
	if (replayedFsOp === opString) {
		return;
	}
	if (op.operation === 'UPDATE_FILE') {
		op.data = await playground.readFileAsBuffer(op.path);
	}
	broadcastChange('fs', op);
});

const fsLock = new Semaphore({ concurrency: 1 });
onChangeReceived<FSChange>('fs', async (op) => {
	const release = await fsLock.acquire();
	try {
		console.log('[FS][Client 2]', op);
		const opString = JSON.stringify(op.path);
		replayedFsOp = opString;
		if (op.operation === 'CREATE') {
			if (op.nodeType === 'file') {
				await playground.writeFile(op.path, ' ');
			} else {
				await playground.mkdirTree(op.path);
			}
		} else if (op.operation === 'DELETE') {
			if (op.nodeType === 'file') {
				await playground.unlink(op.path);
			} else {
				await playground.rmdir(op.path, {
					recursive: true,
				});
			}
		} else if (op.operation === 'UPDATE_FILE') {
			await playground.writeFile(op.path, op.data);
		} else if (op.operation === 'RENAME') {
			await playground.mv(op.path, op.toPath);
		}
	} finally {
		release();
	}
});

// let refreshTimeout: any = null;
// if (refreshTimeout) {
//     clearTimeout(refreshTimeout);
// }
// refreshTimeout = setTimeout(() => {
//     client2.getCurrentURL().then((url) => {
//         client2.goTo(url);
//     });
// }, 150);
