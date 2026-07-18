import type { ChildProcess } from 'node:child_process';

type ControlledHost = {
	references: number;
	terminationRequested: boolean;
	onExit: () => void;
};

type LifecycleState = {
	controlledHosts: Map<ChildProcess, ControlledHost>;
	processHooksInstalled: boolean;
	onProcessExit: () => void;
	onSigint: () => void;
	onSigterm: () => void;
};

const lifecycleStateSymbol = Symbol.for(
	'@wp-playground/cli-native/controlled-host-lifecycle'
);
const lifecycle = processLifecycleState();

/**
 * Keep a controlled native host tied to this Node process even when normal
 * asynchronous disposal cannot run (for example, after a fatal uncaught
 * exception). The returned release function is idempotent.
 *
 * This is intentionally internal to the npm adapter. It does not make the
 * child process a global singleton or change ownership of its async cleanup.
 */
export function registerControlledHost(child: ChildProcess): () => void {
	if (child.pid === undefined) return () => {};

	let host = lifecycle.controlledHosts.get(child);
	if (host === undefined) {
		host = {
			references: 0,
			terminationRequested: false,
			onExit: () => removeControlledHost(lifecycle, child),
		};
		lifecycle.controlledHosts.set(child, host);
		child.once('exit', host.onExit);
		installProcessHooks(lifecycle);
	}
	host.references++;

	let released = false;
	return () => {
		if (released) return;
		released = true;
		const current = lifecycle.controlledHosts.get(child);
		if (current === undefined) return;
		current.references--;
		if (current.references === 0) removeControlledHost(lifecycle, child);
	};
}

function processLifecycleState(): LifecycleState {
	const carrier = process as NodeJS.Process & { [key: symbol]: unknown };
	const existing = carrier[lifecycleStateSymbol];
	if (existing !== undefined) return existing as LifecycleState;

	const created = {} as LifecycleState;
	created.controlledHosts = new Map();
	created.processHooksInstalled = false;
	created.onProcessExit = () => terminateControlledHosts(created);
	created.onSigint = () => handleTerminationSignal(created, 'SIGINT');
	created.onSigterm = () => handleTerminationSignal(created, 'SIGTERM');
	Object.defineProperty(carrier, lifecycleStateSymbol, {
		value: created,
		configurable: false,
		enumerable: false,
		writable: false,
	});
	return created;
}

function removeControlledHost(
	state: LifecycleState,
	child: ChildProcess
): void {
	const host = state.controlledHosts.get(child);
	if (host === undefined) return;
	state.controlledHosts.delete(child);
	child.off('exit', host.onExit);
	if (state.controlledHosts.size === 0) removeProcessHooks(state);
}

function installProcessHooks(state: LifecycleState): void {
	if (state.processHooksInstalled) return;
	state.processHooksInstalled = true;
	process.on('exit', state.onProcessExit);
	// Run before pre-existing one-shot listeners. EventEmitter removes a
	// `once()` listener immediately before invoking it; if the registry ran
	// afterwards it could otherwise mistake itself for the sole listener and
	// restore Node's default signal termination despite the consumer handling
	// the signal.
	process.prependListener('SIGINT', state.onSigint);
	process.prependListener('SIGTERM', state.onSigterm);
}

function removeProcessHooks(state: LifecycleState): void {
	if (!state.processHooksInstalled) return;
	state.processHooksInstalled = false;
	process.off('exit', state.onProcessExit);
	process.off('SIGINT', state.onSigint);
	process.off('SIGTERM', state.onSigterm);
}

function terminateControlledHosts(state: LifecycleState): void {
	for (const [child, host] of state.controlledHosts) {
		if (
			host.terminationRequested ||
			child.pid === undefined ||
			child.exitCode !== null ||
			child.signalCode !== null
		)
			continue;
		try {
			host.terminationRequested = child.kill('SIGTERM');
		} catch {
			// The child may have exited between the state check and kill().
		}
	}
}

function handleTerminationSignal(
	state: LifecycleState,
	signal: 'SIGINT' | 'SIGTERM'
): void {
	// Installing a signal listener removes Node's default handler. If the host
	// application also handles this signal, it owns the decision to continue or
	// exit; killing its active Playground here would violate that contract. An
	// eventual process.exit() still reaches onProcessExit above.
	const listener = signal === 'SIGINT' ? state.onSigint : state.onSigterm;
	if (process.listeners(signal).some((candidate) => candidate !== listener))
		return;

	terminateControlledHosts(state);
	process.off(signal, listener);
	try {
		// Restore the observable default: the parent terminates because of the
		// same signal instead of converting it to a successful numeric exit.
		process.kill(process.pid, signal);
	} catch {
		process.exit(signal === 'SIGINT' ? 130 : 143);
	}
}
