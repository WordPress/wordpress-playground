type Listener = (...args: any[]) => any;

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
		command: string,
		processApi: ProcessApi,
		childProcess: ChildProcess
	) => void
): any {
	return function (command: string) {
		console.log('Inner fn');
		try {
			console.log('before cp');
			const childProcess = new ChildProcess();
			console.log('before pa');
			const processApi = new ProcessApi(childProcess);
			console.log('before st');
			// Give PHP a chance to register listeners
			// setTimeout(() => {
			console.log('calling!');
			program(command, processApi, childProcess);
			// });
			console.log('before return');
			return childProcess;
		} catch (e) {
			console.error(e);
			throw e;
		}
	};
}

export class ProcessApi {
	private exited = false;
	private stdinData: string[] = [];
	constructor(private childProcess: ChildProcess) {
		childProcess.on('stdin', (data: string) => {
			this.stdinData.push(data);
		});
	}
	stdout(data: string | ArrayBuffer) {
		if (typeof data === 'string') {
			data = new TextEncoder().encode(data);
		}
		this.childProcess.stdout.emit('data', data);
	}
	stderr(data: string | ArrayBuffer) {
		if (typeof data === 'string') {
			data = new TextEncoder().encode(data);
		}
		this.childProcess.stderr.emit('data', data);
	}
	exit(code: number) {
		if (!this.exited) {
			this.exited = true;
			this.childProcess.emit('exit', code);
		}
	}
	flushStdin() {
		const data = this.stdinData.join('');
		this.stdinData = [];
		return data;
	}
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

export type StdIn = {
	write: (data: string) => void;
};

export class ChildProcess extends EventEmitter {
	stdout: EventEmitter = new EventEmitter();
	stderr: EventEmitter = new EventEmitter();
	stdin: StdIn;
	constructor() {
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
