import {
	ProgressObserver,
	cloneResponseMonitorProgress,
} from '@php-wasm/progress';
import type { PlaygroundClient } from '../';

import { installPlugin } from './install-plugin';
import { zipNameToHumanName } from './common';

export async function installPluginsFromDirectory(
	playground: PlaygroundClient,
	pluginsZipNames: string[],
	progressBudget = 0,
	progress?: ProgressObserver
) {
	const downloads = new PromiseQueue();
	const installations = new PromiseQueue();

	const progressBudgetPerPlugin = progressBudget / pluginsZipNames.length;

	/**
	 * Install multiple plugins to minimize the processing time.
	 *
	 * The downloads are done one after another to get installable
	 * zip files as soon as possible. Each completed download triggers
	 * plugin installation without waiting for the next download to
	 * complete.
	 */
	await new Promise((finish) => {
		for (const preinstallPlugin of pluginsZipNames) {
			downloads.enqueue(async () => {
				let response = await fetch(
					'/plugin-proxy?plugin=' + preinstallPlugin
				);
				if (progress) {
					response = cloneResponseMonitorProgress(
						response,
						progress.partialObserver(
							progressBudgetPerPlugin * 0.66,
							`Installing ${zipNameToHumanName(
								preinstallPlugin
							)} plugin...`
						)
					);
				}
				if (response.status !== 200) {
					console.error(
						`Proceeding without the ${preinstallPlugin} plugin. Could not download the zip bundle from https://downloads.wordpress.org/plugin/${preinstallPlugin} – ` +
							`Is the file name correct?`
					);
					return null;
				}
				return new File([await response.blob()], preinstallPlugin);
			});
		}
		downloads.addEventListener('resolved', (e: any) => {
			installations.enqueue(async () => {
				if (!e.detail) {
					return;
				}
				progress?.slowlyIncrementBy(progressBudgetPerPlugin * 0.33);
				try {
					await installPlugin(playground, e.detail as File);
				} catch (error) {
					console.error(
						`Proceeding without the ${e.detail.name} plugin. Could not install it in wp-admin. ` +
							`The original error was: ${error}`
					);
					console.error(error);
				}
			});
		});
		installations.addEventListener('empty', () => {
			if (installations.resolved === pluginsZipNames.length) {
				finish(null);
			}
		});
	});
}

class PromiseQueue extends EventTarget {
	#queue: Array<() => Promise<any>> = [];
	#running = false;
	#_resolved = 0;

	get resolved() {
		return this.#_resolved;
	}

	async enqueue(fn: () => Promise<any>) {
		this.#queue.push(fn);
		this.#run();
	}

	async #run() {
		if (this.#running) {
			return;
		}
		try {
			this.#running = true;
			while (this.#queue.length) {
				const next = this.#queue.shift();
				if (!next) {
					break;
				}
				const result = await next();
				++this.#_resolved;
				this.dispatchEvent(
					new CustomEvent('resolved', { detail: result })
				);
			}
		} finally {
			this.#running = false;
			this.dispatchEvent(new CustomEvent('empty'));
		}
	}
}
