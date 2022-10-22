
import { initializeServiceWorker, seemsLikeAPHPServerPath } from 'php-wasm-browser';
import { isUploadedFilePath } from './';

initializeServiceWorker({
    broadcastChannel: new BroadcastChannel('wordpress-wasm'),
    shouldForwardRequestToPHPServer
});

function shouldForwardRequestToPHPServer(request, unscopedUrl) {
    const path = unscopedUrl.pathname;
    return ! path.startsWith('/plugin-proxy') && (
        seemsLikeAPHPServerPath(path) ||
        isUploadedFilePath(path)
    );
}
