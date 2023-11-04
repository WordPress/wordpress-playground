import { FilesystemOperation } from '@php-wasm/universal';
import { SQLQueryMetadata } from './sql';

export type TransportMessage =
	| { scope: 'fs'; details: FilesystemOperation[] }
	| { scope: 'sql'; details: SQLQueryMetadata[] };

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

export class MiddlewareTransport implements PlaygroundSyncTransport {
	constructor(
		private readonly transport: PlaygroundSyncTransport,
		private readonly sendChangesMiddleware: (
			message: TransportMessage[],
			next: (message: TransportMessage[]) => void
		) => void,
		private readonly receiveChangesMiddleware: (
			message: TransportMessage[],
			next: (message: TransportMessage[]) => void
		) => void
	) {}

	sendChanges(message: TransportMessage[]) {
		this.sendChangesMiddleware(message, (message) => {
			this.transport.sendChanges(message);
		});
	}

	onChangesReceived(fn: (details: TransportMessage[]) => void): void {
		this.transport.onChangesReceived((message) => {
			this.receiveChangesMiddleware(message, (message) => {
				fn(message);
			});
		});
	}
}

export function withMiddleware(
	transport: PlaygroundSyncTransport,
	middleware: Array<{
		sendChanges?: (
			message: TransportMessage[],
			next: (message: TransportMessage[]) => void
		) => void;
		receiveChanges?: (
			message: TransportMessage[],
			next: (message: TransportMessage[]) => void
		) => void;
	}>
): PlaygroundSyncTransport {
	return middleware.reduce(
		(transport, middleware) =>
			new MiddlewareTransport(
				transport,
				middleware.sendChanges ?? ((message, next) => next(message)),
				middleware.receiveChanges ?? ((message, next) => next(message))
			),
		transport
	);
}