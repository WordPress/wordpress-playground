import { EventEmitterPolyfill } from './event-emitter-polyfill';
import { splitShellCommand } from './split-shell-command';
import { WritablePolyfill, WriteCallback } from './writable-polyfill';

type Listener = (...args: any[]) => any;

export interface ProcessOptions {
	cwd?: string;
	env?: Record<string, string>;
}

/**
 * Usage:
 * ```ts
 * php.setSpawnHandler(
 *   createSpawnHandler(function (command, processApi) {
 *     console.log(processApi.flushStdin());
 *     processApi.stdout('/\n/tmp\n/home');
 *	   processApi.exit(0);
 *   })
 * );
 * ```
 * @param program
 * @returns
 */
export function createSpawnHandler(
	program: (
		command: string[],
		processApi: ProcessApi,
		options: ProcessOptions
	) => void | Promise<void>
): any {
	return function (
		command: string | string[],
		argsArray: string[] = [],
		options: ProcessOptions = {}
	) {
		const childProcess = new ChildProcess();
		const processApi = new ProcessApi(childProcess);
		// Give PHP a chance to register listeners
		setTimeout(async () => {
			let commandArray = [];
			if (argsArray.length) {
				commandArray = [command as string, ...argsArray];
			} else if (typeof command === 'string') {
				commandArray = splitShellCommand(command);
			} else if (Array.isArray(command)) {
				commandArray = command;
			} else {
				throw new Error('Invalid command ', command);
			}
			try {
				await program(commandArray, processApi, options);
			} catch (e) {
				childProcess.emit('error', e);
				if (
					typeof e === 'object' &&
					e !== null &&
					'message' in e &&
					typeof e.message === 'string'
				) {
					processApi.stderr(e.message);
				}
				processApi.exit(1);
			}
			childProcess.emit('spawn', true);
		});
		return childProcess;
	};
}

export class ProcessApi extends EventEmitterPolyfill {
	private exited = false;
	private stdinData: Uint8Array[] | null = [];
	private childProcess: ChildProcess;
	constructor(childProcess: ChildProcess) {
		super();
		this.childProcess = childProcess;
		childProcess.on('stdin', (data: Uint8Array) => {
			this.pushStdinData(data);
		});
	}
	stdinEnd() {
		if (!this.childProcess.stdin.ended) {
			this.childProcess.stdin.end();
		}
	}
	stdout(data: string | ArrayBuffer) {
		this.childProcess.stdout.write(data);
	}
	stdoutEnd() {
		if (!this.childProcess.stdout.ended) {
			this.childProcess.stdout.end();
		}
	}
	stderr(data: string | ArrayBuffer) {
		this.childProcess.stderr.write(data);
	}
	stderrEnd() {
		if (!this.childProcess.stderr.ended) {
			this.childProcess.stderr.end();
		}
	}
	notifySpawn() {
		this.childProcess.emit('spawn', true);
	}
	exit(code: number) {
		if (!this.exited) {
			this.exited = true;
			this.stdinEnd();
			this.stdoutEnd();
			this.stderrEnd();
			this.childProcess.emit('exit', code);
		}
	}
	override on(eventName: string, listener: Listener) {
		console.trace('ProcessApi.on(stdin) called', eventName);
		super.on(eventName, listener);
		/**
		 * If it's the first stdin listener, flush all the data we've
		 * buffered so far.
		 */
		if (eventName === 'stdin' && this.stdinData) {
			console.trace('flushing buffered stdin data');
			for (let i = 0; i < this.stdinData.length; i++) {
				listener(this.stdinData[i]);
				// this.emit('stdin', this.stdinData[i]);
			}
			this.stdinData = null;
		}
	}
	/**
	 * Do not use outside of this class! This method moves the stdin
	 * data to the consumer.
	 *
	 * @param data
	 */
	private pushStdinData(data: Uint8Array) {
		console.log('pushStdinData called');
		console.log('childProcess.on(stdin) called');
		if (this.stdinData) {
			console.log('buffering stdin data');
			// Need to clone the data buffer as it's reused by PHP
			// and the next data chunk will overwrite the previous one.
			this.stdinData.push(data.slice());
		} else {
			console.log('emiting stdin data');
			this.emit('stdin', data);
		}
	}
}

let lastPid = 9743;
export class ChildProcess extends EventEmitterPolyfill {
	stdout: WritablePolyfill;
	stderr: WritablePolyfill;
	stdin: WritablePolyfill;
	pid: number;
	constructor(pid = lastPid++) {
		super();
		this.pid = pid;
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		this.stdout = new WritablePolyfill({
			write(data: any, encoding: BufferEncoding, cb: WriteCallback) {
				self.stdout.emit('data', data);
				cb();
			},
		});
		this.stderr = new WritablePolyfill({
			write: (data: any, encoding: BufferEncoding, cb: WriteCallback) => {
				self.stderr.emit('data', data);
				cb();
			},
		});
		this.stdin = new WritablePolyfill({
			write: (data: any, encoding: BufferEncoding, cb: WriteCallback) => {
				self.emit('stdin', data);
				cb();
			},
		});
	}
}
