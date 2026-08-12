import {
	exposeAPI,
	PHP,
	PHPWorker,
	setPhpIniEntries,
} from '@php-wasm/universal';
import { sendmailSpawnHandler } from '@php-wasm/util';
import { loadWebRuntime } from '../../lib';

self.postMessage('worker-script-started');

class SendmailWorker extends PHPWorker {
	async initialize() {
		const php = new PHP(await loadWebRuntime('8.4'));
		php.setCommandSpawnHandler('sendmail', sendmailSpawnHandler(php));
		await setPhpIniEntries(php, {
			disable_functions: '',
		});
		await this.setPrimaryPHP(php);
		this.registerWorkerListeners(php);
	}

	exit() {
		this.__internal_getPHP()?.exit();
	}
}

const endpoint = new SendmailWorker();
const [setApiReady, setAPIError] = exposeAPI(endpoint);
endpoint.initialize().then(setApiReady, setAPIError);
