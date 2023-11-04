import { FilesystemOperation } from '@php-wasm/universal';
import { SQLJournalEntry } from './sql';

export type TransportEnvelope =
	| { scope: 'fs'; contents: FilesystemOperation }
	| { scope: 'sql'; contents: SQLJournalEntry };

export type ChangesCallback = (changes: TransportEnvelope[]) => void;
export interface PlaygroundSyncTransport {
	sendChanges(data: TransportEnvelope[]): void;
	onChangesReceived(fn: ChangesCallback): void;
}

export class ParentWindowTransport implements PlaygroundSyncTransport {
	sendChanges(envelope: TransportEnvelope[]) {
		window.top!.postMessage(
			{
				type: 'playground-change',
				envelope,
			},
			'*'
		);
	}

	onChangesReceived(fn: (details: TransportEnvelope[]) => void): void {
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
	injectChanges(changes: TransportEnvelope[]) {}
}
