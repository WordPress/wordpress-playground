import { FilesystemOperation } from '@php-wasm/fs-journal';
import { SQLJournalEntry } from './sql';

export type TransportEnvelope = {
	fs: FilesystemOperation[];
	sql: SQLJournalEntry[];
};

export type ChangesCallback = (changes: TransportEnvelope) => void;
export interface PlaygroundSyncTransport {
	sendChanges(data: TransportEnvelope): void;
	onChangesReceived(fn: ChangesCallback): void;
}

export class ParentWindowTransport implements PlaygroundSyncTransport {
	sendChanges(envelope: TransportEnvelope) {
		window.top!.postMessage(
			{
				type: 'playground-change',
				envelope,
			},
			'*'
		);
	}

	onChangesReceived(fn: ChangesCallback): void {
		window.addEventListener('message', (event) => {
			if (event.data.type !== 'playground-change') {
				return;
			}
			fn(event.data.envelope);
		});
	}
}

export class NoopTransport implements PlaygroundSyncTransport {
	sendChanges() {}
	onChangesReceived(callback: ChangesCallback) {
		this.injectChanges = callback;
	}
	injectChanges(changes: TransportEnvelope) {}
}
