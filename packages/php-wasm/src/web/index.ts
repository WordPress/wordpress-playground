export {
	setURLScope,
	getURLScope,
	isURLScoped,
	removeURLScope,
} from '../php-library/scope';
export {
	spawnPHPWorkerThread,
	recommendedWorkerBackend,
} from './spawn-php-worker-thread';
export { registerServiceWorker } from './service-worker/window-library';
export {
	postMessageExpectReply,
	awaitReply,
	responseTo,
} from '../php-library/messaging';

export {
	EmscriptenDownloadMonitor,
	cloneResponseMonitorProgress,
} from './progress-monitoring/emscripten-download-monitor';
export type {
	DownloadProgressEvent,
	DownloadProgressCallback,
} from './progress-monitoring/emscripten-download-monitor';

export { ProgressType, ProgressObserver } from './progress-monitoring/progress-observer';
export { PHPPublicAPI } from './php-public-api';
