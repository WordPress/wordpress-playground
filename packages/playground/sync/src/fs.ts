import type { FilesystemOperation } from '@php-wasm/fs-journal';
import type { PlaygroundClient } from '@wp-playground/client';
import { basename, isParentOf, joinPaths } from '@php-wasm/util';

export async function journalFSOperations(
	playground: PlaygroundClient,
	onEntry: (op: FilesystemOperation) => void
) {
	const wpContentPath = joinPaths(
		await playground.documentRoot,
		'wp-content'
	);
	const databasePath = joinPaths(wpContentPath, 'database');
	await playground.journalFSEvents(
		wpContentPath,
		async (entry: FilesystemOperation) => {
			// SQL is synchronized separately. Storage paths and locks belong to each site.
			if (
				isDatabasePath(entry.path, databasePath) ||
				(entry.operation === 'RENAME' &&
					isDatabasePath(entry.toPath, databasePath))
			) {
				return;
			}
			onEntry(entry);
		}
	);
}

function isDatabasePath(path: string, databasePath: string): boolean {
	return (
		isParentOf(databasePath, path) ||
		basename(path) === '.ht.sqlite' ||
		basename(path) === '.ht.sqlite-journal' ||
		basename(path) === '.ht.sqlite-wal' ||
		basename(path) === '.ht.sqlite-shm'
	);
}
