import {
	initializeServiceWorker,
	seemsLikeAPHPServerPath,
} from 'php-wasm-browser/service-worker';
import { isUploadedFilePath } from './utils';

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
