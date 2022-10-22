
import { initializeServiceWorker, isPHPFile } from 'php-wasm-browser';
import { isStaticFile } from './';

initializeServiceWorker({
    broadcastChannel: new BroadcastChannel('wordpress-wasm'),
    shouldHandleRequest: (url, event) => isPHPFile(url.pathname) || isStaticFile(url.pathname)
});
