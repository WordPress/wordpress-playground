/// <reference lib="WebWorker" />
/** Compatibility entry for standalone builds and previously installed registrations. */
import { playgroundOrigin, wordPressSiteUrl } from './src/lib/config';
import { installAppServiceWorker } from './src/lib/app-service-worker';
import { installWordPressServiceWorker } from './src/lib/wordpress-service-worker';
import { installWorkerLifecycle } from './src/lib/service-worker-lifecycle';
import { trackAnsweredFetches } from './src/lib/answered-fetches';

declare const self: ServiceWorkerGlobalScope;

const role = self.location.origin === playgroundOrigin ? 'app' : 'sandbox';
installWorkerLifecycle(role);
if (role === 'sandbox' || wordPressSiteUrl === playgroundOrigin) {
	// WordPress routing runs first; the app handler skips requests it answered.
	self.addEventListener('fetch', trackAnsweredFetches);
	installWordPressServiceWorker();
}
if (role === 'app') installAppServiceWorker();
