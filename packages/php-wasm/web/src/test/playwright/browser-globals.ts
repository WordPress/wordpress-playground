import {
	FileLockManagerInMemory,
	PHP,
	PHPRequestHandler,
	ProcessIdAllocator,
	proxyFileSystem,
	setPhpIniEntries,
} from '@php-wasm/universal';
import {
	certificateToPEM,
	generateCertificate,
	loadWebRuntime,
} from '../../lib';
import {
	bindUserSpace,
	type WasmUserSpaceContext,
} from '../../lib/wasm-user-space';

const processIdAllocatorWithoutSQLiteSharedMemory = new ProcessIdAllocator();
const fileLockManagerWithoutSQLiteSharedMemory = new FileLockManagerInMemory();

function loadWebRuntimeWithoutSQLiteSharedMemory(
	...args: Parameters<typeof loadWebRuntime>
) {
	const [phpVersion, loaderOptions = {}] = args;
	const emscriptenOptions = loaderOptions.emscriptenOptions || {};
	return loadWebRuntime(phpVersion, {
		...loaderOptions,
		emscriptenOptions: {
			...emscriptenOptions,
			processId:
				emscriptenOptions['processId'] ??
				processIdAllocatorWithoutSQLiteSharedMemory.claim(),
			bindUserSpace:
				emscriptenOptions['bindUserSpace'] ??
				((context: WasmUserSpaceContext) =>
					bindUserSpace(
						fileLockManagerWithoutSQLiteSharedMemory,
						undefined,
						context
					)),
		},
	});
}

declare global {
	interface Window {
		PHP: typeof PHP;
		PHPRequestHandler: typeof PHPRequestHandler;
		loadWebRuntime: typeof loadWebRuntime;
		loadWebRuntimeWithoutSQLiteSharedMemory: typeof loadWebRuntimeWithoutSQLiteSharedMemory;
		proxyFileSystem: typeof proxyFileSystem;
		setPhpIniEntries: typeof setPhpIniEntries;
		generateCertificate: typeof generateCertificate;
		certificateToPEM: typeof certificateToPEM;
	}
}

window.PHP = PHP;
window.PHPRequestHandler = PHPRequestHandler;
window.loadWebRuntime = loadWebRuntime;
window.loadWebRuntimeWithoutSQLiteSharedMemory =
	loadWebRuntimeWithoutSQLiteSharedMemory;
window.proxyFileSystem = proxyFileSystem;
window.setPhpIniEntries = setPhpIniEntries;
window.generateCertificate = generateCertificate;
window.certificateToPEM = certificateToPEM;
