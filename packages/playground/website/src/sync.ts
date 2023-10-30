import { phpVars, startPlaygroundWeb } from '@wp-playground/client';
import { login } from '@wp-playground/blueprints';
import { FilesystemOperation } from '@php-wasm/universal';
/** @ts-ignore */
import bumpAutoIncrements from './bump-auto-increment.php?raw';
import patchedSqliteTranslator from './class-wp-sqlite-translator.php?raw';

const playground = await startPlaygroundWeb({
	iframe: document.getElementById('wp') as HTMLIFrameElement,
	remoteUrl: 'http://localhost:4400/remote.html',
});
await login(playground, { username: 'admin', password: 'password' });
await playground.goTo('/');

await playground.writeFile(
	'/wordpress/wp-content/plugins/sqlite-database-integration/wp-includes/sqlite/class-wp-sqlite-translator.php',
	patchedSqliteTranslator
);

await playground.run({
	code: bumpAutoIncrements,
});

class Counter extends Map<string, number> {
	increment(key: string) {
		this.set(key, (this.get(key) ?? 0) + 1);
	}
	get(key: string): number {
		return super.get(key) || 0;
	}
	decrement(key: string) {
		const newValue = (this.get(key) ?? 0) - 1;
		if (newValue > 0) {
			this.set(key, newValue);
		} else {
			this.delete(key);
		}
	}
}

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

function onChangeReceived(scope: string, fn: (details: any) => void) {
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

const replayedSqlQueries = new Counter();

playground.onMessage(async (messageString) => {
	const { type, ...data } = JSON.parse(messageString) as any;
	if (type !== 'sql') {
		return;
	}
	const firstKeyword = data.query.trim().split(/\s/)[0].toLowerCase();
	if (firstKeyword === 'select') {
		return;
	}
	if (replayedSqlQueries.get(data.query) > 0) {
		return;
	}
	broadcastChange('sql', data);
});

onChangeReceived('sql', async (data) => {
	console.log('[SQL]', data);

	replayedSqlQueries.increment(data.query);
	let promise;
	if (data.auto_increment_column && data.last_insert_id) {
		const js = phpVars(data);
		// @TODO: handle escaping, use $wpdb instead of PDO
		// @TODO: handle CREATE TABLE, ALTER TABLE, etc.
		promise = playground.run({
			code: `<?php
			require '/wordpress/wp-load.php';
            $wpdb->query(${js.query});

            $pdo = new PDO('sqlite://wordpress/wp-content/database/.ht.sqlite');
            $stmt = $pdo->query("SELECT MAX(${data.auto_increment_column}) as max_id FROM ${data.table_name}");
            $result = $stmt->fetch();

            $pdo->exec("UPDATE ${data.table_name} SET ${data.auto_increment_column} = ${data.last_insert_id} WHERE ${data.auto_increment_column} = " . $result['max_id']);
        `,
		});
	} else {
		promise = playground.runSqlQueries([data.query]);
	}

	promise.then(() => {
		replayedSqlQueries.decrement(data.query);
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
onChangeReceived('fs', async (op) => {
	console.log('[FS][Client 2]', op);
	const opString = JSON.stringify(op.path);
	replayedFsOp = opString;
	if (op.operation === 'CREATE_DIRECTORY') {
		await playground.mkdirTree(op.path);
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
