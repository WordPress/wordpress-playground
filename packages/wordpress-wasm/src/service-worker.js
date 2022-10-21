
import { registerServiceWorker, isPHPFile } from 'php-wasm-browser';
import { isStaticFile } from 'php-wasm-browser';

initializeServiceWorker({
    broadcastChannel: new BroadcastChannel('wordpress-wasm'),
    shouldHandleRequest: (path, event) => isPHPFile(path) || isStaticFile(path)
});
