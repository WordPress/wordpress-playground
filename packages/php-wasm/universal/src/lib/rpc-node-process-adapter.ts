/**
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/**
 * The subset of Node child-process IPC used by the Playground RPC transport.
 *
 * The process must be created with Node's `serialization: 'advanced'` option.
 * The default JSON serialization mode does not preserve Playground's
 * structured-value contract. Transfer lists remain unsupported by this
 * transport.
 *
 * Optional lifecycle fields keep the type compatible with lightweight mocks.
 */
export interface NodeProcess {
	send: (message: unknown, ...args: unknown[]) => unknown;
	addListener: (type: string, listener: (...args: any[]) => void) => unknown;
	removeListener: (
		type: string,
		listener: (...args: any[]) => void
	) => unknown;
	connected?: boolean;
}

export function isNodeProcess(value: unknown): value is NodeProcess {
	return (
		typeof value === 'object' &&
		value !== null &&
		'send' in value &&
		typeof value.send === 'function' &&
		'addListener' in value &&
		typeof value.addListener === 'function' &&
		'removeListener' in value &&
		typeof value.removeListener === 'function'
	);
}
