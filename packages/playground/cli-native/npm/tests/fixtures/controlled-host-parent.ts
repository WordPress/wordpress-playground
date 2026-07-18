import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { registerControlledHost } from '../../src/controlled-host-lifecycle.js';

const scenario = process.argv[2] ?? 'normal';

// vite-node may install its own development-time signal handlers. This fixture
// models a plain Node consumer, so establish the same baseline before creating
// the controlled host.
process.removeAllListeners('SIGINT');
process.removeAllListeners('SIGTERM');

const baseline = listenerCounts();
let generation = 0;
let active:
	| {
			child: ChildProcess;
			release: () => void;
			pid: number;
			port: number;
	  }
	| undefined;

if (scenario === 'handled-exception') {
	process.on('uncaughtException', (error: Error) => {
		send({ event: 'handled-exception', message: error.message });
	});
}

if (scenario === 'handled-signal') {
	process.on('SIGTERM', () => {
		send({ event: 'handled-signal', signal: 'SIGTERM' });
	});
}

if (scenario === 'handled-once-signal') {
	process.once('SIGTERM', () => {
		send({ event: 'handled-signal', signal: 'SIGTERM' });
	});
}

await startHost();

const input = createInterface({ input: process.stdin });
let commands = Promise.resolve();
input.on('line', (line) => {
	commands = commands.then(() => handleCommand(line));
	commands.catch((error: unknown) => {
		setImmediate(() => {
			throw error;
		});
	});
});

async function handleCommand(command: string): Promise<void> {
	if (command === 'throw') {
		setImmediate(() => {
			throw new Error('controlled fixture failure');
		});
		return;
	}
	if (command === 'dispose') {
		await stopHost();
		send({ event: 'disposed', listenerCounts: listenerCounts() });
		return;
	}
	if (command === 'start') {
		if (active !== undefined) throw new Error('host is already active');
		await startHost();
		return;
	}
	if (command === 'quit') {
		await stopHost();
		process.exit(0);
	}
	throw new Error(`unknown fixture command: ${command}`);
}

async function startHost(): Promise<void> {
	const hostProgram = [
		"const net = require('node:net');",
		'const server = net.createServer((socket) => socket.end());',
		"server.listen(0, '127.0.0.1', () => {",
		'  const address = server.address();',
		"  process.stdout.write(JSON.stringify({ pid: process.pid, port: address.port }) + '\\n');",
		'});',
	].join('\n');
	const child = spawn(process.execPath, ['-e', hostProgram], {
		stdio: ['ignore', 'pipe', 'ignore'],
		windowsHide: true,
	});
	const release = registerControlledHost(child);
	try {
		if (!child.stdout)
			throw new Error('fixture host stdout is unavailable');
		const lines = createInterface({ input: child.stdout });
		const [line] = (await once(lines, 'line')) as [string];
		lines.close();
		const ready = JSON.parse(line) as { pid: number; port: number };
		if (ready.pid !== child.pid)
			throw new Error('fixture host reported an unexpected PID');
		generation++;
		active = { child, release, pid: ready.pid, port: ready.port };
		send({
			event: 'started',
			generation,
			pid: ready.pid,
			port: ready.port,
			baseline,
			listenerCounts: listenerCounts(),
		});
	} catch (error) {
		release();
		try {
			child.kill('SIGKILL');
		} catch {
			// It may already have exited.
		}
		throw error;
	}
}

async function stopHost(): Promise<void> {
	const host = active;
	if (host === undefined) return;
	active = undefined;
	if (host.child.exitCode === null && host.child.signalCode === null) {
		const closed = once(host.child, 'close');
		host.child.kill('SIGTERM');
		await closed;
	}
	host.release();
}

function listenerCounts(): Record<'exit' | 'SIGINT' | 'SIGTERM', number> {
	return {
		exit: process.listenerCount('exit'),
		SIGINT: process.listenerCount('SIGINT'),
		SIGTERM: process.listenerCount('SIGTERM'),
	};
}

function send(value: unknown): void {
	process.stdout.write(`${JSON.stringify(value)}\n`);
}
