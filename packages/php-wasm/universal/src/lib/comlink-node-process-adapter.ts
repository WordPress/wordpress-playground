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

// TODO: Is there a way to assert that all types passed to remote APIs are simple values or objects?
// TODO: Make this a function like the other adapters?
export class NodeProcessAdapter implements Endpoint {
	private readonly emitter: EventEmitterWithSend;

	constructor(worker?: NodeProcess) {
		const emitter = (worker || process) as EventEmitter;
		if (typeof (emitter as EventEmitterWithSend).send !== 'function') {
			throw new Error(
				'IPC channel is not available. Did you forget to fork the process?'
			);
		}
		this.emitter = emitter as EventEmitterWithSend;
	}

	postMessage(message: unknown, _transferList?: Transferable[]) {
		if (_transferList && _transferList.length > 0) {
			throw new Error(
				'Transferable objects are not supported for NodeProcessAdapter'
			);
		}
		this.emitter.send?.(message);
	}

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
		this.emitter.addListener(type, proxy);
	}

	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject
	) {
		const proxy = proxyByListener.get(listener);
		if (!proxy) {
			return;
		}

		proxyByListener.delete(listener);
		this.emitter.removeListener(type, proxy);
	}

	start() {
		// EventEmitter-based endpoints do not need explicit start logic.
	}
}
