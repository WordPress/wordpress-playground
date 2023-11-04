import { FilesystemOperation } from '@php-wasm/universal';
import { SQLJournalEntry } from './sql';

export type TransportEnvelope =
	| { scope: 'fs'; contents: FilesystemOperation }
	| { scope: 'sql'; contents: SQLJournalEntry };

export interface PlaygroundSyncTransport {
	sendChanges(data: TransportEnvelope[]): void;
	onChangesReceived(fn: (data: TransportEnvelope[]) => void): void;
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
