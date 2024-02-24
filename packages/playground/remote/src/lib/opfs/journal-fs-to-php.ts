/**
 * Synchronize MEMFS changes from a PHP instance into another PHP instance.
 */

/* eslint-disable prefer-rest-params */
import type { WebPHP } from '@php-wasm/web';
import { FilesystemOperation, journalFSEvents } from '@php-wasm/fs-journal';
import { basename, normalizePath } from '@php-wasm/util';

export function journalFSEventsToPhp(
	sourcePhp: WebPHP,
	targetPhp: WebPHP,
	root: string
) {
	root = normalizePath(root);

	const journal: FilesystemOperation[] = [];
	const unbindJournal = journalFSEvents(sourcePhp, root, (entry) => {
		if (
			// entry.path.endsWith('/.ht.sqlite') ||
			entry.path.endsWith('/.ht.sqlite-journal')
		) {
			return;
		}
		journal.push(entry);
	});
	const rewriter = new MemfsRewriter(sourcePhp, targetPhp, root);

	async function flushJournal() {
		// @TODO This is way too slow in practice, we need to batch the
		// changes into groups of parallelizable operations.
		while (journal.length) {
			rewriter.processEntry(journal.shift()!);
		}
	}
	sourcePhp.addEventListener('request.end', flushJournal);
	return function () {
		unbindJournal();
		sourcePhp.removeEventListener('request.end', flushJournal);
	};
}

type JournalEntry = FilesystemOperation;

class MemfsRewriter {
	constructor(
		private sourcePhp: WebPHP,
		private targetPhp: WebPHP,
		private root: string
	) {}

	public processEntry(entry: JournalEntry) {
		if (!entry.path.startsWith(this.root) || entry.path === this.root) {
			return;
		}
		const name = basename(entry.path);
		if (!name) {
			return;
		}

		try {
			if (entry.operation === 'DELETE') {
				try {
					if (this.targetPhp.isDir(entry.path)) {
						this.targetPhp.rmdir(entry.path);
					} else {
						this.targetPhp.unlink(entry.path);
					}
				} catch (e) {
					// If the directory already doesn't exist, it's fine
				}
			} else if (entry.operation === 'CREATE') {
				if (entry.nodeType === 'directory') {
					this.targetPhp.mkdir(entry.path);
				} else {
					this.targetPhp.writeFile(entry.path, '');
				}
			} else if (entry.operation === 'WRITE') {
				this.targetPhp.writeFile(
					entry.path,
					this.sourcePhp.readFileAsBuffer(entry.path)
				);
			} else if (
				entry.operation === 'RENAME' &&
				entry.toPath.startsWith(this.root)
			) {
				this.targetPhp.mv(entry.path, entry.toPath);
			}
		} catch (e) {
			// Useful for debugging – the original error gets lost in the
			// Comlink proxy.
			console.log({ entry, name });
			console.error(e);
			throw e;
		}
	}
}
