var __create = Object.create;
var __defProp = Object.defineProperty;
var __getProtoOf = Object.getPrototypeOf;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
	target = mod != null ? __create(__getProtoOf(mod)) : {};
	const to =
		isNodeMode || !mod || !mod.__esModule
			? __defProp(target, 'default', { value: mod, enumerable: true })
			: target;
	for (let key of __getOwnPropNames(mod))
		if (!__hasOwnProp.call(to, key))
			__defProp(to, key, {
				get: () => mod[key],
				enumerable: true,
			});
	return to;
};
var __commonJS = (cb, mod) => () => (
	mod || cb((mod = { exports: {} }).exports, mod), mod.exports
);
var __legacyDecorateClassTS = function (decorators, target, key, desc) {
	var c = arguments.length,
		r =
			c < 3
				? target
				: desc === null
				? (desc = Object.getOwnPropertyDescriptor(target, key))
				: desc,
		d;
	if (typeof Reflect === 'object' && typeof Reflect.decorate === 'function')
		r = Reflect.decorate(decorators, target, key, desc);
	else
		for (var i = decorators.length - 1; i >= 0; i--)
			if ((d = decorators[i]))
				r =
					(c < 3
						? d(r)
						: c > 3
						? d(target, key, r)
						: d(target, key)) || r;
	return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __legacyMetadataTS = (k, v) => {
	if (typeof Reflect === 'object' && typeof Reflect.metadata === 'function')
		return Reflect.metadata(k, v);
};
var __require = ((x) =>
	typeof require !== 'undefined'
		? require
		: typeof Proxy !== 'undefined'
		? new Proxy(x, {
				get: (a, b) =>
					(typeof require !== 'undefined' ? require : a)[b],
		  })
		: x)(function (x) {
	if (typeof require !== 'undefined') return require.apply(this, arguments);
	throw Error('Dynamic require of "' + x + '" is not supported');
});

// ../../../node_modules/ini/lib/ini.js
var require_ini = __commonJS((exports, module) => {
	var splitSections = function (str, separator) {
		var lastMatchIndex = 0;
		var lastSeparatorIndex = 0;
		var nextIndex = 0;
		var sections = [];
		do {
			nextIndex = str.indexOf(separator, lastMatchIndex);
			if (nextIndex !== -1) {
				lastMatchIndex = nextIndex + separator.length;
				if (nextIndex > 0 && str[nextIndex - 1] === '\\') {
					continue;
				}
				sections.push(str.slice(lastSeparatorIndex, nextIndex));
				lastSeparatorIndex = nextIndex + separator.length;
			}
		} while (nextIndex !== -1);
		sections.push(str.slice(lastSeparatorIndex));
		return sections;
	};
	var { hasOwnProperty } = Object.prototype;
	var encode = (obj, opt = {}) => {
		if (typeof opt === 'string') {
			opt = { section: opt };
		}
		opt.align = opt.align === true;
		opt.newline = opt.newline === true;
		opt.sort = opt.sort === true;
		opt.whitespace = opt.whitespace === true || opt.align === true;
		opt.platform =
			opt.platform ||
			(typeof process !== 'undefined' && process.platform);
		opt.bracketedArray = opt.bracketedArray !== false;
		const eol2 = opt.platform === 'win32' ? '\r\n' : '\n';
		const separator = opt.whitespace ? ' = ' : '=';
		const children = [];
		const keys = opt.sort ? Object.keys(obj).sort() : Object.keys(obj);
		let padToChars = 0;
		if (opt.align) {
			padToChars = safe(
				keys
					.filter(
						(k) =>
							obj[k] === null ||
							Array.isArray(obj[k]) ||
							typeof obj[k] !== 'object'
					)
					.map((k) => (Array.isArray(obj[k]) ? `${k}[]` : k))
					.concat([''])
					.reduce((a, b) =>
						safe(a).length >= safe(b).length ? a : b
					)
			).length;
		}
		let out = '';
		const arraySuffix = opt.bracketedArray ? '[]' : '';
		for (const k of keys) {
			const val = obj[k];
			if (val && Array.isArray(val)) {
				for (const item of val) {
					out +=
						safe(`${k}${arraySuffix}`).padEnd(padToChars, ' ') +
						separator +
						safe(item) +
						eol2;
				}
			} else if (val && typeof val === 'object') {
				children.push(k);
			} else {
				out +=
					safe(k).padEnd(padToChars, ' ') +
					separator +
					safe(val) +
					eol2;
			}
		}
		if (opt.section && out.length) {
			out =
				'[' +
				safe(opt.section) +
				']' +
				(opt.newline ? eol2 + eol2 : eol2) +
				out;
		}
		for (const k of children) {
			const nk = splitSections(k, '.').join('\\.');
			const section = (opt.section ? opt.section + '.' : '') + nk;
			const child = encode(obj[k], {
				...opt,
				section,
			});
			if (out.length && child.length) {
				out += eol2;
			}
			out += child;
		}
		return out;
	};
	var decode = (str, opt = {}) => {
		opt.bracketedArray = opt.bracketedArray !== false;
		const out = Object.create(null);
		let p = out;
		let section = null;
		const re = /^\[([^\]]*)\]\s*$|^([^=]+)(=(.*))?$/i;
		const lines = str.split(/[\r\n]+/g);
		const duplicates = {};
		for (const line of lines) {
			if (!line || line.match(/^\s*[;#]/) || line.match(/^\s*$/)) {
				continue;
			}
			const match = line.match(re);
			if (!match) {
				continue;
			}
			if (match[1] !== undefined) {
				section = unsafe(match[1]);
				if (section === '__proto__') {
					p = Object.create(null);
					continue;
				}
				p = out[section] = out[section] || Object.create(null);
				continue;
			}
			const keyRaw = unsafe(match[2]);
			let isArray;
			if (opt.bracketedArray) {
				isArray = keyRaw.length > 2 && keyRaw.slice(-2) === '[]';
			} else {
				duplicates[keyRaw] = (duplicates?.[keyRaw] || 0) + 1;
				isArray = duplicates[keyRaw] > 1;
			}
			const key = isArray ? keyRaw.slice(0, -2) : keyRaw;
			if (key === '__proto__') {
				continue;
			}
			const valueRaw = match[3] ? unsafe(match[4]) : true;
			const value =
				valueRaw === 'true' ||
				valueRaw === 'false' ||
				valueRaw === 'null'
					? JSON.parse(valueRaw)
					: valueRaw;
			if (isArray) {
				if (!hasOwnProperty.call(p, key)) {
					p[key] = [];
				} else if (!Array.isArray(p[key])) {
					p[key] = [p[key]];
				}
			}
			if (Array.isArray(p[key])) {
				p[key].push(value);
			} else {
				p[key] = value;
			}
		}
		const remove = [];
		for (const k of Object.keys(out)) {
			if (
				!hasOwnProperty.call(out, k) ||
				typeof out[k] !== 'object' ||
				Array.isArray(out[k])
			) {
				continue;
			}
			const parts = splitSections(k, '.');
			p = out;
			const l = parts.pop();
			const nl = l.replace(/\\\./g, '.');
			for (const part of parts) {
				if (part === '__proto__') {
					continue;
				}
				if (
					!hasOwnProperty.call(p, part) ||
					typeof p[part] !== 'object'
				) {
					p[part] = Object.create(null);
				}
				p = p[part];
			}
			if (p === out && nl === l) {
				continue;
			}
			p[nl] = out[k];
			remove.push(k);
		}
		for (const del of remove) {
			delete out[del];
		}
		return out;
	};
	var isQuoted = (val) => {
		return (
			(val.startsWith('"') && val.endsWith('"')) ||
			(val.startsWith("'") && val.endsWith("'"))
		);
	};
	var safe = (val) => {
		if (
			typeof val !== 'string' ||
			val.match(/[=\r\n]/) ||
			val.match(/^\[/) ||
			(val.length > 1 && isQuoted(val)) ||
			val !== val.trim()
		) {
			return JSON.stringify(val);
		}
		return val.split(';').join('\\;').split('#').join('\\#');
	};
	var unsafe = (val) => {
		val = (val || '').trim();
		if (isQuoted(val)) {
			if (val.charAt(0) === "'") {
				val = val.slice(1, -1);
			}
			try {
				val = JSON.parse(val);
			} catch {}
		} else {
			let esc = false;
			let unesc = '';
			for (let i = 0, l = val.length; i < l; i++) {
				const c = val.charAt(i);
				if (esc) {
					if ('\\;#'.indexOf(c) !== -1) {
						unesc += c;
					} else {
						unesc += '\\' + c;
					}
					esc = false;
				} else if (';#'.indexOf(c) !== -1) {
					break;
				} else if (c === '\\') {
					esc = true;
				} else {
					unesc += c;
				}
			}
			if (esc) {
				unesc += '\\';
			}
			return unesc.trim();
		}
		return val;
	};
	module.exports = {
		parse: decode,
		decode,
		stringify: encode,
		encode,
		safe,
		unsafe,
	};
});

// ../../php-wasm/util/src/lib/sleep.ts
function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(() => resolve(SleepFinished), ms);
	});
}
var SleepFinished = Symbol('SleepFinished');

// ../../php-wasm/util/src/lib/semaphore.ts
class AcquireTimeoutError extends Error {
	constructor() {
		super('Acquiring lock timed out');
	}
}

class Semaphore {
	_running = 0;
	concurrency;
	timeout;
	queue;
	constructor({ concurrency, timeout }) {
		this.concurrency = concurrency;
		this.timeout = timeout;
		this.queue = [];
	}
	get remaining() {
		return this.concurrency - this.running;
	}
	get running() {
		return this._running;
	}
	async acquire() {
		while (true) {
			if (this._running >= this.concurrency) {
				const acquired = new Promise((resolve) => {
					this.queue.push(resolve);
				});
				if (this.timeout !== undefined) {
					await Promise.race([acquired, sleep(this.timeout)]).then(
						(value) => {
							if (value === SleepFinished) {
								throw new AcquireTimeoutError();
							}
						}
					);
				} else {
					await acquired;
				}
			} else {
				this._running++;
				let released = false;
				return () => {
					if (released) {
						return;
					}
					released = true;
					this._running--;
					if (this.queue.length > 0) {
						this.queue.shift()();
					}
				};
			}
		}
	}
	async run(fn) {
		const release = await this.acquire();
		try {
			return await fn();
		} finally {
			release();
		}
	}
}
// ../../php-wasm/util/src/lib/paths.ts
function joinPaths(...paths) {
	let path = paths.join('/');
	const isAbsolute = path[0] === '/';
	const trailingSlash = path.substring(path.length - 1) === '/';
	path = normalizePath(path);
	if (!path && !isAbsolute) {
		path = '.';
	}
	if (path && trailingSlash) {
		path += '/';
	}
	return path;
}
function dirname(path) {
	if (path === '/') {
		return '/';
	}
	path = normalizePath(path);
	const lastSlash = path.lastIndexOf('/');
	if (lastSlash === -1) {
		return '';
	} else if (lastSlash === 0) {
		return '/';
	}
	return path.substr(0, lastSlash);
}
function normalizePath(path) {
	const isAbsolute = path[0] === '/';
	path = normalizePathsArray(
		path.split('/').filter((p) => !!p),
		!isAbsolute
	).join('/');
	return (isAbsolute ? '/' : '') + path.replace(/\/$/, '');
}
function normalizePathsArray(parts, allowAboveRoot) {
	let up = 0;
	for (let i = parts.length - 1; i >= 0; i--) {
		const last = parts[i];
		if (last === '.') {
			parts.splice(i, 1);
		} else if (last === '..') {
			parts.splice(i, 1);
			up++;
		} else if (up) {
			parts.splice(i, 1);
			up--;
		}
	}
	if (allowAboveRoot) {
		for (; up; up--) {
			parts.unshift('..');
		}
	}
	return parts;
}
// ../../php-wasm/util/src/lib/split-shell-command.ts
function splitShellCommand(command) {
	const MODE_UNQUOTED = 0;
	const MODE_IN_QUOTE = 1;
	let mode = MODE_UNQUOTED;
	let quote = '';
	const parts = [];
	let currentPart = '';
	for (let i = 0; i < command.length; i++) {
		const char = command[i];
		if (char === '\\') {
			if (command[i + 1] === '"' || command[i + 1] === "'") {
				i++;
			}
			currentPart += command[i];
		} else if (mode === MODE_UNQUOTED) {
			if (char === '"' || char === "'") {
				mode = MODE_IN_QUOTE;
				quote = char;
			} else if (char.match(/\s/)) {
				if (currentPart.trim().length) {
					parts.push(currentPart.trim());
				}
				currentPart = char;
			} else if (parts.length && !currentPart) {
				currentPart = parts.pop() + char;
			} else {
				currentPart += char;
			}
		} else if (mode === MODE_IN_QUOTE) {
			if (char === quote) {
				mode = MODE_UNQUOTED;
				quote = '';
			} else {
				currentPart += char;
			}
		}
	}
	if (currentPart) {
		parts.push(currentPart.trim());
	}
	return parts;
}

// ../../php-wasm/util/src/lib/create-spawn-handler.ts
function createSpawnHandler(program) {
	return function (command, argsArray = [], options = {}) {
		const childProcess = new ChildProcess();
		const processApi = new ProcessApi(childProcess);
		setTimeout(async () => {
			let commandArray = [];
			if (argsArray.length) {
				commandArray = [command, ...argsArray];
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
	listeners = {};
	emit(eventName, data) {
		if (this.listeners[eventName]) {
			this.listeners[eventName].forEach(function (listener) {
				listener(data);
			});
		}
	}
	on(eventName, listener) {
		if (!this.listeners[eventName]) {
			this.listeners[eventName] = [];
		}
		this.listeners[eventName].push(listener);
	}
}

class ProcessApi extends EventEmitter {
	childProcess;
	exited = false;
	stdinData = [];
	constructor(childProcess) {
		super();
		this.childProcess = childProcess;
		childProcess.on('stdin', (data) => {
			if (this.stdinData) {
				this.stdinData.push(data.slice());
			} else {
				this.emit('stdin', data);
			}
		});
	}
	stdout(data) {
		if (typeof data === 'string') {
			data = new TextEncoder().encode(data);
		}
		this.childProcess.stdout.emit('data', data);
	}
	stdoutEnd() {
		this.childProcess.stdout.emit('end', {});
	}
	stderr(data) {
		if (typeof data === 'string') {
			data = new TextEncoder().encode(data);
		}
		this.childProcess.stderr.emit('data', data);
	}
	stderrEnd() {
		this.childProcess.stderr.emit('end', {});
	}
	exit(code) {
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
var lastPid = 9743;

class ChildProcess extends EventEmitter {
	pid;
	stdout = new EventEmitter();
	stderr = new EventEmitter();
	stdin;
	constructor(pid = lastPid++) {
		super();
		this.pid = pid;
		const self2 = this;
		this.stdin = {
			write: (data) => {
				self2.emit('stdin', data);
			},
		};
	}
}
// ../../php-wasm/util/src/lib/php-vars.ts
function phpVar(value) {
	return `json_decode(base64_decode('${stringToBase64(
		JSON.stringify(value)
	)}'), true)`;
}
function phpVars(vars) {
	const result = {};
	for (const key in vars) {
		result[key] = phpVar(vars[key]);
	}
	return result;
}
var stringToBase64 = function (str) {
	return bytesToBase64(new TextEncoder().encode(str));
};
var bytesToBase64 = function (bytes) {
	const binString = String.fromCodePoint(...bytes);
	return btoa(binString);
};
// ../common/src/index.ts
var tmpPath = '/tmp/file.zip';
var unzipFile = async (php, zipPath, extractToPath) => {
	if (zipPath instanceof File) {
		const zipFile = zipPath;
		zipPath = tmpPath;
		await php.writeFile(
			zipPath,
			new Uint8Array(await zipFile.arrayBuffer())
		);
	}
	const js = phpVars({
		zipPath,
		extractToPath,
	});
	await php.run({
		code: `<?php
        function unzip(\$zipPath, \$extractTo, \$overwrite = true)
        {
            if (!is_dir(\$extractTo)) {
                mkdir(\$extractTo, 0777, true);
            }
            \$zip = new ZipArchive;
            \$res = \$zip->open(\$zipPath);
            if (\$res === TRUE) {
                \$zip->extractTo(\$extractTo);
                \$zip->close();
                chmod(\$extractTo, 0777);
            } else {
                throw new Exception("Could not unzip file");
            }
        }
        unzip(${js.zipPath}, ${js.extractToPath});
        `,
	});
	if (await php.fileExists(tmpPath)) {
		await php.unlink(tmpPath);
	}
};

// ../../php-wasm/node-polyfills/src/lib/current-js-runtime.ts
var currentJsRuntime = (function () {
	if (typeof process !== 'undefined' && process.release?.name === 'node') {
		return 'NODE';
	} else if (typeof window !== 'undefined') {
		return 'WEB';
	} else if (
		typeof WorkerGlobalScope !== 'undefined' &&
		self instanceof WorkerGlobalScope
	) {
		return 'WORKER';
	} else {
		return 'NODE';
	}
})();

// ../../php-wasm/node-polyfills/src/lib/blob.ts
if (currentJsRuntime === 'NODE') {
	let asPromise = function (obj) {
			return new Promise(function (resolve, reject) {
				obj.onload = obj.onerror = function (event) {
					obj.onload = obj.onerror = null;
					if (event.type === 'load') {
						resolve(obj.result);
					} else {
						reject(new Error('Failed to read the blob/file'));
					}
				};
			});
		},
		isByobSupported = function () {
			const inputBytes = new Uint8Array([1, 2, 3, 4]);
			const file = new File([inputBytes], 'test');
			const stream = file.stream();
			try {
				stream.getReader({ mode: 'byob' });
				return true;
			} catch (e) {
				return false;
			}
		};
	if (typeof File === 'undefined') {
		class File2 extends Blob {
			name;
			lastModified;
			lastModifiedDate;
			webkitRelativePath;
			constructor(sources, fileName, options) {
				super(sources);
				let date;
				if (options?.lastModified) {
					date = new Date();
				}
				if (!date || isNaN(date.getFullYear())) {
					date = new Date();
				}
				this.lastModifiedDate = date;
				this.lastModified = date.getMilliseconds();
				this.name = fileName || '';
			}
		}
		global.File = File2;
	}
	if (typeof Blob.prototype.arrayBuffer === 'undefined') {
		Blob.prototype.arrayBuffer = function arrayBuffer() {
			const reader = new FileReader();
			reader.readAsArrayBuffer(this);
			return asPromise(reader);
		};
	}
	if (typeof Blob.prototype.text === 'undefined') {
		Blob.prototype.text = function text() {
			const reader = new FileReader();
			reader.readAsText(this);
			return asPromise(reader);
		};
	}
	if (typeof Blob.prototype.stream === 'undefined' || !isByobSupported()) {
		Blob.prototype.stream = function () {
			let position = 0;
			const blob = this;
			return new ReadableStream({
				type: 'bytes',
				autoAllocateChunkSize: 524288,
				async pull(controller) {
					const view = controller.byobRequest.view;
					const chunk = blob.slice(
						position,
						position + view.byteLength
					);
					const buffer = await chunk.arrayBuffer();
					const uint8array = new Uint8Array(buffer);
					new Uint8Array(view.buffer).set(uint8array);
					const bytesRead = uint8array.byteLength;
					controller.byobRequest.respond(bytesRead);
					position += bytesRead;
					if (position >= blob.size) {
						controller.close();
					}
				},
			});
		};
	}
}

// ../../php-wasm/node-polyfills/src/lib/custom-event.ts
if (currentJsRuntime === 'NODE' && typeof CustomEvent === 'undefined') {
	class CustomEvent2 extends Event {
		detail;
		constructor(name, options = {}) {
			super(name, options);
			this.detail = options.detail;
		}
		initCustomEvent() {}
	}
	globalThis.CustomEvent = CustomEvent2;
}

// ../../php-wasm/universal/src/lib/emscripten-types.ts
var Emscripten;
(function (Emscripten) {
	let FS;
	(function (FS) {})((FS = Emscripten.FS || (Emscripten.FS = {})));
})(Emscripten || (Emscripten = {}));

// ../../php-wasm/universal/src/lib/rethrow-file-system-error.ts
function getEmscriptenFsError(e) {
	const errno = typeof e === 'object' ? e?.errno : null;
	if (errno in FileErrorCodes) {
		return FileErrorCodes[errno];
	}
}
function rethrowFileSystemError(messagePrefix = '') {
	return function catchFileSystemError(target, methodName, descriptor) {
		const method = descriptor.value;
		descriptor.value = function (...args) {
			try {
				return method.apply(this, args);
			} catch (e) {
				const errno = typeof e === 'object' ? e?.errno : null;
				if (errno in FileErrorCodes) {
					const errmsg = FileErrorCodes[errno];
					const path = typeof args[1] === 'string' ? args[1] : null;
					const formattedPrefix =
						path !== null
							? messagePrefix.replaceAll('{path}', path)
							: messagePrefix;
					throw new Error(`${formattedPrefix}: ${errmsg}`, {
						cause: e,
					});
				}
				throw e;
			}
		};
	};
}
var FileErrorCodes = {
	0: 'No error occurred. System call completed successfully.',
	1: 'Argument list too long.',
	2: 'Permission denied.',
	3: 'Address in use.',
	4: 'Address not available.',
	5: 'Address family not supported.',
	6: 'Resource unavailable, or operation would block.',
	7: 'Connection already in progress.',
	8: 'Bad file descriptor.',
	9: 'Bad message.',
	10: 'Device or resource busy.',
	11: 'Operation canceled.',
	12: 'No child processes.',
	13: 'Connection aborted.',
	14: 'Connection refused.',
	15: 'Connection reset.',
	16: 'Resource deadlock would occur.',
	17: 'Destination address required.',
	18: 'Mathematics argument out of domain of function.',
	19: 'Reserved.',
	20: 'File exists.',
	21: 'Bad address.',
	22: 'File too large.',
	23: 'Host is unreachable.',
	24: 'Identifier removed.',
	25: 'Illegal byte sequence.',
	26: 'Operation in progress.',
	27: 'Interrupted function.',
	28: 'Invalid argument.',
	29: 'I/O error.',
	30: 'Socket is connected.',
	31: 'There is a directory under that path.',
	32: 'Too many levels of symbolic links.',
	33: 'File descriptor value too large.',
	34: 'Too many links.',
	35: 'Message too large.',
	36: 'Reserved.',
	37: 'Filename too long.',
	38: 'Network is down.',
	39: 'Connection aborted by network.',
	40: 'Network unreachable.',
	41: 'Too many files open in system.',
	42: 'No buffer space available.',
	43: 'No such device.',
	44: 'There is no such file or directory OR the parent directory does not exist.',
	45: 'Executable file format error.',
	46: 'No locks available.',
	47: 'Reserved.',
	48: 'Not enough space.',
	49: 'No message of the desired type.',
	50: 'Protocol not available.',
	51: 'No space left on device.',
	52: 'Function not supported.',
	53: 'The socket is not connected.',
	54: 'Not a directory or a symbolic link to a directory.',
	55: 'Directory not empty.',
	56: 'State not recoverable.',
	57: 'Not a socket.',
	58: 'Not supported, or operation not supported on socket.',
	59: 'Inappropriate I/O control operation.',
	60: 'No such device or address.',
	61: 'Value too large to be stored in data type.',
	62: 'Previous owner died.',
	63: 'Operation not permitted.',
	64: 'Broken pipe.',
	65: 'Protocol error.',
	66: 'Protocol not supported.',
	67: 'Protocol wrong type for socket.',
	68: 'Result too large.',
	69: 'Read-only file system.',
	70: 'Invalid seek.',
	71: 'No such process.',
	72: 'Reserved.',
	73: 'Connection timed out.',
	74: 'Text file busy.',
	75: 'Cross-device link.',
	76: 'Extension: Capabilities insufficient.',
};

// ../../php-wasm/logger/src/lib/handlers/log-to-console.ts
var logToConsole = (log, ...args) => {
	if (typeof log.message === 'string') {
		log.message = prepareLogMessage(log.message);
	} else if (log.message.message && typeof log.message.message === 'string') {
		log.message.message = prepareLogMessage(log.message.message);
	}
	switch (log.severity) {
		case 'Debug':
			console.debug(log.message, ...args);
			break;
		case 'Info':
			console.info(log.message, ...args);
			break;
		case 'Warn':
			console.warn(log.message, ...args);
			break;
		case 'Error':
			console.error(log.message, ...args);
			break;
		case 'Fatal':
			console.error(log.message, ...args);
			break;
		default:
			console.log(log.message, ...args);
	}
};
// ../../php-wasm/logger/src/lib/handlers/log-to-memory.ts
var prepareLogMessage2 = (logMessage) => {
	if (logMessage instanceof Error) {
		return [logMessage.message, logMessage.stack].join('\n');
	}
	return JSON.stringify(logMessage, null, 2);
};
var logs = [];
var addToLogArray = (message) => {
	logs.push(message);
};
var logToMemory = (log) => {
	if (log.raw === true) {
		addToLogArray(log.message);
	} else {
		const message = formatLogEntry(
			typeof log.message === 'object'
				? prepareLogMessage2(log.message)
				: log.message,
			log.severity ?? 'Info',
			log.prefix ?? 'JavaScript'
		);
		addToLogArray(message);
	}
};
// ../../php-wasm/logger/src/lib/logger.ts
class Logger extends EventTarget {
	handlers;
	fatalErrorEvent = 'playground-fatal-error';
	constructor(handlers = []) {
		super();
		this.handlers = handlers;
	}
	getLogs() {
		if (!this.handlers.includes(logToMemory)) {
			this
				.error(`Logs aren't stored because the logToMemory handler isn't registered.
				If you're using a custom logger instance, make sure to register logToMemory handler.
			`);
			return [];
		}
		return [...logs];
	}
	logMessage(log, ...args) {
		for (const handler2 of this.handlers) {
			handler2(log, ...args);
		}
	}
	log(message, ...args) {
		this.logMessage(
			{
				message,
				severity: undefined,
				prefix: 'JavaScript',
				raw: false,
			},
			...args
		);
	}
	debug(message, ...args) {
		this.logMessage(
			{
				message,
				severity: 'Debug',
				prefix: 'JavaScript',
				raw: false,
			},
			...args
		);
	}
	info(message, ...args) {
		this.logMessage(
			{
				message,
				severity: 'Info',
				prefix: 'JavaScript',
				raw: false,
			},
			...args
		);
	}
	warn(message, ...args) {
		this.logMessage(
			{
				message,
				severity: 'Warn',
				prefix: 'JavaScript',
				raw: false,
			},
			...args
		);
	}
	error(message, ...args) {
		this.logMessage(
			{
				message,
				severity: 'Error',
				prefix: 'JavaScript',
				raw: false,
			},
			...args
		);
	}
}
var getDefaultHandlers = () => {
	try {
		if (false) {
		}
	} catch (e) {}
	return [logToMemory, logToConsole];
};
var logger3 = new Logger(getDefaultHandlers());
var prepareLogMessage = (message) => {
	return message.replace(/\t/g, '');
};
var formatLogEntry = (message, severity, prefix) => {
	const date = new Date();
	const formattedDate = new Intl.DateTimeFormat('en-GB', {
		year: 'numeric',
		month: 'short',
		day: '2-digit',
		timeZone: 'UTC',
	})
		.format(date)
		.replace(/ /g, '-');
	const formattedTime = new Intl.DateTimeFormat('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
		timeZone: 'UTC',
		timeZoneName: 'short',
	}).format(date);
	const now = formattedDate + ' ' + formattedTime;
	message = prepareLogMessage(message);
	return `[${now}] ${prefix} ${severity}: ${message}`;
};
// ../../php-wasm/universal/src/lib/fs-helpers.ts
class FSHelpers {
	static readFileAsText(FS, path) {
		return new TextDecoder().decode(FSHelpers.readFileAsBuffer(FS, path));
	}
	static readFileAsBuffer(FS, path) {
		return FS.readFile(path);
	}
	static writeFile(FS, path, data) {
		FS.writeFile(path, data);
	}
	static unlink(FS, path) {
		FS.unlink(path);
	}
	static mv(FS, fromPath, toPath) {
		try {
			const fromMount = FS.lookupPath(fromPath).node.mount;
			const toMount = FSHelpers.fileExists(FS, toPath)
				? FS.lookupPath(toPath).node.mount
				: FS.lookupPath(dirname(toPath)).node.mount;
			const movingBetweenFilesystems =
				fromMount.mountpoint !== toMount.mountpoint;
			if (movingBetweenFilesystems) {
				FSHelpers.copyRecursive(FS, fromPath, toPath);
				FSHelpers.rmdir(FS, fromPath, { recursive: true });
			} else {
				FS.rename(fromPath, toPath);
			}
		} catch (e) {
			const errmsg = getEmscriptenFsError(e);
			if (!errmsg) {
				throw e;
			}
			throw new Error(
				`Could not move ${fromPath} to ${toPath}: ${errmsg}`,
				{
					cause: e,
				}
			);
		}
	}
	static rmdir(FS, path, options = { recursive: true }) {
		if (options?.recursive) {
			FSHelpers.listFiles(FS, path).forEach((file) => {
				const filePath = `${path}/${file}`;
				if (FSHelpers.isDir(FS, filePath)) {
					FSHelpers.rmdir(FS, filePath, options);
				} else {
					FSHelpers.unlink(FS, filePath);
				}
			});
		}
		FS.rmdir(path);
	}
	static listFiles(FS, path, options = { prependPath: false }) {
		if (!FSHelpers.fileExists(FS, path)) {
			return [];
		}
		try {
			const files = FS.readdir(path).filter(
				(name) => name !== '.' && name !== '..'
			);
			if (options.prependPath) {
				const prepend = path.replace(/\/$/, '');
				return files.map((name) => `${prepend}/${name}`);
			}
			return files;
		} catch (e) {
			logger3.error(e, { path });
			return [];
		}
	}
	static isDir(FS, path) {
		if (!FSHelpers.fileExists(FS, path)) {
			return false;
		}
		return FS.isDir(FS.lookupPath(path).node.mode);
	}
	static fileExists(FS, path) {
		try {
			FS.lookupPath(path);
			return true;
		} catch (e) {
			return false;
		}
	}
	static mkdir(FS, path) {
		FS.mkdirTree(path);
	}
	static copyRecursive(FS, fromPath, toPath) {
		const fromNode = FS.lookupPath(fromPath).node;
		if (FS.isDir(fromNode.mode)) {
			FS.mkdirTree(toPath);
			const filenames = FS.readdir(fromPath).filter(
				(name) => name !== '.' && name !== '..'
			);
			for (const filename of filenames) {
				FSHelpers.copyRecursive(
					FS,
					joinPaths(fromPath, filename),
					joinPaths(toPath, filename)
				);
			}
		} else {
			FS.writeFile(toPath, FS.readFile(fromPath));
		}
	}
}
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not read "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
		]),
		__legacyMetadataTS('design:returntype', undefined),
	],
	FSHelpers,
	'readFileAsText',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not read "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
		]),
		__legacyMetadataTS(
			'design:returntype',
			typeof Uint8Array === 'undefined' ? Object : Uint8Array
		),
	],
	FSHelpers,
	'readFileAsBuffer',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not write to "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
			Object,
		]),
		__legacyMetadataTS('design:returntype', undefined),
	],
	FSHelpers,
	'writeFile',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not unlink "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
		]),
		__legacyMetadataTS('design:returntype', undefined),
	],
	FSHelpers,
	'unlink',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not remove directory "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
			typeof RmDirOptions === 'undefined' ? Object : RmDirOptions,
		]),
		__legacyMetadataTS('design:returntype', undefined),
	],
	FSHelpers,
	'rmdir',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not list files in "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
			typeof ListFilesOptions === 'undefined' ? Object : ListFilesOptions,
		]),
		__legacyMetadataTS('design:returntype', Array),
	],
	FSHelpers,
	'listFiles',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not stat "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
		]),
		__legacyMetadataTS('design:returntype', Boolean),
	],
	FSHelpers,
	'isDir',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not stat "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
		]),
		__legacyMetadataTS('design:returntype', Boolean),
	],
	FSHelpers,
	'fileExists',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not create directory "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.RootFS === 'undefined'
				? Object
				: Emscripten.RootFS,
			String,
		]),
		__legacyMetadataTS('design:returntype', undefined),
	],
	FSHelpers,
	'mkdir',
	null
);
__legacyDecorateClassTS(
	[
		rethrowFileSystemError('Could not copy files from "{path}"'),
		__legacyMetadataTS('design:type', Function),
		__legacyMetadataTS('design:paramtypes', [
			typeof Emscripten === 'undefined' ||
			typeof Emscripten.FileSystemInstance === 'undefined'
				? Object
				: Emscripten.FileSystemInstance,
			String,
			String,
		]),
		__legacyMetadataTS('design:returntype', undefined),
	],
	FSHelpers,
	'copyRecursive',
	null
);
// ../../php-wasm/universal/src/lib/php-worker.ts
var _private = new WeakMap();
// ../../php-wasm/universal/src/lib/php-response.ts
var responseTexts = {
	500: 'Internal Server Error',
	502: 'Bad Gateway',
	404: 'Not Found',
	403: 'Forbidden',
	401: 'Unauthorized',
	400: 'Bad Request',
	301: 'Moved Permanently',
	302: 'Found',
	307: 'Temporary Redirect',
	308: 'Permanent Redirect',
	204: 'No Content',
	201: 'Created',
	200: 'OK',
};

class PHPResponse {
	headers;
	bytes;
	errors;
	exitCode;
	httpStatusCode;
	constructor(httpStatusCode, headers, body, errors = '', exitCode = 0) {
		this.httpStatusCode = httpStatusCode;
		this.headers = headers;
		this.bytes = body;
		this.exitCode = exitCode;
		this.errors = errors;
	}
	static forHttpCode(httpStatusCode, text = '') {
		return new PHPResponse(
			httpStatusCode,
			{},
			new TextEncoder().encode(
				text || responseTexts[httpStatusCode] || ''
			)
		);
	}
	static fromRawData(data) {
		return new PHPResponse(
			data.httpStatusCode,
			data.headers,
			data.bytes,
			data.errors,
			data.exitCode
		);
	}
	toRawData() {
		return {
			headers: this.headers,
			bytes: this.bytes,
			errors: this.errors,
			exitCode: this.exitCode,
			httpStatusCode: this.httpStatusCode,
		};
	}
	get json() {
		return JSON.parse(this.text);
	}
	get text() {
		return new TextDecoder().decode(this.bytes);
	}
}

// ../../php-wasm/universal/src/lib/load-php-runtime.ts
async function loadPHPRuntime(phpLoaderModule, phpModuleArgs = {}) {
	const [phpReady, resolvePHP, rejectPHP] = makePromise();
	const PHPRuntime = phpLoaderModule.init(currentJsRuntime2, {
		onAbort(reason) {
			rejectPHP(reason);
			logger3.error(reason);
		},
		ENV: {},
		locateFile: (path) => path,
		...phpModuleArgs,
		noInitialRun: true,
		onRuntimeInitialized() {
			if (phpModuleArgs.onRuntimeInitialized) {
				phpModuleArgs.onRuntimeInitialized();
			}
			resolvePHP();
		},
	});
	await phpReady;
	const id = ++lastRuntimeId;
	PHPRuntime.id = id;
	PHPRuntime.originalExit = PHPRuntime._exit;
	PHPRuntime._exit = function (code) {
		loadedRuntimes.delete(id);
		return PHPRuntime.originalExit(code);
	};
	PHPRuntime[RuntimeId] = id;
	loadedRuntimes.set(id, PHPRuntime);
	return id;
}
function getLoadedRuntime(id) {
	return loadedRuntimes.get(id);
}
var RuntimeId = Symbol('RuntimeId');
var loadedRuntimes = new Map();
var lastRuntimeId = 0;
var currentJsRuntime2 = (function () {
	if (typeof process !== 'undefined' && process.release?.name === 'node') {
		return 'NODE';
	} else if (typeof window !== 'undefined') {
		return 'WEB';
	} else if (
		typeof WorkerGlobalScope !== 'undefined' &&
		self instanceof WorkerGlobalScope
	) {
		return 'WORKER';
	} else {
		return 'NODE';
	}
})();
var makePromise = () => {
	const methods = [];
	const promise = new Promise((resolve, reject) => {
		methods.push(resolve, reject);
	});
	methods.unshift(promise);
	return methods;
};

// ../../php-wasm/universal/src/lib/error-event-polyfill.ts
var kError = Symbol('error');
var kMessage = Symbol('message');

class ErrorEvent2 extends Event {
	[kError];
	[kMessage];
	constructor(type, options = {}) {
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
var ErrorEvent =
	typeof globalThis.ErrorEvent === 'function'
		? globalThis.ErrorEvent
		: ErrorEvent2;

// ../../php-wasm/universal/src/lib/is-exit-code-zero.ts
function isExitCodeZero(e) {
	if (!(e instanceof Error)) {
		return false;
	}
	return (
		('exitCode' in e && e?.exitCode === 0) ||
		(e?.name === 'ExitStatus' && 'status' in e && e.status === 0)
	);
}

// ../../php-wasm/universal/src/lib/wasm-error-reporting.ts
function improveWASMErrorReporting(runtime) {
	const target = new UnhandledRejectionsTarget();
	for (const key in runtime.wasmExports) {
		if (typeof runtime.wasmExports[key] == 'function') {
			const original = runtime.wasmExports[key];
			runtime.wasmExports[key] = function (...args) {
				try {
					return original(...args);
				} catch (e) {
					if (!(e instanceof Error)) {
						throw e;
					}
					const clearMessage = clarifyErrorMessage(
						e,
						runtime.lastAsyncifyStackSource?.stack
					);
					if (runtime.lastAsyncifyStackSource) {
						e.cause = runtime.lastAsyncifyStackSource;
					}
					if (target.hasListeners()) {
						target.dispatchEvent(
							new ErrorEvent('error', {
								error: e,
								message: clearMessage,
							})
						);
						return;
					}
					if (!isExitCodeZero(e)) {
						showCriticalErrorBox(clearMessage);
					}
					throw e;
				}
			};
		}
	}
	return target;
}
function getFunctionsMaybeMissingFromAsyncify() {
	return functionsMaybeMissingFromAsyncify;
}
function clarifyErrorMessage(crypticError, asyncifyStack) {
	if (crypticError.message === 'unreachable') {
		let betterMessage = UNREACHABLE_ERROR;
		if (!asyncifyStack) {
			betterMessage += `\n\nThis stack trace is lacking. For a better one initialize \nthe PHP runtime with { debug: true }, e.g. PHPNode.load('8.1', { debug: true }).\n\n`;
		}
		functionsMaybeMissingFromAsyncify = extractPHPFunctionsFromStack(
			asyncifyStack || crypticError.stack || ''
		);
		for (const fn of functionsMaybeMissingFromAsyncify) {
			betterMessage += `    * ${fn}\n`;
		}
		return betterMessage;
	}
	return crypticError.message;
}
function showCriticalErrorBox(message) {
	if (logged) {
		return;
	}
	logged = true;
	if (message?.trim().startsWith('Program terminated with exit')) {
		return;
	}
	logger3.log(`${redBg}\n${eol}\n${bold}  WASM ERROR${reset}${redBg}`);
	for (const line of message.split('\n')) {
		logger3.log(`${eol}  ${line} `);
	}
	logger3.log(`${reset}`);
}
var extractPHPFunctionsFromStack = function (stack) {
	try {
		const names = stack
			.split('\n')
			.slice(1)
			.map((line) => {
				const parts = line.trim().substring('at '.length).split(' ');
				return {
					fn: parts.length >= 2 ? parts[0] : '<unknown>',
					isWasm: line.includes('wasm://'),
				};
			})
			.filter(
				({ fn, isWasm }) =>
					isWasm &&
					!fn.startsWith('dynCall_') &&
					!fn.startsWith('invoke_')
			)
			.map(({ fn }) => fn);
		return Array.from(new Set(names));
	} catch (err) {
		return [];
	}
};

class UnhandledRejectionsTarget extends EventTarget {
	constructor() {
		super(...arguments);
	}
	listenersCount = 0;
	addEventListener(type, callback) {
		++this.listenersCount;
		super.addEventListener(type, callback);
	}
	removeEventListener(type, callback) {
		--this.listenersCount;
		super.removeEventListener(type, callback);
	}
	hasListeners() {
		return this.listenersCount > 0;
	}
}
var functionsMaybeMissingFromAsyncify = [];
var UNREACHABLE_ERROR = `
"unreachable" WASM instruction executed.

The typical reason is a PHP function missing from the ASYNCIFY_ONLY
list when building PHP.wasm.

You will need to file a new issue in the WordPress Playground repository
and paste this error message there:

https://github.com/WordPress/wordpress-playground/issues/new

If you're a core developer, the typical fix is to:

* Isolate a minimal reproduction of the error
* Add a reproduction of the error to php-asyncify.spec.ts in the WordPress Playground repository
* Run 'npm run fix-asyncify'
* Commit the changes, push to the repo, release updated NPM packages

Below is a list of all the PHP functions found in the stack trace to
help with the minimal reproduction. If they're all already listed in
the Dockerfile, you'll need to trigger this error again with long stack
traces enabled. In node.js, you can do it using the --stack-trace-limit=100
CLI option: \n\n`;
var redBg = '\x1B[41m';
var bold = '\x1B[1m';
var reset = '\x1B[0m';
var eol = '\x1B[K';
var logged = false;

// ../../php-wasm/universal/src/lib/php.ts
function normalizeHeaders(headers) {
	const normalized = {};
	for (const key in headers) {
		normalized[key.toLowerCase()] = headers[key];
	}
	return normalized;
}
function copyFS(source, target, path) {
	let oldNode;
	try {
		oldNode = source.lookupPath(path);
	} catch (e) {
		return;
	}
	if (!('contents' in oldNode.node)) {
		return;
	}
	try {
	} catch (e) {}
	if (!source.isDir(oldNode.node.mode)) {
		target.writeFile(path, source.readFile(path));
		return;
	}
	target.mkdirTree(path);
	const filenames = source
		.readdir(path)
		.filter((name) => name !== '.' && name !== '..');
	for (const filename of filenames) {
		copyFS(source, target, joinPaths(path, filename));
	}
}
var STRING = 'string';
var NUMBER = 'number';
var __private__dont__use = Symbol('__private__dont__use');

class PHPExecutionFailureError extends Error {
	response;
	source;
	constructor(message, response, source) {
		super(message);
		this.response = response;
		this.source = source;
	}
}
var PHP_INI_PATH = '/internal/shared/php.ini';
var AUTO_PREPEND_SCRIPT = '/internal/shared/auto_prepend_file.php';

class PHP {
	[__private__dont__use];
	#sapiName;
	#webSapiInitialized = false;
	#wasmErrorsTarget = null;
	#eventListeners = new Map();
	#messageListeners = [];
	requestHandler;
	semaphore;
	constructor(PHPRuntimeId) {
		this.semaphore = new Semaphore({ concurrency: 1 });
		if (PHPRuntimeId !== undefined) {
			this.initializeRuntime(PHPRuntimeId);
		}
	}
	addEventListener(eventType, listener) {
		if (!this.#eventListeners.has(eventType)) {
			this.#eventListeners.set(eventType, new Set());
		}
		this.#eventListeners.get(eventType).add(listener);
	}
	removeEventListener(eventType, listener) {
		this.#eventListeners.get(eventType)?.delete(listener);
	}
	dispatchEvent(event) {
		const listeners = this.#eventListeners.get(event.type);
		if (!listeners) {
			return;
		}
		for (const listener of listeners) {
			listener(event);
		}
	}
	onMessage(listener) {
		this.#messageListeners.push(listener);
	}
	async setSpawnHandler(handler) {
		if (typeof handler === 'string') {
			handler = createSpawnHandler(eval(handler));
		}
		this[__private__dont__use].spawnProcess = handler;
	}
	get absoluteUrl() {
		return this.requestHandler.absoluteUrl;
	}
	get documentRoot() {
		return this.requestHandler.documentRoot;
	}
	pathToInternalUrl(path) {
		return this.requestHandler.pathToInternalUrl(path);
	}
	internalUrlToPath(internalUrl) {
		return this.requestHandler.internalUrlToPath(internalUrl);
	}
	initializeRuntime(runtimeId) {
		if (this[__private__dont__use]) {
			throw new Error('PHP runtime already initialized.');
		}
		const runtime = getLoadedRuntime(runtimeId);
		if (!runtime) {
			throw new Error('Invalid PHP runtime id.');
		}
		this[__private__dont__use] = runtime;
		this[__private__dont__use].ccall(
			'wasm_set_phpini_path',
			null,
			['string'],
			[PHP_INI_PATH]
		);
		if (!this.fileExists(PHP_INI_PATH)) {
			this.writeFile(
				PHP_INI_PATH,
				[
					'auto_prepend_file=' + AUTO_PREPEND_SCRIPT,
					'memory_limit=256M',
					'ignore_repeated_errors = 1',
					'error_reporting = E_ALL',
					'display_errors = 1',
					'html_errors = 1',
					'display_startup_errors = On',
					'log_errors = 1',
					'always_populate_raw_post_data = -1',
					'upload_max_filesize = 2000M',
					'post_max_size = 2000M',
					'disable_functions = curl_exec,curl_multi_exec',
					'allow_url_fopen = Off',
					'allow_url_include = Off',
					'session.save_path = /home/web_user',
					'implicit_flush = 1',
					'output_buffering = 0',
					'max_execution_time = 0',
					'max_input_time = -1',
				].join('\n')
			);
		}
		if (!this.fileExists(AUTO_PREPEND_SCRIPT)) {
			this.writeFile(
				AUTO_PREPEND_SCRIPT,
				`<?php
				// Define constants set via defineConstant() calls
				if(file_exists('/internal/shared/consts.json')) {
					\$consts = json_decode(file_get_contents('/internal/shared/consts.json'), true);
					foreach (\$consts as \$const => \$value) {
						if (!defined(\$const) && is_scalar(\$value)) {
							define(\$const, \$value);
						}
					}
				}
				// Preload all the files from /internal/shared/preload
				foreach (glob('/internal/shared/preload/*.php') as \$file) {
					require_once \$file;
				}
				`
			);
		}
		runtime['onMessage'] = async (data) => {
			for (const listener of this.#messageListeners) {
				const returnData = await listener(data);
				if (returnData) {
					return returnData;
				}
			}
			return '';
		};
		this.#wasmErrorsTarget = improveWASMErrorReporting(runtime);
		this.dispatchEvent({
			type: 'runtime.initialized',
		});
	}
	async setSapiName(newName) {
		const result = this[__private__dont__use].ccall(
			'wasm_set_sapi_name',
			NUMBER,
			[STRING],
			[newName]
		);
		if (result !== 0) {
			throw new Error(
				'Could not set SAPI name. This can only be done before the PHP WASM module is initialized.Did you already dispatch any requests?'
			);
		}
		this.#sapiName = newName;
	}
	chdir(path) {
		this[__private__dont__use].FS.chdir(path);
	}
	async request(request) {
		logger3.warn(
			'PHP.request() is deprecated. Please use new PHPRequestHandler() instead.'
		);
		if (!this.requestHandler) {
			throw new Error('No request handler available.');
		}
		return this.requestHandler.request(request);
	}
	async run(request) {
		console.log('PHP run', request);
		const release = await this.semaphore.acquire();
		let heapBodyPointer;
		try {
			if (!this.#webSapiInitialized) {
				this.#initWebRuntime();
				this.#webSapiInitialized = true;
			}
			if (request.scriptPath && !this.fileExists(request.scriptPath)) {
				throw new Error(
					`The script path "${request.scriptPath}" does not exist.`
				);
			}
			this.#setRelativeRequestUri(request.relativeUri || '');
			this.#setRequestMethod(request.method || 'GET');
			const headers = normalizeHeaders(request.headers || {});
			const host = headers['host'] || 'example.com:443';
			const port = this.#inferPortFromHostAndProtocol(
				host,
				request.protocol || 'http'
			);
			this.#setRequestHost(host);
			this.#setRequestPort(port);
			this.#setRequestHeaders(headers);
			if (request.body) {
				heapBodyPointer = this.#setRequestBody(request.body);
			}
			if (typeof request.code === 'string') {
				this.writeFile('/internal/eval.php', request.code);
				this.#setScriptPath('/internal/eval.php');
			} else {
				this.#setScriptPath(request.scriptPath || '');
			}
			const $_SERVER = this.#prepareServerEntries(
				request.$_SERVER,
				headers,
				port
			);
			for (const key in $_SERVER) {
				this.#setServerGlobalEntry(key, $_SERVER[key]);
			}
			const env = request.env || {};
			for (const key in env) {
				this.#setEnv(key, env[key]);
			}
			const response = await this.#handleRequest();
			if (response.exitCode !== 0) {
				logger3.warn(`PHP.run() output was:`, response.text);
				const error = new PHPExecutionFailureError(
					`PHP.run() failed with exit code ${response.exitCode} and the following output: ` +
						response.errors,
					response,
					'request'
				);
				logger3.error(error);
				throw error;
			}
			return response;
		} catch (e) {
			this.dispatchEvent({
				type: 'request.error',
				error: e,
				source: e.source ?? 'php-wasm',
			});
			throw e;
		} finally {
			try {
				if (heapBodyPointer) {
					this[__private__dont__use].free(heapBodyPointer);
				}
			} finally {
				release();
				this.dispatchEvent({
					type: 'request.end',
				});
			}
		}
	}
	#prepareServerEntries(defaults, headers, port) {
		const $_SERVER = {
			...(defaults || {}),
		};
		$_SERVER['HTTPS'] = $_SERVER['HTTPS'] || port === 443 ? 'on' : 'off';
		for (const name in headers) {
			let HTTP_prefix = 'HTTP_';
			if (
				['content-type', 'content-length'].includes(name.toLowerCase())
			) {
				HTTP_prefix = '';
			}
			$_SERVER[`${HTTP_prefix}${name.toUpperCase().replace(/-/g, '_')}`] =
				headers[name];
		}
		return $_SERVER;
	}
	#initWebRuntime() {
		this[__private__dont__use].ccall('php_wasm_init', null, [], []);
	}
	#getResponseHeaders() {
		const headersFilePath = '/internal/headers.json';
		if (!this.fileExists(headersFilePath)) {
			throw new Error(
				'SAPI Error: Could not find response headers file.'
			);
		}
		const headersData = JSON.parse(this.readFileAsText(headersFilePath));
		const headers = {};
		for (const line of headersData.headers) {
			if (!line.includes(': ')) {
				continue;
			}
			const colonIndex = line.indexOf(': ');
			const headerName = line.substring(0, colonIndex).toLowerCase();
			const headerValue = line.substring(colonIndex + 2);
			if (!(headerName in headers)) {
				headers[headerName] = [];
			}
			headers[headerName].push(headerValue);
		}
		return {
			headers,
			httpStatusCode: headersData.status,
		};
	}
	#setRelativeRequestUri(uri) {
		this[__private__dont__use].ccall(
			'wasm_set_request_uri',
			null,
			[STRING],
			[uri]
		);
		if (uri.includes('?')) {
			const queryString = uri.substring(uri.indexOf('?') + 1);
			this[__private__dont__use].ccall(
				'wasm_set_query_string',
				null,
				[STRING],
				[queryString]
			);
		}
	}
	#setRequestHost(host) {
		this[__private__dont__use].ccall(
			'wasm_set_request_host',
			null,
			[STRING],
			[host]
		);
	}
	#setRequestPort(port) {
		this[__private__dont__use].ccall(
			'wasm_set_request_port',
			null,
			[NUMBER],
			[port]
		);
	}
	#inferPortFromHostAndProtocol(host, protocol) {
		let port;
		try {
			port = parseInt(new URL(host).port, 10);
		} catch (e) {}
		if (!port || isNaN(port) || port === 80) {
			port = protocol === 'https' ? 443 : 80;
		}
		return port;
	}
	#setRequestMethod(method) {
		this[__private__dont__use].ccall(
			'wasm_set_request_method',
			null,
			[STRING],
			[method]
		);
	}
	#setRequestHeaders(headers) {
		if (headers['cookie']) {
			this[__private__dont__use].ccall(
				'wasm_set_cookies',
				null,
				[STRING],
				[headers['cookie']]
			);
		}
		if (headers['content-type']) {
			this[__private__dont__use].ccall(
				'wasm_set_content_type',
				null,
				[STRING],
				[headers['content-type']]
			);
		}
		if (headers['content-length']) {
			this[__private__dont__use].ccall(
				'wasm_set_content_length',
				null,
				[NUMBER],
				[parseInt(headers['content-length'], 10)]
			);
		}
	}
	#setRequestBody(body) {
		let size, contentLength;
		if (typeof body === 'string') {
			logger3.warn(
				'Passing a string as the request body is deprecated. Please use a Uint8Array instead. See https://github.com/WordPress/wordpress-playground/issues/997 for more details'
			);
			contentLength = this[__private__dont__use].lengthBytesUTF8(body);
			size = contentLength + 1;
		} else {
			contentLength = body.byteLength;
			size = body.byteLength;
		}
		const heapBodyPointer = this[__private__dont__use].malloc(size);
		if (!heapBodyPointer) {
			throw new Error('Could not allocate memory for the request body.');
		}
		if (typeof body === 'string') {
			this[__private__dont__use].stringToUTF8(
				body,
				heapBodyPointer,
				size + 1
			);
		} else {
			this[__private__dont__use].HEAPU8.set(body, heapBodyPointer);
		}
		this[__private__dont__use].ccall(
			'wasm_set_request_body',
			null,
			[NUMBER],
			[heapBodyPointer]
		);
		this[__private__dont__use].ccall(
			'wasm_set_content_length',
			null,
			[NUMBER],
			[contentLength]
		);
		return heapBodyPointer;
	}
	#setScriptPath(path) {
		this[__private__dont__use].ccall(
			'wasm_set_path_translated',
			null,
			[STRING],
			[path]
		);
	}
	#setServerGlobalEntry(key, value) {
		this[__private__dont__use].ccall(
			'wasm_add_SERVER_entry',
			null,
			[STRING, STRING],
			[key, value]
		);
	}
	#setEnv(name, value) {
		this[__private__dont__use].ccall(
			'wasm_add_ENV_entry',
			null,
			[STRING, STRING],
			[name, value]
		);
	}
	defineConstant(key, value) {
		let consts = {};
		try {
			consts = JSON.parse(
				this.fileExists('/internal/shared/consts.json')
					? this.readFileAsText('/internal/shared/consts.json') ||
							'{}'
					: '{}'
			);
		} catch (e) {}
		this.writeFile(
			'/internal/shared/consts.json',
			JSON.stringify({
				...consts,
				[key]: value,
			})
		);
	}
	async #handleRequest() {
		let exitCode;
		let errorListener;
		try {
			exitCode = await new Promise((resolve, reject) => {
				errorListener = (e) => {
					logger3.error(e);
					logger3.error(e.error);
					const rethrown = new Error('Rethrown');
					rethrown.cause = e.error;
					rethrown.betterMessage = e.message;
					reject(rethrown);
				};
				this.#wasmErrorsTarget?.addEventListener(
					'error',
					errorListener
				);
				const response = this[__private__dont__use].ccall(
					'wasm_sapi_handle_request',
					NUMBER,
					[],
					[],
					{ async: true }
				);
				if (response instanceof Promise) {
					return response.then(resolve, reject);
				}
				return resolve(response);
			});
		} catch (e) {
			for (const name in this) {
				if (typeof this[name] === 'function') {
					this[name] = () => {
						throw new Error(
							`PHP runtime has crashed \u2013 see the earlier error for details.`
						);
					};
				}
			}
			this.functionsMaybeMissingFromAsyncify =
				getFunctionsMaybeMissingFromAsyncify();
			const err = e;
			const message =
				'betterMessage' in err ? err.betterMessage : err.message;
			const rethrown = new Error(message);
			rethrown.cause = err;
			logger3.error(rethrown);
			throw rethrown;
		} finally {
			this.#wasmErrorsTarget?.removeEventListener('error', errorListener);
		}
		const { headers, httpStatusCode } = this.#getResponseHeaders();
		return new PHPResponse(
			exitCode === 0 ? httpStatusCode : 500,
			headers,
			this.readFileAsBuffer('/internal/stdout'),
			this.readFileAsText('/internal/stderr'),
			exitCode
		);
	}
	mkdir(path) {
		return FSHelpers.mkdir(this[__private__dont__use].FS, path);
	}
	mkdirTree(path) {
		return FSHelpers.mkdir(this[__private__dont__use].FS, path);
	}
	readFileAsText(path) {
		return FSHelpers.readFileAsText(this[__private__dont__use].FS, path);
	}
	readFileAsBuffer(path) {
		return FSHelpers.readFileAsBuffer(this[__private__dont__use].FS, path);
	}
	writeFile(path, data) {
		return FSHelpers.writeFile(this[__private__dont__use].FS, path, data);
	}
	unlink(path) {
		return FSHelpers.unlink(this[__private__dont__use].FS, path);
	}
	mv(fromPath, toPath) {
		return FSHelpers.mv(this[__private__dont__use].FS, fromPath, toPath);
	}
	rmdir(path, options = { recursive: true }) {
		return FSHelpers.rmdir(this[__private__dont__use].FS, path, options);
	}
	listFiles(path, options = { prependPath: false }) {
		return FSHelpers.listFiles(
			this[__private__dont__use].FS,
			path,
			options
		);
	}
	isDir(path) {
		return FSHelpers.isDir(this[__private__dont__use].FS, path);
	}
	fileExists(path) {
		return FSHelpers.fileExists(this[__private__dont__use].FS, path);
	}
	hotSwapPHPRuntime(runtime, cwd) {
		const oldFS = this[__private__dont__use].FS;
		try {
			this.exit();
		} catch (e) {}
		this.initializeRuntime(runtime);
		if (this.#sapiName) {
			this.setSapiName(this.#sapiName);
		}
		if (cwd) {
			copyFS(oldFS, this[__private__dont__use].FS, cwd);
		}
	}
	async mount(virtualFSPath, mountHandler) {
		return await mountHandler(
			this,
			this[__private__dont__use].FS,
			virtualFSPath
		);
	}
	async cli(argv) {
		for (const arg of argv) {
			this[__private__dont__use].ccall(
				'wasm_add_cli_arg',
				null,
				[STRING],
				[arg]
			);
		}
		try {
			return await this[__private__dont__use].ccall(
				'run_cli',
				null,
				[],
				[],
				{
					async: true,
				}
			);
		} catch (error) {
			if (isExitCodeZero(error)) {
				return 0;
			}
			throw error;
		}
	}
	setSkipShebang(shouldSkip) {
		this[__private__dont__use].ccall(
			'wasm_set_skip_shebang',
			null,
			[NUMBER],
			[shouldSkip ? 1 : 0]
		);
	}
	exit(code = 0) {
		this.dispatchEvent({
			type: 'runtime.beforedestroy',
		});
		try {
			this[__private__dont__use]._exit(code);
		} catch (e) {}
		this.#webSapiInitialized = false;
		this.#wasmErrorsTarget = null;
		delete this[__private__dont__use]['onMessage'];
		delete this[__private__dont__use];
	}
	[Symbol.dispose]() {
		if (this.#webSapiInitialized) {
			this.exit(0);
		}
	}
}

// ../../php-wasm/universal/src/lib/ini.ts
var import_ini = __toESM(require_ini(), 1);
async function setPhpIniEntries(php2, entries) {
	const ini = import_ini.parse(await php2.readFileAsText(PHP_INI_PATH));
	for (const [key, value] of Object.entries(entries)) {
		if (value === undefined || value === null) {
			delete ini[key];
		} else {
			ini[key] = value;
		}
	}
	await php2.writeFile(PHP_INI_PATH, import_ini.stringify(ini));
}
async function withPHPIniValues(php2, phpIniValues, callback) {
	const iniBefore = await php2.readFileAsText(PHP_INI_PATH);
	try {
		await setPhpIniEntries(php2, phpIniValues);
		return await callback();
	} finally {
		await php2.writeFile(PHP_INI_PATH, iniBefore);
	}
}
// ../../php-wasm/universal/src/lib/http-cookie-store.ts
class HttpCookieStore {
	cookies = {};
	rememberCookiesFromResponseHeaders(headers) {
		if (!headers?.['set-cookie']) {
			return;
		}
		for (const setCookie of headers['set-cookie']) {
			try {
				if (!setCookie.includes('=')) {
					continue;
				}
				const equalsIndex = setCookie.indexOf('=');
				const name = setCookie.substring(0, equalsIndex);
				const value = setCookie
					.substring(equalsIndex + 1)
					.split(';')[0];
				this.cookies[name] = value;
			} catch (e) {
				logger3.error(e);
			}
		}
	}
	getCookieRequestHeader() {
		const cookiesArray = [];
		for (const name in this.cookies) {
			cookiesArray.push(`${name}=${this.cookies[name]}`);
		}
		return cookiesArray.join('; ');
	}
}
// ../../php-wasm/stream-compression/src/utils/iterable-stream-polyfill.ts
if (!ReadableStream.prototype[Symbol.asyncIterator]) {
	ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
		const reader = this.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					return;
				}
				yield value;
			}
		} finally {
			reader.releaseLock();
		}
	};
	ReadableStream.prototype.iterate =
		ReadableStream.prototype[Symbol.asyncIterator];
}
// ../../php-wasm/stream-compression/src/zip/decode-remote-zip.ts
var fetchSemaphore = new Semaphore({ concurrency: 10 });
// ../../php-wasm/universal/src/lib/php-process-manager.ts
class MaxPhpInstancesError extends Error {
	constructor(limit) {
		super(
			`Requested more concurrent PHP instances than the limit (${limit}).`
		);
		this.name = this.constructor.name;
	}
}

class PHPProcessManager {
	primaryPhp;
	primaryIdle = true;
	nextInstance = null;
	allInstances = [];
	phpFactory;
	maxPhpInstances;
	semaphore;
	constructor(options) {
		this.maxPhpInstances = options?.maxPhpInstances ?? 5;
		this.phpFactory = options?.phpFactory;
		this.primaryPhp = options?.primaryPhp;
		this.semaphore = new Semaphore({
			concurrency: this.maxPhpInstances,
			timeout: options?.timeout || 5000,
		});
	}
	async getPrimaryPhp() {
		if (!this.phpFactory && !this.primaryPhp) {
			throw new Error(
				'phpFactory or primaryPhp must be set before calling getPrimaryPhp().'
			);
		} else if (!this.primaryPhp) {
			const spawned = await this.spawn({ isPrimary: true });
			this.primaryPhp = spawned.php;
		}
		return this.primaryPhp;
	}
	async acquirePHPInstance() {
		if (this.primaryIdle) {
			this.primaryIdle = false;
			return {
				php: await this.getPrimaryPhp(),
				reap: () => (this.primaryIdle = true),
			};
		}
		const spawnedPhp =
			this.nextInstance || this.spawn({ isPrimary: false });
		if (this.semaphore.remaining > 0) {
			this.nextInstance = this.spawn({ isPrimary: false });
		} else {
			this.nextInstance = null;
		}
		return await spawnedPhp;
	}
	spawn(factoryArgs) {
		if (factoryArgs.isPrimary && this.allInstances.length > 0) {
			throw new Error(
				'Requested spawning a primary PHP instance when another primary instance already started spawning.'
			);
		}
		const spawned = this.doSpawn(factoryArgs);
		this.allInstances.push(spawned);
		const pop = () => {
			this.allInstances = this.allInstances.filter(
				(instance) => instance !== spawned
			);
		};
		return spawned
			.catch((rejection) => {
				pop();
				throw rejection;
			})
			.then((result) => ({
				...result,
				reap: () => {
					pop();
					result.reap();
				},
			}));
	}
	async doSpawn(factoryArgs) {
		let release;
		try {
			release = await this.semaphore.acquire();
		} catch (error) {
			if (error instanceof AcquireTimeoutError) {
				throw new MaxPhpInstancesError(this.maxPhpInstances);
			}
			throw error;
		}
		try {
			const php2 = await this.phpFactory(factoryArgs);
			return {
				php: php2,
				reap() {
					php2.exit();
					release();
				},
			};
		} catch (e) {
			release();
			throw e;
		}
	}
	async [Symbol.asyncDispose]() {
		if (this.primaryPhp) {
			this.primaryPhp.exit();
		}
		await Promise.all(
			this.allInstances.map((instance) =>
				instance.then(({ reap }) => reap())
			)
		);
	}
}
// ../../php-wasm/universal/src/lib/supported-php-versions.ts
var SupportedPHPVersions = [
	'8.3',
	'8.2',
	'8.1',
	'8.0',
	'7.4',
	'7.3',
	'7.2',
	'7.1',
	'7.0',
];
var LatestSupportedPHPVersion = SupportedPHPVersions[0];
// ../../php-wasm/universal/src/lib/urls.ts
function toRelativeUrl(url) {
	return url.toString().substring(url.origin.length);
}
function removePathPrefix(path, prefix) {
	if (!prefix || !path.startsWith(prefix)) {
		return path;
	}
	return path.substring(prefix.length);
}
function ensurePathPrefix(path, prefix) {
	if (!prefix || path.startsWith(prefix)) {
		return path;
	}
	return prefix + path;
}
var DEFAULT_BASE_URL = 'http://example.com';

// ../../php-wasm/universal/src/lib/encode-as-multipart.ts
async function encodeAsMultipart(data) {
	const boundary = `----${Math.random().toString(36).slice(2)}`;
	const contentType = `multipart/form-data; boundary=${boundary}`;
	const textEncoder = new TextEncoder();
	const parts = [];
	for (const [name, value] of Object.entries(data)) {
		parts.push(`--${boundary}\r\n`);
		parts.push(`Content-Disposition: form-data; name="${name}"`);
		if (value instanceof File) {
			parts.push(`; filename="${value.name}"`);
		}
		parts.push(`\r\n`);
		if (value instanceof File) {
			parts.push(`Content-Type: application/octet-stream`);
			parts.push(`\r\n`);
		}
		parts.push(`\r\n`);
		if (value instanceof File) {
			parts.push(await fileToUint8Array(value));
		} else {
			parts.push(value);
		}
		parts.push(`\r\n`);
	}
	parts.push(`--${boundary}--\r\n`);
	const length = parts.reduce((acc, part) => acc + part.length, 0);
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const part of parts) {
		bytes.set(
			typeof part === 'string' ? textEncoder.encode(part) : part,
			offset
		);
		offset += part.length;
	}
	return { bytes, contentType };
}
var fileToUint8Array = function (file) {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => {
			resolve(new Uint8Array(reader.result));
		};
		reader.readAsArrayBuffer(file);
	});
};
// ../../php-wasm/universal/src/lib/mime-types.json
var mime_types_default = {
	_default: 'application/octet-stream',
	'3gpp': 'video/3gpp',
	'7z': 'application/x-7z-compressed',
	asx: 'video/x-ms-asf',
	atom: 'application/atom+xml',
	avi: 'video/x-msvideo',
	avif: 'image/avif',
	bin: 'application/octet-stream',
	bmp: 'image/x-ms-bmp',
	cco: 'application/x-cocoa',
	css: 'text/css',
	data: 'application/octet-stream',
	deb: 'application/octet-stream',
	der: 'application/x-x509-ca-cert',
	dmg: 'application/octet-stream',
	doc: 'application/msword',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	eot: 'application/vnd.ms-fontobject',
	flv: 'video/x-flv',
	gif: 'image/gif',
	gz: 'application/gzip',
	hqx: 'application/mac-binhex40',
	htc: 'text/x-component',
	html: 'text/html',
	ico: 'image/x-icon',
	iso: 'application/octet-stream',
	jad: 'text/vnd.sun.j2me.app-descriptor',
	jar: 'application/java-archive',
	jardiff: 'application/x-java-archive-diff',
	jng: 'image/x-jng',
	jnlp: 'application/x-java-jnlp-file',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	js: 'application/javascript',
	json: 'application/json',
	kml: 'application/vnd.google-earth.kml+xml',
	kmz: 'application/vnd.google-earth.kmz',
	m3u8: 'application/vnd.apple.mpegurl',
	m4a: 'audio/x-m4a',
	m4v: 'video/x-m4v',
	md: 'text/plain',
	mid: 'audio/midi',
	mml: 'text/mathml',
	mng: 'video/x-mng',
	mov: 'video/quicktime',
	mp3: 'audio/mpeg',
	mp4: 'video/mp4',
	mpeg: 'video/mpeg',
	msi: 'application/octet-stream',
	odg: 'application/vnd.oasis.opendocument.graphics',
	odp: 'application/vnd.oasis.opendocument.presentation',
	ods: 'application/vnd.oasis.opendocument.spreadsheet',
	odt: 'application/vnd.oasis.opendocument.text',
	ogg: 'audio/ogg',
	otf: 'font/otf',
	pdf: 'application/pdf',
	pl: 'application/x-perl',
	png: 'image/png',
	ppt: 'application/vnd.ms-powerpoint',
	pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	prc: 'application/x-pilot',
	ps: 'application/postscript',
	ra: 'audio/x-realaudio',
	rar: 'application/x-rar-compressed',
	rpm: 'application/x-redhat-package-manager',
	rss: 'application/rss+xml',
	rtf: 'application/rtf',
	run: 'application/x-makeself',
	sea: 'application/x-sea',
	sit: 'application/x-stuffit',
	svg: 'image/svg+xml',
	swf: 'application/x-shockwave-flash',
	tcl: 'application/x-tcl',
	tar: 'application/x-tar',
	tif: 'image/tiff',
	ts: 'video/mp2t',
	ttf: 'font/ttf',
	txt: 'text/plain',
	wasm: 'application/wasm',
	wbmp: 'image/vnd.wap.wbmp',
	webm: 'video/webm',
	webp: 'image/webp',
	wml: 'text/vnd.wap.wml',
	wmlc: 'application/vnd.wap.wmlc',
	wmv: 'video/x-ms-wmv',
	woff: 'font/woff',
	woff2: 'font/woff2',
	xhtml: 'application/xhtml+xml',
	xls: 'application/vnd.ms-excel',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	xml: 'text/xml',
	xpi: 'application/x-xpinstall',
	xspf: 'application/xspf+xml',
	zip: 'application/zip',
};

// ../../php-wasm/universal/src/lib/php-request-handler.ts
var inferMimeType = function (path) {
	const extension = path.split('.').pop();
	return mime_types_default[extension] || mime_types_default['_default'];
};
function seemsLikeAPHPRequestHandlerPath(path) {
	return seemsLikeAPHPFile(path) || seemsLikeADirectoryRoot(path);
}
var seemsLikeAPHPFile = function (path) {
	return path.endsWith('.php') || path.includes('.php/');
};
var seemsLikeADirectoryRoot = function (path) {
	const lastSegment = path.split('/').pop();
	return !lastSegment.includes('.');
};
function applyRewriteRules(path, rules) {
	for (const rule of rules) {
		if (new RegExp(rule.match).test(path)) {
			return path.replace(rule.match, rule.replacement);
		}
	}
	return path;
}

class PHPRequestHandler {
	#DOCROOT;
	#PROTOCOL;
	#HOSTNAME;
	#PORT;
	#HOST;
	#PATHNAME;
	#ABSOLUTE_URL;
	#cookieStore;
	rewriteRules;
	processManager;
	constructor(config) {
		const {
			documentRoot = '/www/',
			absoluteUrl = typeof location === 'object' ? location?.href : '',
			rewriteRules = [],
		} = config;
		if ('processManager' in config) {
			this.processManager = config.processManager;
		} else {
			this.processManager = new PHPProcessManager({
				phpFactory: async (info) => {
					const php3 = await config.phpFactory({
						...info,
						requestHandler: this,
					});
					php3.requestHandler = this;
					return php3;
				},
				maxPhpInstances: config.maxPhpInstances,
			});
		}
		this.#cookieStore = new HttpCookieStore();
		this.#DOCROOT = documentRoot;
		const url = new URL(absoluteUrl);
		this.#HOSTNAME = url.hostname;
		this.#PORT = url.port
			? Number(url.port)
			: url.protocol === 'https:'
			? 443
			: 80;
		this.#PROTOCOL = (url.protocol || '').replace(':', '');
		const isNonStandardPort = this.#PORT !== 443 && this.#PORT !== 80;
		this.#HOST = [
			this.#HOSTNAME,
			isNonStandardPort ? `:${this.#PORT}` : '',
		].join('');
		this.#PATHNAME = url.pathname.replace(/\/+$/, '');
		this.#ABSOLUTE_URL = [
			`${this.#PROTOCOL}://`,
			this.#HOST,
			this.#PATHNAME,
		].join('');
		this.rewriteRules = rewriteRules;
	}
	async getPrimaryPhp() {
		return await this.processManager.getPrimaryPhp();
	}
	pathToInternalUrl(path) {
		return `${this.absoluteUrl}${path}`;
	}
	internalUrlToPath(internalUrl) {
		const url = new URL(internalUrl);
		if (url.pathname.startsWith(this.#PATHNAME)) {
			url.pathname = url.pathname.slice(this.#PATHNAME.length);
		}
		return toRelativeUrl(url);
	}
	get absoluteUrl() {
		return this.#ABSOLUTE_URL;
	}
	get documentRoot() {
		return this.#DOCROOT;
	}
	async request(request) {
		const isAbsolute =
			request.url.startsWith('http://') ||
			request.url.startsWith('https://');
		const requestedUrl = new URL(
			request.url.split('#')[0],
			isAbsolute ? undefined : DEFAULT_BASE_URL
		);
		const normalizedRequestedPath = applyRewriteRules(
			removePathPrefix(
				decodeURIComponent(requestedUrl.pathname),
				this.#PATHNAME
			),
			this.rewriteRules
		);
		const fsPath = joinPaths(this.#DOCROOT, normalizedRequestedPath);
		if (!seemsLikeAPHPRequestHandlerPath(fsPath)) {
			return this.#serveStaticFile(
				await this.processManager.getPrimaryPhp(),
				fsPath
			);
		}
		return this.#spawnPHPAndDispatchRequest(request, requestedUrl);
	}
	#serveStaticFile(php3, fsPath) {
		if (!php3.fileExists(fsPath)) {
			return new PHPResponse(
				404,
				{
					'x-file-type': ['static'],
				},
				new TextEncoder().encode('404 File not found')
			);
		}
		const arrayBuffer = php3.readFileAsBuffer(fsPath);
		return new PHPResponse(
			200,
			{
				'content-length': [`${arrayBuffer.byteLength}`],
				'content-type': [inferMimeType(fsPath)],
				'accept-ranges': ['bytes'],
				'cache-control': ['public, max-age=0'],
			},
			arrayBuffer
		);
	}
	async #spawnPHPAndDispatchRequest(request, requestedUrl) {
		let spawnedPHP = undefined;
		try {
			spawnedPHP = await this.processManager.acquirePHPInstance();
		} catch (e) {
			if (e instanceof MaxPhpInstancesError) {
				return PHPResponse.forHttpCode(502);
			} else {
				return PHPResponse.forHttpCode(500);
			}
		}
		try {
			return await this.#dispatchToPHP(
				spawnedPHP.php,
				request,
				requestedUrl
			);
		} finally {
			spawnedPHP.reap();
		}
	}
	async #dispatchToPHP(php3, request, requestedUrl) {
		let preferredMethod = 'GET';
		const headers = {
			host: this.#HOST,
			...normalizeHeaders(request.headers || {}),
			cookie: this.#cookieStore.getCookieRequestHeader(),
		};
		let body = request.body;
		if (typeof body === 'object' && !(body instanceof Uint8Array)) {
			preferredMethod = 'POST';
			const { bytes, contentType } = await encodeAsMultipart(body);
			body = bytes;
			headers['content-type'] = contentType;
		}
		let scriptPath;
		try {
			scriptPath = this.#resolvePHPFilePath(
				php3,
				decodeURIComponent(requestedUrl.pathname)
			);
		} catch (error) {
			return PHPResponse.forHttpCode(404);
		}
		try {
			const response = await php3.run({
				relativeUri: ensurePathPrefix(
					toRelativeUrl(requestedUrl),
					this.#PATHNAME
				),
				protocol: this.#PROTOCOL,
				method: request.method || preferredMethod,
				$_SERVER: {
					REMOTE_ADDR: '127.0.0.1',
					DOCUMENT_ROOT: this.#DOCROOT,
					HTTPS: this.#ABSOLUTE_URL.startsWith('https://')
						? 'on'
						: '',
				},
				body,
				scriptPath,
				headers,
			});
			this.#cookieStore.rememberCookiesFromResponseHeaders(
				response.headers
			);
			return response;
		} catch (error) {
			const executionError = error;
			if (executionError?.response) {
				return executionError.response;
			}
			throw error;
		}
	}
	#resolvePHPFilePath(php3, requestedPath) {
		let filePath = removePathPrefix(requestedPath, this.#PATHNAME);
		filePath = applyRewriteRules(filePath, this.rewriteRules);
		if (filePath.includes('.php')) {
			filePath = filePath.split('.php')[0] + '.php';
		} else if (php3.isDir(`${this.#DOCROOT}${filePath}`)) {
			if (!filePath.endsWith('/')) {
				filePath = `${filePath}/`;
			}
			filePath = `${filePath}index.php`;
		} else {
			filePath = '/index.php';
		}
		let resolvedFsPath = `${this.#DOCROOT}${filePath}`;
		if (!php3.fileExists(resolvedFsPath)) {
			resolvedFsPath = `${this.#DOCROOT}/index.php`;
		}
		if (php3.fileExists(resolvedFsPath)) {
			return resolvedFsPath;
		}
		throw new Error(`File not found: ${resolvedFsPath}`);
	}
}
// ../../php-wasm/universal/src/lib/rotate-php-runtime.ts
function rotatePHPRuntime({
	php: php3,
	cwd,
	recreateRuntime,
	maxRequests = 400,
}) {
	let handledCalls = 0;
	async function rotateRuntime() {
		if (++handledCalls < maxRequests) {
			return;
		}
		handledCalls = 0;
		const release = await php3.semaphore.acquire();
		try {
			php3.hotSwapPHPRuntime(await recreateRuntime(), cwd);
		} finally {
			release();
		}
	}
	php3.addEventListener('request.end', rotateRuntime);
	return function () {
		php3.removeEventListener('request.end', rotateRuntime);
	};
}
// ../../php-wasm/universal/src/lib/write-files.ts
async function writeFiles(php3, root, newFiles, { rmRoot = false } = {}) {
	if (rmRoot) {
		if (await php3.isDir(root)) {
			await php3.rmdir(root, { recursive: true });
		}
	}
	for (const [relativePath, content] of Object.entries(newFiles)) {
		const filePath = joinPaths(root, relativePath);
		if (!(await php3.fileExists(dirname(filePath)))) {
			await php3.mkdir(dirname(filePath));
		}
		if (content instanceof Uint8Array || typeof content === 'string') {
			await php3.writeFile(filePath, content);
		} else {
			await writeFiles(php3, filePath, content);
		}
	}
}
// ../../php-wasm/universal/src/lib/proxy-file-system.ts
function proxyFileSystem(sourceOfTruth, replica, paths) {
	const __private__symbol = Object.getOwnPropertySymbols(sourceOfTruth)[0];
	for (const path of paths) {
		if (!replica.fileExists(path)) {
			replica.mkdir(path);
		}
		if (!sourceOfTruth.fileExists(path)) {
			sourceOfTruth.mkdir(path);
		}
		replica[__private__symbol].FS.mount(
			replica[__private__symbol].PROXYFS,
			{
				root: path,
				fs: sourceOfTruth[__private__symbol].FS,
			},
			path
		);
	}
}
// ../wordpress/src/boot.ts
async function bootWordPress(options) {
	async function createPhp(requestHandler2, isPrimary) {
		const php4 = new PHP(await options.createPhpRuntime());
		if (options.sapiName) {
			php4.setSapiName(options.sapiName);
		}
		if (requestHandler2) {
			php4.requestHandler = requestHandler2;
		}
		if (options.phpIniEntries) {
			setPhpIniEntries(php4, options.phpIniEntries);
		}
		if (isPrimary) {
			await setupPlatformLevelMuPlugins(php4);
			await writeFiles(php4, '/', options.createFiles || {});
			await preloadPhpInfoRoute(
				php4,
				joinPaths(new URL(options.siteUrl).pathname, 'phpinfo.php')
			);
		} else {
			proxyFileSystem(await requestHandler2.getPrimaryPhp(), php4, [
				'/tmp',
				requestHandler2.documentRoot,
				'/internal/shared',
			]);
		}
		if (options.spawnHandler) {
			await php4.setSpawnHandler(
				options.spawnHandler(requestHandler2.processManager)
			);
		}
		rotatePHPRuntime({
			php: php4,
			cwd: requestHandler2.documentRoot,
			recreateRuntime: options.createPhpRuntime,
			maxRequests: 400,
		});
		return php4;
	}
	const requestHandler = new PHPRequestHandler({
		phpFactory: async ({ isPrimary }) =>
			createPhp(requestHandler, isPrimary),
		documentRoot: options.documentRoot || '/wordpress',
		absoluteUrl: options.siteUrl,
		rewriteRules: wordPressRewriteRules,
	});
	const php3 = await requestHandler.getPrimaryPhp();
	if (options.hooks?.beforeWordPressFiles) {
		await options.hooks.beforeWordPressFiles(php3);
	}
	if (options.wordPressZip) {
		await unzipWordPress(php3, await options.wordPressZip);
	}
	if (options.constants) {
		for (const key in options.constants) {
			php3.defineConstant(key, options.constants[key]);
		}
	}
	php3.defineConstant('WP_HOME', options.siteUrl);
	php3.defineConstant('WP_SITEURL', options.siteUrl);
	if (options.hooks?.beforeDatabaseSetup) {
		await options.hooks.beforeDatabaseSetup(php3);
	}
	if (options.sqliteIntegrationPluginZip) {
		await preloadSqliteIntegration(
			php3,
			await options.sqliteIntegrationPluginZip
		);
	}
	if (!(await isWordPressInstalled(php3))) {
		await installWordPress(php3);
	}
	if (!(await isWordPressInstalled(php3))) {
		throw new Error('WordPress installation has failed.');
	}
	return requestHandler;
}
async function isWordPressInstalled(php3) {
	return (
		(
			await php3.run({
				code: `<?php 
	require '${php3.documentRoot}/wp-load.php';
	echo is_blog_installed() ? '1' : '0';
	`,
			})
		).text === '1'
	);
}
async function installWordPress(php3) {
	await withPHPIniValues(
		php3,
		{
			disable_functions: 'fsockopen',
			allow_url_fopen: '0',
		},
		async () =>
			await php3.request({
				url: '/wp-admin/install.php?step=2',
				method: 'POST',
				body: {
					language: 'en',
					prefix: 'wp_',
					weblog_title: 'My WordPress Website',
					user_name: 'admin',
					admin_password: 'password',
					admin_password2: 'password',
					Submit: 'Install WordPress',
					pw_weak: '1',
					admin_email: 'admin@localhost.com',
				},
			})
	);
}
// ../wordpress/src/rewrite-rules.ts
var wordPressRewriteRules = [
	{
		match: /^\/(.*?)(\/wp-(content|admin|includes)\/.*)/g,
		replacement: '$2',
	},
];

// ../wordpress/src/index.ts
async function setupPlatformLevelMuPlugins(php3) {
	await php3.mkdir('/internal/shared/mu-plugins');
	await php3.writeFile(
		'/internal/shared/preload/env.php',
		`<?php
    
        // Allow adding filters/actions prior to loading WordPress.
        // \$function_to_add MUST be a string.
        function playground_add_filter( \$tag, \$function_to_add, \$priority = 10, \$accepted_args = 1 ) {
            global \$wp_filter;
            \$wp_filter[\$tag][\$priority][\$function_to_add] = array('function' => \$function_to_add, 'accepted_args' => \$accepted_args);
        }
        function playground_add_action( \$tag, \$function_to_add, \$priority = 10, \$accepted_args = 1 ) {
            playground_add_filter( \$tag, \$function_to_add, \$priority, \$accepted_args );
        }
        
        // Load our mu-plugins after customer mu-plugins
        // NOTE: this means our mu-plugins can't use the muplugins_loaded action!
        playground_add_action( 'muplugins_loaded', 'playground_load_mu_plugins', 0 );
        function playground_load_mu_plugins() {
            // Load all PHP files from /internal/shared/mu-plugins, sorted by filename
            \$mu_plugins_dir = '/internal/shared/mu-plugins';
            if(!is_dir(\$mu_plugins_dir)){
                return;
            }
            \$mu_plugins = glob( \$mu_plugins_dir . '/*.php' );
            sort( \$mu_plugins );
            foreach ( \$mu_plugins as \$mu_plugin ) {
                require_once \$mu_plugin;
            }
        }
    `
	);
	await php3.writeFile(
		'/internal/shared/mu-plugins/0-playground.php',
		`<?php
        // Redirect /wp-admin to /wp-admin/
        add_filter( 'redirect_canonical', function( \$redirect_url ) {
            if ( '/wp-admin' === \$redirect_url ) {
                return \$redirect_url . '/';
            }
            return \$redirect_url;
        } );
		
        // Needed because gethostbyname( 'wordpress.org' ) returns
        // a private network IP address for some reason.
        add_filter( 'allowed_redirect_hosts', function( \$deprecated = '' ) {
            return array(
                'wordpress.org',
                'api.wordpress.org',
                'downloads.wordpress.org',
            );
        } );

		// Support pretty permalinks
        add_filter( 'got_url_rewrite', '__return_true' );

        // Create the fonts directory if missing
        if(!file_exists(WP_CONTENT_DIR . '/fonts')) {
            mkdir(WP_CONTENT_DIR . '/fonts');
        }
		
        \$log_file = WP_CONTENT_DIR . '/debug.log';
        define('ERROR_LOG_FILE', \$log_file);
        ini_set('error_log', \$log_file);
        ?>`
	);
	await php3.writeFile(
		'/internal/shared/preload/error-handler.php',
		`<?php
		(function() { 
			\$playground_consts = [];
			if(file_exists('/internal/shared/consts.json')) {
				\$playground_consts = @json_decode(file_get_contents('/internal/shared/consts.json'), true) ?: [];
				\$playground_consts = array_keys(\$playground_consts);
			}
			set_error_handler(function(\$severity, \$message, \$file, \$line) use(\$playground_consts) {
				/**
				 * This is a temporary workaround to hide the 32bit integer warnings that
				 * appear when using various time related function, such as strtotime and mktime.
				 * Examples of the warnings that are displayed:
				 *
				 * Warning: mktime(): Epoch doesn't fit in a PHP integer in <file>
				 * Warning: strtotime(): Epoch doesn't fit in a PHP integer in <file>
				 */
				if (strpos(\$message, "fit in a PHP integer") !== false) {
					return;
				}
				/**
				 * Playground defines some constants upfront, and some of them may be redefined
				 * in wp-config.php. For example, SITE_URL or WP_DEBUG. This is expected and
				 * we want Playground constants to take priority without showing warnings like:
				 *
				 * Warning: Constant SITE_URL already defined in
				 */
				if (strpos(\$message, "already defined") !== false) {
					foreach(\$playground_consts as \$const) {
						if(strpos(\$message, "Constant \$const already defined") !== false) {
							return;
						}
					}
				}
				/**
				 * Don't complain about network errors when not connected to the network.
				 */
				if (
					(
						! defined('USE_FETCH_FOR_REQUESTS') ||
						! USE_FETCH_FOR_REQUESTS
					) &&
					strpos(\$message, "WordPress could not establish a secure connection to WordPress.org") !== false)
				{
					return;
				}
				return false;
			});
		})();`
	);
}
async function preloadPhpInfoRoute(php3, requestPath = '/phpinfo.php') {
	await php3.writeFile(
		'/internal/shared/preload/phpinfo.php',
		`<?php
    // Render PHPInfo if the requested page is /phpinfo.php
    if ( ${phpVar(requestPath)} === \$_SERVER['REQUEST_URI'] ) {
        phpinfo();
        exit;
    }
    `
	);
}
async function preloadSqliteIntegration(php3, sqliteZip) {
	if (await php3.isDir('/tmp/sqlite-database-integration')) {
		await php3.rmdir('/tmp/sqlite-database-integration', {
			recursive: true,
		});
	}
	await php3.mkdir('/tmp/sqlite-database-integration');
	await unzipFile(php3, sqliteZip, '/tmp/sqlite-database-integration');
	const SQLITE_PLUGIN_FOLDER = '/internal/shared/sqlite-database-integration';
	await php3.mv(
		'/tmp/sqlite-database-integration/sqlite-database-integration-main',
		SQLITE_PLUGIN_FOLDER
	);
	await php3.defineConstant('SQLITE_MAIN_FILE', '1');
	const dbCopy = await php3.readFileAsText(
		joinPaths(SQLITE_PLUGIN_FOLDER, 'db.copy')
	);
	const dbPhp = dbCopy
		.replace(
			"'{SQLITE_IMPLEMENTATION_FOLDER_PATH}'",
			phpVar(SQLITE_PLUGIN_FOLDER)
		)
		.replace(
			"'{SQLITE_PLUGIN}'",
			phpVar(joinPaths(SQLITE_PLUGIN_FOLDER, 'load.php'))
		);
	const dbPhpPath = joinPaths(await php3.documentRoot, 'wp-content/db.php');
	const stopIfDbPhpExists = `<?php
	// Do not preload this if WordPress comes with a custom db.php file.
	if(file_exists(${phpVar(dbPhpPath)})) {
		return;
	}
	?>`;
	const SQLITE_MUPLUGIN_PATH =
		'/internal/shared/mu-plugins/sqlite-database-integration.php';
	await php3.writeFile(SQLITE_MUPLUGIN_PATH, stopIfDbPhpExists + dbPhp);
	await php3.writeFile(
		`/internal/shared/preload/0-sqlite.php`,
		stopIfDbPhpExists +
			`<?php

/**
 * Loads the SQLite integration plugin before WordPress is loaded
 * and without creating a drop-in "db.php" file. 
 *
 * Technically, it creates a global $wpdb object whose only two
 * purposes are to:
 *
 * * Exist \u2013 because the require_wp_db() WordPress function won't
 *           connect to MySQL if $wpdb is already set.
 * * Load the SQLite integration plugin the first time it's used
 *   and replace the global $wpdb reference with the SQLite one.
 *
 * This lets Playground keep the WordPress installation clean and
 * solves dillemas like:
 *
 * * Should we include db.php in Playground exports?
 * * Should we remove db.php from Playground imports?
 * * How should we treat stale db.php from long-lived OPFS sites?
 *
 * @see https://github.com/WordPress/wordpress-playground/discussions/1379 for
 *      more context.
 */
class Playground_SQLite_Integration_Loader {
	public function __call($name, $arguments) {
		$this->load_sqlite_integration();
		if($GLOBALS['wpdb'] === $this) {
			throw new Exception('Infinite loop detected in $wpdb \u2013 SQLite integration plugin could not be loaded');
		}
		return call_user_func_array(
			array($GLOBALS['wpdb'], $name),
			$arguments
		);
	}
	public function __get($name) {
		$this->load_sqlite_integration();
		if($GLOBALS['wpdb'] === $this) {
			throw new Exception('Infinite loop detected in $wpdb \u2013 SQLite integration plugin could not be loaded');
		}
		return $GLOBALS['wpdb']->$name;
	}
	public function __set($name, $value) {
		$this->load_sqlite_integration();
		if($GLOBALS['wpdb'] === $this) {
			throw new Exception('Infinite loop detected in $wpdb \u2013 SQLite integration plugin could not be loaded');
		}
		$GLOBALS['wpdb']->$name = $value;
	}
    protected function load_sqlite_integration() {
        require_once ${phpVar(SQLITE_MUPLUGIN_PATH)};
    }
}
\$wpdb = \$GLOBALS['wpdb'] = new Playground_SQLite_Integration_Loader();

/**
 * WordPress is capable of using a preloaded global \$wpdb. However, if
 * it cannot find the drop-in db.php plugin it still checks whether
 * the mysqli_connect() function exists even though it's not used.
 *
 * What WordPress demands, Playground shall provide.
 */
if(!function_exists('mysqli_connect')) {
	function mysqli_connect() {}
}

		`
	);
	await php3.writeFile(
		`/internal/shared/mu-plugins/sqlite-test.php`,
		`<?php
		global \$wpdb;
		if(!(\$wpdb instanceof WP_SQLite_DB)) {
			var_dump(isset(\$wpdb));
			die("SQLite integration not loaded " . get_class(\$wpdb));
		}
		`
	);
}
async function unzipWordPress(php3, wpZip) {
	php3.mkdir('/tmp/unzipped-wordpress');
	await unzipFile(php3, wpZip, '/tmp/unzipped-wordpress');
	if (php3.fileExists('/tmp/unzipped-wordpress/wordpress.zip')) {
		await unzipFile(
			php3,
			'/tmp/unzipped-wordpress/wordpress.zip',
			'/tmp/unzipped-wordpress'
		);
	}
	const wpPath = php3.fileExists('/tmp/unzipped-wordpress/wordpress')
		? '/tmp/unzipped-wordpress/wordpress'
		: php3.fileExists('/tmp/unzipped-wordpress/build')
		? '/tmp/unzipped-wordpress/build'
		: '/tmp/unzipped-wordpress';
	php3.mv(wpPath, php3.documentRoot);
	if (
		!php3.fileExists(joinPaths(php3.documentRoot, 'wp-config.php')) &&
		php3.fileExists(joinPaths(php3.documentRoot, 'wp-config-sample.php'))
	) {
		php3.writeFile(
			joinPaths(php3.documentRoot, 'wp-config.php'),
			php3.readFileAsText(
				joinPaths(php3.documentRoot, '/wp-config-sample.php')
			)
		);
	}
}

// src/messaging.ts
var uint8ArrayToBase64 = (bytes) => {
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
};
var base64ToUint8Array = (base64) => {
	const byteCharacters = atob(base64);
	const byteNumbers = new Array(byteCharacters.length);
	for (let i = 0; i < byteCharacters.length; i++) {
		byteNumbers[i] = byteCharacters.charCodeAt(i);
	}
	return new Uint8Array(byteNumbers);
};
var listenForPhpRequests = (callback) => {
	chrome.runtime.onMessage.addListener(
		async (message, sender, sendResponse) => {
			if (message.type === 'PLAYGROUND_REQUEST') {
				const decodedRequest = { ...message.request };
				if (
					decodedRequest.body &&
					typeof decodedRequest.body === 'string'
				) {
					decodedRequest.body = base64ToUint8Array(
						decodedRequest.body
					);
				}
				const response = await callback(decodedRequest);
				const encodedResponse = {
					headers: response.headers,
					httpStatusCode: response.httpStatusCode,
					errors: response.errors,
					bytes: uint8ArrayToBase64(new Uint8Array(response.bytes)),
				};
				sendResponse(encodedResponse);
			}
		}
	);
};

// src/playground-loader.ts
async function bootWorker() {
	const [wordPressZip, sqliteIntegrationPluginZip] = await Promise.all([
		readFileFromCurrentExtension('wordpress-6.5.4.zip'),
		readFileFromCurrentExtension('sqlite-database-integration.zip'),
	]);
	const requestHandler = await bootWordPress({
		siteUrl: 'http://playground.internal',
		createPhpRuntime: async () => {
			const phpModule = await import('./php_8_0.js');
			return await loadPHPRuntime(phpModule, {
				...fakeWebsocket(),
			});
		},
		wordPressZip,
		sqliteIntegrationPluginZip,
		sapiName: 'cli',
		phpIniEntries: {
			allow_url_fopen: '0',
			disable_functions: '',
		},
	});
	const primaryPHP = await requestHandler.getPrimaryPhp();
	return requestHandler;
}
async function readFileFromCurrentExtension(path) {
	const response = await fetch(path);
	return new File([await response.blob()], path);
}
var requestHandler = bootWorker();
listenForPhpRequests(async (request) => {
	const handler2 = await requestHandler;
	console.log({
		'handling a request': request,
	});
	request.headers = {
		...(request.headers || {}),
		Host: 'playground.internal',
		Origin: 'http://playground.internal',
		Referer: 'http://playground.internal',
	};
	const response = await handler2.request(request);
	const newHeaders = {};
	for (const [key, value] of Object.entries(response.headers)) {
		newHeaders[key.toLowerCase()] = value.map((v) =>
			v.replace('http://playground.internal', chrome.runtime.getURL(''))
		);
	}
	console.log({
		'Got a response': response,
		newHeaders,
	});
	return {
		...response,
		headers: newHeaders,
		bytes: new TextEncoder().encode(
			response.text.replaceAll(
				'http://playground.internal',
				chrome.runtime.getURL('')
			)
		),
	};
});
var fakeWebsocket = () => {
	return {
		websocket: {
			decorator: (WebSocketConstructor) => {
				return class FakeWebsocketConstructor extends WebSocketConstructor {
					constructor() {
						try {
							super();
						} catch (e) {}
					}
					send() {
						return null;
					}
				};
			},
		},
	};
};
