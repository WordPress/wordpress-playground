import { splitShellCommand } from './split-shell-command';

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

class EventEmitter {
	listeners: Record<string, Listener[]> = {};
	emit(eventName: string, data: any) {
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
}

export class ProcessApi extends EventEmitter {
	private exited = false;
	private stdinData: Uint8Array[] | null = [];
	constructor(private childProcess: ChildProcess) {
		super();
		childProcess.on('stdin', (data: Uint8Array) => {
			if (this.stdinData) {
				// Need to clone the data buffer as it's reused by PHP
				// and the next data chunk will overwrite the previous one.
				this.stdinData.push(data.slice());
			} else {
				this.emit('stdin', data);
			}
		});
	}
	stdout(data: string | ArrayBuffer) {
		if (typeof data === 'string') {
			data = new TextEncoder().encode(data);
		}
		this.childProcess.stdout.emit('data', data);
	}
	stdoutEnd() {
		this.childProcess.stdout.emit('end', {});
	}
	stderr(data: string | ArrayBuffer) {
		if (typeof data === 'string') {
			data = new TextEncoder().encode(data);
		}
		this.childProcess.stderr.emit('data', data);
	}
	stderrEnd() {
		this.childProcess.stderr.emit('end', {});
	}
	exit(code: number) {
		if (!this.exited) {
			this.exited = true;
			this.childProcess.emit('exit', code);
		}
	}
	flushStdin() {
		if (this.stdinData) {
			for (let i = 0; i < this.stdinData.length; i++) {
				this.emit('stdin', this.stdinData[i]);
			}
		}
		this.stdinData = null;
	}
}

export type StdIn = {
	write: (data: string) => void;
};

let lastPid = 9743;
export class ChildProcess extends EventEmitter {
	stdout: EventEmitter = new EventEmitter();
	stderr: EventEmitter = new EventEmitter();
	stdin: StdIn;
	constructor(public pid = lastPid++) {
		super();
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		this.stdin = {
			write: (data: string) => {
				self.emit('stdin', data);
			},
		};
	}
}
