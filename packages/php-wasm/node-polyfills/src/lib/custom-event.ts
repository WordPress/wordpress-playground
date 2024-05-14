import { currentJsRuntime } from './current-js-runtime';

if (currentJsRuntime === 'NODE' && typeof CustomEvent === 'undefined') {
	class CustomEvent<T = any> extends Event {
		readonly detail: T;
		constructor(
			name: string,
			options: {
				detail?: T;
				bubbles?: boolean;
				cancellable?: boolean;
				composed?: boolean;
			} = {}
		) {
			super(name, options);
			/*
			 * The bang symbol (`!`) here is a lie to make TypeScript happy.
			 *
			 * Without the bang TS has the following complaint:
			 *
			 * > T | undefined is not assignable to type T
			 *
			 * In reality, it's absolutely fine for T (or `options.detail`)
			 * to be undefined. However, the CustomEvent interface shipped
			 * with TypeScript doesn't think so and marks `this.details` as
			 * a required property.
			 *
			 * This little and harmless trick silences that error.
			 */
			this.detail = options.detail!;
		}
		initCustomEvent(): void {}
	}
	globalThis.CustomEvent = CustomEvent;
}
