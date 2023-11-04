import { FilesystemOperation, IsomorphicLocalPHP } from '@php-wasm/universal';
import { Semaphore } from '@php-wasm/util';
import { PlaygroundClient } from '@wp-playground/client';

export async function journalFSOperations(
	playground: PlaygroundClient,
	onEntry: (op: FilesystemOperation) => void
) {
	await playground.journalMemfs(
		'/wordpress/wp-content',
		async (entry: FilesystemOperation) => {
			if (
				entry.path.endsWith('/.ht.sqlite') ||
				entry.path.endsWith('/.ht.sqlite-journal')
			) {
				return;
			}
			if (entry.operation === 'UPDATE_FILE') {
				// @TODO: If the file was removed in the meantime, we won't
				// be able to read it. We can't easily provide the contents
				// with the operation because it would create a ton of partial
				// content copies on each write. It seems like the only way
				// to solve this is to have a function like "normalizeFilesystemOperations"
				// that would prune the list of operations and merge them together as needed.
				try {
					entry.data = await playground.readFileAsBuffer(entry.path);
				} catch (e) {
					// Log the error but don't throw.
					console.error(e);
				}
			}
			onEntry(entry);
		}
	);
}

const fsLock = new Semaphore({ concurrency: 1 });
export async function replayFSJournal(
	playground: PlaygroundClient,
	entries: FilesystemOperation[]
) {
	for (const entry of entries) {
		const release = await fsLock.acquire();
		try {
			await replayFSJournalEntry(playground, entry);
		} finally {
			release();
		}
	}
}

async function replayFSJournalEntry(
	playground: PlaygroundClient,
	entry: FilesystemOperation
) {
	await playground.atomic(
		function (php: IsomorphicLocalPHP, entry: FilesystemOperation) {
			php.__journalingDisabled = true;
			try {
				if (entry.operation === 'CREATE') {
					if (entry.nodeType === 'file') {
						php.writeFile(entry.path, ' ');
					} else {
						php.mkdir(entry.path);
					}
				} else if (entry.operation === 'DELETE') {
					if (entry.nodeType === 'file') {
						php.unlink(entry.path);
					} else {
						php.rmdir(entry.path, {
							recursive: true,
						});
					}
				} else if (entry.operation === 'UPDATE_FILE') {
					php.writeFile(entry.path, entry.data!);
				} else if (entry.operation === 'RENAME') {
					php.mv(entry.path, entry.toPath);
				}
			} finally {
				php.__journalingDisabled = false;
			}
		}.toString(),
		[entry]
	);
}
