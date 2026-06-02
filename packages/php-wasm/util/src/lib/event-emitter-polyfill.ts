/**
 * Polyfills Node.js EventEmitter API. The main goal is to enable
 * using a child_process.spawn()-like API in both Node.js and the browser.
 *
 * @see https://nodejs.org/api/events.html#events_class_eventemitter
 */
type Listener = (...args: any[]) => any;

export class EventEmitterPolyfill {
	listeners: Record<string, Listener[]> = {};
	emit(eventName: string, data?: any) {
		if (this.listeners[eventName]) {
			this.listeners[eventName].forEach(function (listener) {
				listener(data);
			});
		}
	}
	on(eventName: string, listener: Listener) {
		if (!this.listeners[eventName]) {
			this.listeners[eventName] = [];
		}
		this.listeners[eventName].push(listener);
	}
	once(eventName: string, listener: Listener) {
		const wrappedListener = (...args: any[]) => {
			this.off(eventName, wrappedListener);
			listener(...args);
		};
		this.on(eventName, wrappedListener);
	}
	off(eventName: string, listener: Listener) {
		if (this.listeners[eventName]) {
			this.listeners[eventName] = this.listeners[eventName].filter(
				(l) => l !== listener
			);
		}
	}
}
