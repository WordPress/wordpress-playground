/// <reference lib="WebWorker" />
import { installAppServiceWorker } from './src/lib/app-service-worker';
import { installWorkerLifecycle } from './src/lib/service-worker-lifecycle';
installWorkerLifecycle('app');
installAppServiceWorker();
