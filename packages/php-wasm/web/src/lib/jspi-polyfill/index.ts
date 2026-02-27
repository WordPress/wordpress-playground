export {
	createSharedChannel,
	wrapSharedChannel,
	sendRequestFromWorker,
	readRequest,
	sendResponseToWorker,
	waitForRequestAsync,
	REQUEST_SLEEP,
	HEADER_SIZE,
	DEFAULT_DATA_SIZE,
} from './shared-channel';

export type {
	SharedChannel,
	WorkerResponse,
	MainThreadRequest,
} from './shared-channel';

export {
	needsJspiPolyfill,
	installJspiPolyfill,
	uninstallJspiPolyfill,
	isJspiPolyfillInstalled,
} from './jspi-polyfill';

export { startMainThreadHandler } from './main-thread-handler';
