import type { Endpoint } from './comlink-sync';
import type { EventEmitter } from 'events';

// Handle the difference between EventEmitter (Node) and EventTarget (web).
const proxyByListener: WeakMap<
	EventListenerOrEventListenerObject,
	(...args: any[]) => void
> = new WeakMap();

type EventEmitterWithSend = Pick<
	EventEmitter,
	'addListener' | 'removeListener'
> & {
	send?: (...args: any[]) => unknown;
};

export interface NodeProcess {
	send: (...args: any[]) => unknown;
	addListener: (
		type: string,
		listener: EventListenerOrEventListenerObject
	) => void;
	removeListener: (
		type: string,
		listener: EventListenerOrEventListenerObject
	) => void;
}

export function nodeProcessEndpoint(worker?: NodeProcess): Endpoint {
	const emitter = (worker || process) as EventEmitter;
	if (typeof (emitter as EventEmitterWithSend).send !== 'function') {
		throw new Error(
			'IPC channel is not available. Did you forget to fork the process?'
		);
	}
	const emitterWithSend = emitter as EventEmitterWithSend;

	return {
		postMessage(message: unknown, _transferList?: Transferable[]) {
			if (_transferList && _transferList.length > 0) {
				throw new Error(
					'Transferable objects are not supported for nodeProcessEndpoint'
				);
			}
			emitterWithSend.send?.(message);
		},

		addEventListener(
			type: string,
			listener: EventListenerOrEventListenerObject
		) {
			const proxy =
				typeof listener === 'function'
					? (data: unknown) => listener({ data } as MessageEvent)
					: (data: unknown) =>
							listener.handleEvent({ data } as MessageEvent);
			proxyByListener.set(listener, proxy);
			emitterWithSend.addListener(type, proxy);
		},

		removeEventListener(
			type: string,
			listener: EventListenerOrEventListenerObject
		) {
			const proxy = proxyByListener.get(listener);
			if (!proxy) {
				return;
			}

			proxyByListener.delete(listener);
			emitterWithSend.removeListener(type, proxy);
		},

		start() {
			// EventEmitter-based endpoints do not need explicit start logic.
		},
	};
}
