import { createSharedFSBuffers } from './shared-array-buffer-fs';
import { consumeAPI, spawnPHPWorkerThread } from '@php-wasm/web';
import { SharedFSBuffers } from './shared-array-buffer-fs';
import { ExperimentalWorkerEndpoint } from './worker-thread-shared';

// @ts-ignore
export const experimentalSABFSWorkerUrl: string =
	new URL('./worker-thread-shared-node.ts', import.meta.url) + '';

async function spawnSharedFSPhpWorker(sharedBuffers: SharedFSBuffers) {
	const experimentalPhpWorkerApi = await spawnPHPWorkerThread(
		experimentalSABFSWorkerUrl
	);
	const phpWorkerApi = consumeAPI<ExperimentalWorkerEndpoint>(
		experimentalPhpWorkerApi
	);
	await phpWorkerApi.isConnected();
	await phpWorkerApi.boot({
		sharedBuffers,
	});
	await phpWorkerApi.isReady();
	return phpWorkerApi;
}

const buffers = createSharedFSBuffers();
const worker1 = await spawnSharedFSPhpWorker(buffers);
const worker2 = await spawnSharedFSPhpWorker(buffers);

console.log('Worker 1: Creating and writing to SQLite DB');
try {
	const result = await worker1.run({
		code: `<?php
			echo "--- PHP Worker 1 ---\\n";
			$dbPath = '/experimental-sabfs/db.sqlite';
			echo "Creating PDO for {$dbPath}...\\n";
			$pdoSqlite = new PDO('sqlite:' . $dbPath);
			echo "Setting journal_mode to MEMORY...\n";
			$pdoSqlite->exec('PRAGMA journal_mode = MEMORY;');
			echo "PDO created. Setting attributes...\\n";
			$pdoSqlite->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
			echo "Attributes set. Creating table users...\\n";
			$pdoSqlite->exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)');
			echo "Table created. Inserting user John Doe...\\n";
			$pdoSqlite->exec("INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')");
			echo "User John Doe inserted.\\n";
			// $pdoSqlite->exec("INSERT INTO users (name, email) VALUES ('Jane Doe', 'jane@example.com')");
			// echo "User Jane Doe inserted.\\n";
			echo "--- PHP Worker 1 Finished ---\\n";
		?>`,
	});
	console.log('Worker 1 Result:', result.text);
} catch (e) {
	console.error('Worker 1 failed:', e);
}

console.log('\\nWorker 2: Reading from SQLite DB');
try {
	const result2 = await worker2.run({
		code: `<?php
			echo "--- PHP Worker 2 ---\\n";
			$dbPath = '/experimental-sabfs/db.sqlite';
			echo "Creating PDO for {$dbPath}...\\n";
			$pdoSqlite = new PDO('sqlite:' . $dbPath);
			echo "Setting journal_mode to MEMORY...\n";
			$pdoSqlite->exec('PRAGMA journal_mode = MEMORY;');
			echo "PDO created. Setting attributes...\\n";
			$pdoSqlite->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
			echo "Attributes set. Querying tables...\\n";
			$tables = $pdoSqlite->query("SELECT name FROM sqlite_master WHERE type='table'");
			echo "Tables queried. Fetching results...\\n";
			echo "Database tables:\\n";
			while ($table = $tables->fetch(PDO::FETCH_ASSOC)) {
				echo "- " . $table['name'] . "\\n";
			}
			echo "Finished fetching tables.\\n";
			echo "Querying users table...\\n";
			$users = $pdoSqlite->query('SELECT * FROM users');
			echo "Users queried. Fetching results...\\n";
			echo "Users:\\n";
			while ($user = $users->fetch(PDO::FETCH_ASSOC)) {
				echo "- ID: {$user['id']}, Name: {$user['name']}, Email: {$user['email']}\\n";
			}
			echo "Finished fetching users.\\n";
			echo "--- PHP Worker 2 Finished ---\\n";
		?>`,
	});
	console.log('Worker 2 Result:', result2.text);
} catch (e) {
	console.error('Worker 2 failed:', e);
}

console.log('\nTest finished.');
process.exit(0);
