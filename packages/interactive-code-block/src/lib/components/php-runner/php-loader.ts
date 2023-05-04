import type { LoadingStatus } from '../../types';
import {
	consumeAPI,
	recommendedWorkerBackend,
	spawnPHPWorkerThread,
} from '@php-wasm/web';

import type { PHPClient } from '../../php-worker';

export class PHPLoader extends EventTarget {
	private promise?: Promise<PHPClient>;
	status: LoadingStatus = 'idle';
	progress = 0;

	load() {
		if (!this.promise) {
			this.promise = this._load();
		}
		return this.promise!;
	}

	async _load() {
		this.status = 'loading';
		const { default: workerScriptUrl } = await import(
			/** @ts-ignore */
			'../../php-worker.ts?url&worker'
		);
		const worker = await spawnPHPWorkerThread(
			workerScriptUrl,
			recommendedWorkerBackend
		);
		const php = consumeAPI<PHPClient>(worker);
		php?.onDownloadProgress((e) => {
			const { loaded, total } = e.detail;
			this.progress = (100 * loaded) / total;
			this.dispatchEvent(
				new CustomEvent('progress', {
					detail: this.progress,
				})
			);
		});
		await php?.isReady();
		this.status = 'ready';
		return php;
	}
}

const sharedPHPLoader: PHPLoader = new PHPLoader();
export default sharedPHPLoader;
