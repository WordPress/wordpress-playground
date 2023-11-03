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

import { FilesystemOperation, IsomorphicLocalPHP } from '@php-wasm/universal';
import { Semaphore } from '@php-wasm/util';
import { PlaygroundClient } from '@wp-playground/client';

export async function recordFSOperations(
	playground: PlaygroundClient,
	onFlush: any
) {
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
		onFlush(op);
	});
}

const fsLock = new Semaphore({ concurrency: 1 });
export async function replayFSOperations(
	playground: PlaygroundClient,
	ops: FilesystemOperation[]
) {
	for (const op of ops) {
		const release = await fsLock.acquire();
		try {
			await replayFSOperation(playground, op);
		} finally {
			release();
		}
	}
}

async function replayFSOperation(
	playground: PlaygroundClient,
	op: FilesystemOperation
) {
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
}
