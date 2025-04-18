import { PHP, PHPWorker, loadPHPRuntime } from '@php-wasm/universal';
import { exposeAPI, getPHPLoaderModule } from '@php-wasm/web';
import {
	sharedArrayBufferMount,
	SharedFSBuffers,
} from './shared-array-buffer-fs';

interface BootOptions {
	sharedBuffers: SharedFSBuffers;
}
export class ExperimentalWorkerEndpoint extends PHPWorker {
	booted = false;

	async boot(options: BootOptions) {
		const php = new PHP(
			await loadPHPRuntime(await getPHPLoaderModule('8.0'))
		);
		php.mkdir('/experimental-sabfs');
		php.mount(
			'/experimental-sabfs',
			sharedArrayBufferMount(options.sharedBuffers)
		);
		this.setPrimaryPHP(php);
		setApiReady();
	}
}

// post message to parent
self.postMessage('worker-script-started');

const [setApiReady, setAPIError] = exposeAPI(new ExperimentalWorkerEndpoint());
