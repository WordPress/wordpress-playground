/* eslint-disable @typescript-eslint/no-misused-new */
/* eslint-disable @typescript-eslint/no-namespace */
/** Other WebAssembly declarations, for compatibility with older versions of Typescript */

export namespace Emscripten {
	export interface RootFS extends Emscripten.FileSystemInstance {
		filesystems: Record<string, Emscripten.FileSystemType>;
	}
	export interface FileSystemType {
		mount(mount: FS.Mount): FS.FSNode;
		syncfs(
			mount: FS.Mount,
			populate: () => unknown,
			done: (err?: number | null) => unknown
		): void;
	}
	export type EnvironmentType = 'WEB' | 'NODE' | 'SHELL' | 'WORKER';

	export type JSType = 'number' | 'string' | 'array' | 'boolean';
	export type TypeCompatibleWithC = number | string | any[] | boolean;

	export type CIntType = 'i8' | 'i16' | 'i32' | 'i64';
	export type CFloatType = 'float' | 'double';
	export type CPointerType =
		| 'i8*'
		| 'i16*'
		| 'i32*'
		| 'i64*'
		| 'float*'
		| 'double*'
		| '*';
	export type CType = CIntType | CFloatType | CPointerType;

	export interface CCallOpts {
		async?: boolean | undefined;
	}

	type NamespaceToInstance<T> = {
		[K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : never;
	};

	export type FileSystemInstance = NamespaceToInstance<typeof FS> & {
		mkdirTree(path: string): void;
		lookupPath(path: string, opts?: any): FS.Lookup;
	};

	export interface EmscriptenModule {
		print(str: string): void;
		printErr(str: string): void;
		arguments: string[];
		environment: Emscripten.EnvironmentType;
		preInit: Array<{ (): void }>;
		preRun: Array<{ (): void }>;
		postRun: Array<{ (): void }>;
		onAbort: { (what: any): void };
		onRuntimeInitialized: { (): void };
		preinitializedWebGLContext: WebGLRenderingContext;
		noInitialRun: boolean;
		noExitRuntime: boolean;
		logReadFiles: boolean;
		filePackagePrefixURL: string;
		wasmBinary: ArrayBuffer;

		destroy(object: object): void;
		getPreloadedPackage(
			remotePackageName: string,
			remotePackageSize: number
		): ArrayBuffer;
		instantiateWasm(
			imports: WebAssembly.Imports,
			successCallback: (module: WebAssembly.Instance) => void
		): WebAssembly.Exports | undefined;
		locateFile(url: string, scriptDirectory: string): string;
		onCustomMessage(event: MessageEvent): void;

		// USE_TYPED_ARRAYS == 1
		HEAP: Int32Array;
		IHEAP: Int32Array;
		FHEAP: Float64Array;

		// USE_TYPED_ARRAYS == 2
		HEAP8: Int8Array;
		HEAP16: Int16Array;
		HEAP32: Int32Array;
		HEAPU8: Uint8Array;
		HEAPU16: Uint16Array;
		HEAPU32: Uint32Array;
		HEAPF32: Float32Array;
		HEAPF64: Float64Array;
		HEAP64: BigInt64Array;
		HEAPU64: BigUint64Array;

		TOTAL_STACK: number;
		TOTAL_MEMORY: number;
		FAST_MEMORY: number;

		addOnPreRun(cb: () => any): void;
		addOnInit(cb: () => any): void;
		addOnPreMain(cb: () => any): void;
		addOnExit(cb: () => any): void;
		addOnPostRun(cb: () => any): void;

		preloadedImages: any;
		preloadedAudios: any;

		_malloc(size: number): number;
		_free(ptr: number): void;
	}

	/**
	 * A factory function is generated when setting the `MODULARIZE` build option
	 * to `1` in your Emscripten build. It return a Promise that resolves to an
	 * initialized, ready-to-call `EmscriptenModule` instance.
	 *
	 * By default, the factory function will be named `Module`. It's recommended to
	 * use the `EXPORT_ES6` option, in which the factory function will be the
	 * default export. If used without `EXPORT_ES6`, the factory function will be a
	 * global variable. You can rename the variable using the `EXPORT_NAME` build
	 * option. It's left to you to export any global variables as needed in your
	 * application's types.
	 * @param moduleOverrides Default properties for the initialized module.
	 */
	export type EmscriptenModuleFactory<
		T extends EmscriptenModule = EmscriptenModule
	> = (moduleOverrides?: Partial<T>) => Promise<T>;

	export namespace FS {
		export interface Lookup {
			path: string;
			node: FSNode;
		}

		export interface Analyze {
			isRoot: boolean;
			exists: boolean;
			error: Error;
			name: string;
			path: Lookup['path'];
			object: Lookup['node'];
			parentExists: boolean;
			parentPath: Lookup['path'];
			parentObject: Lookup['node'];
		}

		export interface Mount {
			type: Emscripten.FileSystemType;
			opts: object;
			mountpoint: string;
			mounts: Mount[];
			root: FSNode;
		}

		export declare class FSStream {
			constructor();
			object: FSNode;
			readonly isRead: boolean;
			readonly isWrite: boolean;
			readonly isAppend: boolean;
			flags: number;
			position: number;
		}

		export declare class FSNode {
			parent: FSNode;
			mount: Mount;
			mounted?: Mount;
			id: number;
			name: string;
			mode: number;
			rdev: number;
			readMode: number;
			writeMode: number;
			constructor(
				parent: FSNode,
				name: string,
				mode: number,
				rdev: number
			);
			read: boolean;
			write: boolean;
			readonly isFolder: boolean;
			readonly isDevice: boolean;
		}

		export interface ErrnoError extends Error {
			name: 'ErronoError';
			errno: number;
			code: string;
		}

		//
		// paths
		//
		export declare function lookupPath(path: string, opts: any): Lookup;
		export declare function getPath(node: FSNode): string;
		export declare function analyzePath(
			path: string,
			dontResolveLastLink?: boolean
		): Analyze;

		//
		// nodes
		//
		export declare function isFile(mode: number): boolean;
		export declare function isDir(mode: number): boolean;
		export declare function isLink(mode: number): boolean;
		export declare function isChrdev(mode: number): boolean;
		export declare function isBlkdev(mode: number): boolean;
		export declare function isFIFO(mode: number): boolean;
		export declare function isSocket(mode: number): boolean;

		//
		// devices
		//
		export declare function major(dev: number): number;
		export declare function minor(dev: number): number;
		export declare function makedev(ma: number, mi: number): number;
		export declare function registerDevice(dev: number, ops: any): void;

		//
		// core
		//
		export declare function syncfs(
			populate: boolean,
			callback: (e: any) => any
		): void;
		export declare function syncfs(
			callback: (e: any) => any,
			populate?: boolean
		): void;
		export declare function mount(
			type: Emscripten.FileSystemType,
			opts: any,
			mountpoint: string
		): any;
		export declare function unmount(mountpoint: string): void;

		export declare function mkdir(path: string, mode?: number): any;
		export declare function mkdev(
			path: string,
			mode?: number,
			dev?: number
		): any;
		export declare function symlink(oldpath: string, newpath: string): any;
		export declare function rename(
			old_path: string,
			new_path: string
		): void;
		export declare function rmdir(path: string): void;
		export declare function readdir(path: string): any;
		export declare function unlink(path: string): void;
		export declare function readlink(path: string): string;
		export declare function stat(path: string, dontFollow?: boolean): any;
		export declare function lstat(path: string): any;
		export declare function chmod(
			path: string,
			mode: number,
			dontFollow?: boolean
		): void;
		export declare function lchmod(path: string, mode: number): void;
		export declare function fchmod(fd: number, mode: number): void;
		export declare function chown(
			path: string,
			uid: number,
			gid: number,
			dontFollow?: boolean
		): void;
		export declare function lchown(
			path: string,
			uid: number,
			gid: number
		): void;
		export declare function fchown(
			fd: number,
			uid: number,
			gid: number
		): void;
		export declare function truncate(path: string, len: number): void;
		export declare function ftruncate(fd: number, len: number): void;
		export declare function utime(
			path: string,
			atime: number,
			mtime: number
		): void;
		export declare function open(
			path: string,
			flags: string,
			mode?: number,
			fd_start?: number,
			fd_end?: number
		): FSStream;
		export declare function close(stream: FSStream): void;
		export declare function llseek(
			stream: FSStream,
			offset: number,
			whence: number
		): any;
		export declare function read(
			stream: FSStream,
			buffer: ArrayBufferView,
			offset: number,
			length: number,
			position?: number
		): number;
		export declare function write(
			stream: FSStream,
			buffer: ArrayBufferView,
			offset: number,
			length: number,
			position?: number,
			canOwn?: boolean
		): number;
		export declare function allocate(
			stream: FSStream,
			offset: number,
			length: number
		): void;
		export declare function mmap(
			stream: FSStream,
			buffer: ArrayBufferView,
			offset: number,
			length: number,
			position: number,
			prot: number,
			flags: number
		): any;
		export declare function ioctl(
			stream: FSStream,
			cmd: any,
			arg: any
		): any;
		export declare function readFile(
			path: string,
			opts: { encoding: 'binary'; flags?: string | undefined }
		): Uint8Array;
		export declare function readFile(
			path: string,
			opts: { encoding: 'utf8'; flags?: string | undefined }
		): string;
		export declare function readFile(
			path: string,
			opts?: { flags?: string | undefined }
		): Uint8Array;
		export declare function writeFile(
			path: string,
			data: string | ArrayBufferView,
			opts?: { flags?: string | undefined }
		): void;

		//
		// module-level FS code
		//
		export declare function cwd(): string;
		export declare function chdir(path: string): void;
		export declare function init(
			input: null | (() => number | null),
			output: null | ((c: number) => any),
			error: null | ((c: number) => any)
		): void;

		export declare function createLazyFile(
			parent: string | FSNode,
			name: string,
			url: string,
			canRead: boolean,
			canWrite: boolean
		): FSNode;
		export declare function createPreloadedFile(
			parent: string | FSNode,
			name: string,
			url: string,
			canRead: boolean,
			canWrite: boolean,
			onload?: () => void,
			onerror?: () => void,
			dontCreateFile?: boolean,
			canOwn?: boolean
		): void;
		export declare function createDataFile(
			parent: string | FSNode,
			name: string,
			data: ArrayBufferView,
			canRead: boolean,
			canWrite: boolean,
			canOwn: boolean
		): FSNode;
	}

	export declare const MEMFS: Emscripten.FileSystemType;
	export declare const NODEFS: Emscripten.FileSystemType;
	export declare const IDBFS: Emscripten.FileSystemType;

	// https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html
	type StringToType<R> = R extends Emscripten.JSType
		? {
				number: number;
				string: string;
				array: number[] | string[] | boolean[] | Uint8Array | Int8Array;
				boolean: boolean;
				null: null;
		  }[R]
		: never;

	type ArgsToType<T extends Array<Emscripten.JSType | null>> = Extract<
		{
			[P in keyof T]: StringToType<T[P]>;
		},
		any[]
	>;

	type ReturnToType<R extends Emscripten.JSType | null> = R extends null
		? null
		: StringToType<Exclude<R, null>>;

	// Below runtime function/variable declarations are exportable by
	// -s EXPORTED_RUNTIME_METHODS. You can extend or merge
	// EmscriptenModule export interface to add runtime functions.
	//
	// For example, by using -s "EXPORTED_RUNTIME_METHODS=['ccall']"
	// You can access ccall() via Module["ccall"]. In this case, you should
	// extend EmscriptenModule to pass the compiler check like the following:
	//
	// export interface YourOwnEmscriptenModule extends EmscriptenModule {
	//     ccall: typeof ccall;
	// }
	//
	// See: https://emscripten.org/docs/getting_started/FAQ.html#why-do-i-get-typeerror-module-something-is-not-a-function

	export declare function cwrap<
		I extends Array<Emscripten.JSType | null> | [],
		R extends Emscripten.JSType | null
	>(
		ident: string,
		returnType: R,
		argTypes: I,
		opts?: Emscripten.CCallOpts
	): (...arg: ArgsToType<I>) => ReturnToType<R>;

	export declare function ccall<
		I extends Array<Emscripten.JSType | null> | [],
		R extends Emscripten.JSType | null
	>(
		ident: string,
		returnType: R,
		argTypes: I,
		args: ArgsToType<I>,
		opts?: Emscripten.CCallOpts
	): ReturnToType<R>;

	export declare function setValue(
		ptr: number,
		value: any,
		type: Emscripten.CType,
		noSafe?: boolean
	): void;
	export declare function getValue(
		ptr: number,
		type: Emscripten.CType,
		noSafe?: boolean
	): number;

	export declare function allocate(
		slab: number[] | ArrayBufferView | number,
		types: Emscripten.CType | Emscripten.CType[],
		allocator: number,
		ptr?: number
	): number;

	export declare function stackAlloc(size: number): number;
	export declare function stackSave(): number;
	export declare function stackRestore(ptr: number): void;

	export declare function UTF8ToString(
		ptr: number,
		maxBytesToRead?: number
	): string;
	export declare function stringToUTF8(
		str: string,
		outPtr: number,
		maxBytesToRead?: number
	): void;
	export declare function lengthBytesUTF8(str: string): number;
	export declare function allocateUTF8(str: string): number;
	export declare function allocateUTF8OnStack(str: string): number;
	export declare function UTF16ToString(ptr: number): string;
	export declare function stringToUTF16(
		str: string,
		outPtr: number,
		maxBytesToRead?: number
	): void;
	export declare function lengthBytesUTF16(str: string): number;
	export declare function UTF32ToString(ptr: number): string;
	export declare function stringToUTF32(
		str: string,
		outPtr: number,
		maxBytesToRead?: number
	): void;
	export declare function lengthBytesUTF32(str: string): number;

	export declare function intArrayFromString(
		stringy: string,
		dontAddNull?: boolean,
		length?: number
	): number[];
	export declare function intArrayToString(array: number[]): string;
	export declare function writeStringToMemory(
		str: string,
		buffer: number,
		dontAddNull: boolean
	): void;
	export declare function writeArrayToMemory(
		array: number[],
		buffer: number
	): void;
	export declare function writeAsciiToMemory(
		str: string,
		buffer: number,
		dontAddNull: boolean
	): void;

	export declare function addRunDependency(id: any): void;
	export declare function removeRunDependency(id: any): void;

	export declare function addFunction(
		func: (...args: any[]) => any,
		signature?: string
	): number;
	export declare function removeFunction(funcPtr: number): void;

	export declare const ALLOC_NORMAL: number;
	export declare const ALLOC_STACK: number;
	export declare const ALLOC_STATIC: number;
	export declare const ALLOC_DYNAMIC: number;
	export declare const ALLOC_NONE: number;
}
