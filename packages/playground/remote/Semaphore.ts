export class Semaphore {
	count: number;
	queue: ((value?: unknown) => void)[];
	constructor(count: number) {
		this.count = count;
		this.queue = [];
	}

	async acquire() {
		if (this.count > 0) {
			this.count--;
		} else {
			await new Promise((resolve) => this.queue.push(resolve));
		}
	}

	release() {
		if (this.queue.length > 0) {
			this.queue.shift()!();
		} else {
			this.count++;
		}
	}
}
