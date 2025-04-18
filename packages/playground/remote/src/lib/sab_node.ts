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

const result = await worker1.run({
	code: `<?php
		$pdoSqlite = new PDO('sqlite:/experimental-sabfs/db.sqlite');
		$pdoSqlite->exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)');
		// $pdoSqlite->exec("INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')");
		// $pdoSqlite->exec("INSERT INTO users (name, email) VALUES ('Jane Doe', 'jane@example.com')");
	?>`,
});
console.log(result.text);

const result2 = await worker2.run({
	code: `<?php
		$pdoSqlite = new PDO('sqlite:/experimental-sabfs/db.sqlite');
		// $result = $pdoSqlite->query('SELECT * FROM users');
		// Echo a list of database tables
		$tables = $pdoSqlite->query("SELECT name FROM sqlite_master WHERE type='table'");
		echo "Database tables:\n";
		while ($table = $tables->fetch(PDO::FETCH_ASSOC)) {
			echo "- " . $table['name'] . "\n";
		}

	?>`,
});
console.log(result2.text);

// We can actually write and read files!
// await worker1.writeFile('/experimental-sabfs/test.txt', 'Hello, world!');
// console.log('reading file worker 1');
// console.log(await worker1.readFileAsText('/experimental-sabfs/test.txt'));
// // await worker1.logHeader('worker1');
// // await worker1.logDirState('worker1');
// // await worker1.dumpDir('worker1');
// // await worker2.logHeader('worker2');
// // await worker2.logDirState('worker2');
// // await worker2.dumpDir('worker2');

// console.log('reading file worker 2');
// console.log(await worker2.readFileAsText('/experimental-sabfs/test.txt'));

// console.log(await worker2.listFiles('/experimental-sabfs'));
// console.log("Finished");

// console.log('\n--- Directory and File Operations ---');

// // Create directories
// console.log('Creating directories...');
// await worker1.mkdir('/experimental-sabfs/dirA');
// await worker1.mkdir('/experimental-sabfs/dirB');
// await worker1.mkdir('/experimental-sabfs/dirA/subDir');

// // Write files
// console.log('Writing files...');
// await worker1.writeFile('/experimental-sabfs/dirA/fileA1.txt', 'Content for file A1');
// await worker1.writeFile('/experimental-sabfs/dirB/fileB1.txt', 'Content for file B1');
// await worker1.writeFile('/experimental-sabfs/dirA/subDir/nested.txt', 'Nested content');

// // List files after creation (using worker 2 to verify)
// console.log('Listing files after creation (worker 2):');
// console.log('/experimental-sabfs:', await worker2.listFiles('/experimental-sabfs'));
// console.log('/experimental-sabfs/dirA:', await worker2.listFiles('/experimental-sabfs/dirA'));
// console.log('/experimental-sabfs/dirA/subDir:', await worker2.listFiles('/experimental-sabfs/dirA/subDir'));
// console.log('/experimental-sabfs/dirB:', await worker2.listFiles('/experimental-sabfs/dirB'));

// // Remove a directory (dirB) - first remove its contents
// console.log('Removing file /experimental-sabfs/dirB/fileB1.txt...');
// await worker1.unlink('/experimental-sabfs/dirB/fileB1.txt');
// console.log('Removing directory /experimental-sabfs/dirB...');
// await worker1.rmdir('/experimental-sabfs/dirB');

// // List files after removal (using worker 1)
// console.log('Listing files after removal (worker 1):');
// console.log('/experimental-sabfs:', await worker1.listFiles('/experimental-sabfs'));

// // Verify removal with worker 2
// console.log('Verifying removal (worker 2):');
// try {
// 	console.log(await worker2.listFiles('/experimental-sabfs'));
// } catch (e) {
// 	console.log('Successfully confirmed /experimental-sabfs/dirB does not exist:', e.message);
// }

// console.log('\n--- Finished Directory and File Operations ---');
