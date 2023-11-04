import { FilesystemOperation } from '@php-wasm/universal';
import { SQLQueryMetadata } from './sql';

export type TransportMessage =
	| { scope: 'fs'; details: FilesystemOperation }
	| { scope: 'sql'; details: SQLQueryMetadata };

export interface PlaygroundSyncTransport {
	sendChanges(data: TransportMessage[]): void;
	onChangesReceived(fn: (data: TransportMessage[]) => void): void;
}

export class ParentWindowTransport implements PlaygroundSyncTransport {
	sendChanges(message: TransportMessage[]) {
		window.top!.postMessage(
			{
				type: 'playground-change',
				message,
			},
			'*'
		);
	}

	onChangesReceived(fn: (details: TransportMessage[]) => void): void {
		window.addEventListener('message', (event) => {
			if (event.data.type !== 'playground-change') {
				return;
			}
			fn(event.data.message);
		});
	}
}
