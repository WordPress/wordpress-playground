/*
 * Node.js Polyfill for ErrorEvent.
 */

const kError = Symbol('error');
const kMessage = Symbol('message');

interface ErrorEventOptions {
	/* The error that generated this event */
	error?: Error;
	/* The error message */
	message?: string;
}
/**
 * Class representing an error event.
 *
 * @extends Event
 */
class ErrorEvent2 extends Event {
	[kError]: any;
	[kMessage]: any;
	/**
	 * Create a new `ErrorEvent`.
	 *
	 * @param type The name of the event
	 * @param options A dictionary object that allows for setting
	 *                  attributes via object members of the same name.
	 */
	constructor(type: 'error', options: ErrorEventOptions = {}) {
		super(type);

		this[kError] = options.error === undefined ? null : options.error;
		this[kMessage] = options.message === undefined ? '' : options.message;
	}

	get error() {
		return this[kError];
	}

	get message() {
		return this[kMessage];
	}
}
Object.defineProperty(ErrorEvent2.prototype, 'error', { enumerable: true });
Object.defineProperty(ErrorEvent2.prototype, 'message', { enumerable: true });

export const ErrorEvent =
	typeof globalThis.ErrorEvent === 'function'
		? globalThis.ErrorEvent
		: ErrorEvent2;
