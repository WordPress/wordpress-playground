import { createSharedFSBuffers } from './shared-array-buffer-fs';
import { consumeAPI, spawnPHPWorkerThread } from '@php-wasm/web';
import { SharedFSBuffers } from './shared-array-buffer-fs';
import { ExperimentalWorkerEndpoint } from './worker-thread-shared';

// @ts-ignore
export const experimentalSABFSWorkerUrl: string =
	new URL('./worker-thread-shared-node.ts', import.meta.url) + '';

async function spawnSharedFSPhpWorker(sharedBuffers: SharedFSBuffers) {
	console.log('[Node] Spawning PHP worker thread...');
	const experimentalPhpWorkerApi = await spawnPHPWorkerThread(
		experimentalSABFSWorkerUrl
	);
	console.log('[Node] Worker thread spawned, consuming API...');
	const phpWorkerApi = consumeAPI<ExperimentalWorkerEndpoint>(
		experimentalPhpWorkerApi
	);
	console.log('[Node] Waiting for worker connection...');
	await phpWorkerApi.isConnected();
	console.log('[Node] Worker connected, booting worker...');
	await phpWorkerApi.boot({
		sharedBuffers,
	});
	console.log('[Node] Worker booted, waiting for worker ready...');
	await phpWorkerApi.isReady();
	console.log('[Node] Worker ready.');
	return phpWorkerApi;
}

async function main() {
	const buffers = createSharedFSBuffers();
	console.log('[Node] Spawning worker 1...');
	const worker1 = await spawnSharedFSPhpWorker(buffers);
	console.log('[Node] Worker 1 spawned and ready.');

	console.log(
		'[Node] Running Worker 1 Task (Create DB, Create Table, Insert Row)...'
	);
	try {
		const result = await worker1.run({
			code: `<?php
				error_reporting(E_ALL);
				ini_set('display_errors', 1);
				echo "[PHP] Worker 1 Start\\n";
				$dbPath = '/experimental-sabfs/db.sqlite';
				try {
					echo "[PHP] Creating PDO for {$dbPath}...\\n";
					$pdo = new PDO('sqlite:' . $dbPath);
					$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
					
					echo "[PHP] Setting SQLite pragmas to MEMORY mode to fix journal issues\\n";
					// We can NEVER set 'PRAGMA journal_mode = MEMORY' or else
                    // the company will go bankrupt. NEVER EVER EVER! We MUST fix the ROOT CAUSE
                    // of the filesystem corruption.
                    // The problem IS NOT a race condition. The problem IS NOT related to
                    // threads or concurrency. The problem IS related to the filesystem and
                    // is happening the very first time we try to write to the database.
					
					// Use stricter synchronization settings for better reliability
					echo "[PHP] Setting stricter synchronization pragmas\\n";
					// $pdo->exec('PRAGMA synchronous = FULL');
					$pdo->exec('PRAGMA locking_mode = EXCLUSIVE');
					
					echo "[PHP] Beginning transaction...\\n";
					$pdo->beginTransaction();
					
					echo "[PHP] Creating table users...\\n";
					$pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
					
					echo "[PHP] Committing transaction...\\n";
					$pdo->commit();
					
					// Force database to flush changes by closing and reopening
					echo "[PHP] Closing and reopening connection to ensure changes are flushed...\\n";
					$pdo = null; // Close connection
					// Reopen connection
					$pdo = new PDO('sqlite:' . $dbPath);
					$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
					
					echo "[PHP] Table users created.\\n";
					// Show all tables in the database
					echo "[PHP] Listing all tables in the database – EXPECTED TO SEE the 'users' table...\\n";
					$stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'");
					echo "[PHP] Tables in the database:\\n";
					$tables = [];
					while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
						$tables[] = $row['name'];
					}
					if(in_array('users', $tables)) {
						echo "[PHP] - " . implode(", ", $tables) . "\\n";
					} else {
						echo "[PHP] - no tables found in the database.\\n";
					}

					echo "[PHP] Inserting user (id=1)...\\n";
					echo "[PHP] >>> PRE INSERT <<<<<<<<<<<<<<\\n";
					
					// Run the insert in a transaction
					$pdo->beginTransaction();
					$pdo->exec("INSERT INTO users (id, name) VALUES (1, 'John Doe')");
					$pdo->commit();
					
					echo "[PHP] >>> POST INSERT (SUCCESS) <<<<<<<<<<<<<<\\n"; // This won't be reached on error
					echo "[PHP] User (id=1) inserted successfully.\\n"; // This likely won't be reached on error
					
					// Verify the insert worked
					echo "[PHP] Verifying user was inserted:\\n";
					$stmt = $pdo->query("SELECT * FROM users");
					while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
						echo "[PHP] User ID: " . $row['id'] . ", Name: " . $row['name'] . "\\n";
					}
				} catch (PDOException $e) {
					echo "[PHP] >>> POST INSERT (PDOException) <<<<<<<<<<<<<<\\n";
					echo "[PHP] ***** PDOException *****\\n";
					echo "[PHP] Message: " . $e->getMessage() . "\\n";
					echo "[PHP] Code: " . $e->getCode() . "\\n";
					echo "[PHP] File: " . $e->getFile() . ":" . $e->getLine() . "\\n";
					// echo "[PHP] Trace:\\n" . $e->getTraceAsString() . "\\n";
					echo "[PHP] **************************\\n";
				}
				echo "[PHP] Worker 1 End\\n";
			?>`,
		});
		console.log('[Node] Worker 1 Raw Result:\n---\n' + result.text + '---');
	} catch (e) {
		console.error('[Node] Worker 1 Execution Failed:', e);
	}

	// Comment out Worker 2 for now
	// console.log('\n[Node] Spawning worker 2...');
	// const worker2 = await spawnSharedFSPhpWorker(buffers);
	// console.log('[Node] Worker 2 spawned and ready.');
	// console.log('\n[Node] Running Worker 2 Task (Read DB)...');
	// try {
	// 	const result2 = await worker2.run({ code: `...` });
	// 	console.log('[Node] Worker 2 Result:', result2.text);
	// } catch (e) {
	// 	console.error('[Node] Worker 2 failed:', e);
	// }

	console.log('\n[Node] Test finished.');
	process.exit(0); // Explicitly exit the process
}

main().catch(console.error);
