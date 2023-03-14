export {
	setURLScope,
	getURLScope,
	isURLScoped,
	removeURLScope,
} from '../php-library/scope';
export {
	spawnPHPWorkerThread,
	recommendedWorkerBackend,
} from './spawn-worker-thread';
export { registerServiceWorker } from './register-service-worker';
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
	DownloadProgress,
	DownloadProgressCallback,
} from './progress-monitoring/emscripten-download-monitor';

export { ProgressObserver } from './progress-monitoring/progress-observer';
export type { ProgressMode, ProgressObserverEvent } from './progress-monitoring/progress-observer';
export { PHPPublicAPI } from './php-public-api';
