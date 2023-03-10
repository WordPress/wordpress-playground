export class PromiseQueue extends EventTarget {
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
