import { BasePHP } from '@php-wasm/universal';
import { FilesystemOperation } from '@php-wasm/fs-journal';
import { Semaphore } from '@php-wasm/util';
import { PlaygroundClient } from '@wp-playground/client';

export async function journalFSOperations(
	playground: PlaygroundClient,
	onEntry: (op: FilesystemOperation) => void
) {
	await playground.journalFSEvents(
		'/wordpress/wp-content',
		async (entry: FilesystemOperation) => {
			if (
				entry.path.endsWith('/.ht.sqlite') ||
				entry.path.endsWith('/.ht.sqlite-journal')
			) {
				return;
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
		function (php: BasePHP, entry: FilesystemOperation) {
			const wasAllowed = php.journalingAllowed;
			php.journalingAllowed = false;
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
				} else if (entry.operation === 'WRITE') {
					php.writeFile(entry.path, entry.data!);
				} else if (entry.operation === 'RENAME') {
					php.mv(entry.path, entry.toPath);
				}
			} finally {
				php.journalingAllowed = wasAllowed;
			}
		}.toString(),
		[entry]
	);
}
