
import { initializeServiceWorker, seemsLikeAPHPServerPath } from 'php-wasm-browser';
import { isUploadedFilePath } from './';

initializeServiceWorker({
    shouldForwardRequestToPHPServer
});

function shouldForwardRequestToPHPServer(request, unscopedUrl) {
    const path = unscopedUrl.pathname;
    return ! path.startsWith('/plugin-proxy') && (
        seemsLikeAPHPServerPath(path) ||
        isUploadedFilePath(path)
    );
}
