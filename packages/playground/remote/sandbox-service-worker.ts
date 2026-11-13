/// <reference lib="WebWorker" />
import { installWordPressServiceWorker } from './src/lib/wordpress-service-worker';
import { installWorkerLifecycle } from './src/lib/service-worker-lifecycle';
installWorkerLifecycle('sandbox');
installWordPressServiceWorker();
