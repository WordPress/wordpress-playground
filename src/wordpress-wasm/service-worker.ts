import {
	initializeServiceWorker,
	seemsLikeAPHPServerPath,
} from '../php-wasm-browser/service-worker/worker-library';
import { isUploadedFilePath } from './worker-utils';

initializeServiceWorker({
	shouldForwardRequestToPHPServer,
});

function shouldForwardRequestToPHPServer(request, unscopedUrl: URL) {
	const path = unscopedUrl.pathname;
	return (
		!path.startsWith('/plugin-proxy') &&
		(seemsLikeAPHPServerPath(path) || isUploadedFilePath(path))
	);
}
