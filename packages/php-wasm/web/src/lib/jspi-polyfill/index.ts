export {
	createSharedChannel,
	wrapSharedChannel,
	sendRequestFromWorker,
	readRequest,
	sendResponseToWorker,
	waitForRequestAsync,
	REQUEST_SLEEP,
	REQUEST_FETCH_URL,
	REQUEST_FETCH_URL_CHUNK,
	REQUEST_SOCKET_OPEN,
	REQUEST_SOCKET_SEND,
	REQUEST_SOCKET_RECV,
	REQUEST_SOCKET_CLOSE,
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

export { setupJspiPolyfillListener } from './setup-polyfill-listener';
