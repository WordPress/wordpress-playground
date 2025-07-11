import { EventEmitterPolyfill } from './event-emitter-polyfill';
import { splitShellCommand } from './split-shell-command';
import { WritablePolyfill, type WriteCallback } from './writable-polyfill';

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
				const promise = program(commandArray, processApi, options);
				if (
					typeof promise !== 'object' ||
					promise === null ||
					!('then' in promise)
				) {
					throw new Error(
						`The program callback passed to createSpawnHandler() did not return a promise. It indicates there's a bug in your code. ` +
							`The callback must return a promise. PHP cannot interact with program that synchronously exists at the end of the proc_open() ` +
							`call. All the streams would be closed already. Make sure to put an "await new Promise(resolve => setTimeout(resolve, 1))` +
							`before calling processApi.exit(0) in your callback to let PHP catch up with the stdout data.`
					);
				} else if (processApi.exited) {
					throw new Error(
						`The program callback passed to createSpawnHandler() exited synchronously. It indicates there's a bug in your code. ` +
							`The callback must return a promise. PHP cannot interact with program that synchronously exists at the end of the proc_open() ` +
							`call. All the streams would be closed already. Make sure to put an "await new Promise(resolve => setTimeout(resolve, 1))` +
							`before calling processApi.exit(0) in your callback to let PHP catch up with the stdout data.`
					);
				}
				childProcess.emit('spawn', true);
				await promise;
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
		});
		return childProcess;
	};
}

export class ProcessApi extends EventEmitterPolyfill {
	public exited = false;
	/**
	 * Keeps track of the data that was written to stdin before the
	 * first listener was registered.
	 */
	private stdinBuffer: Uint8Array[] | null = [];
	private childProcess: ChildProcess;
	constructor(childProcess: ChildProcess) {
		super();
		this.childProcess = childProcess;
		childProcess.on('stdin', (data: Uint8Array) => {
			if (this.stdinBuffer) {
				// Need to clone the data buffer as it's reused by PHP
				// and the next data chunk will overwrite the previous one.
				this.stdinBuffer.push(data.slice());
			} else {
				this.emit('stdin', data);
			}
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
		super.on(eventName, listener);
		/**
		 * If it's the first stdin listener, flush all the data we've
		 * buffered so far.
		 */
		if (eventName === 'stdin' && this.stdinBuffer) {
			for (let i = 0; i < this.stdinBuffer.length; i++) {
				this.emit('stdin', this.stdinBuffer[i]);
			}
			this.stdinBuffer = null;
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
