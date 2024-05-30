import { PHP } from './php';

export interface RotateOptions {
	php: PHP;
	cwd: string;
	recreateRuntime: () => Promise<number> | number;
	maxRequests: number;
}

/**
 * Listens to PHP events and swaps the internal PHP Runtime for a fresh one
 * after a certain number of run() calls (which are responsible for handling
 * HTTP requests).
 *
 * Why? Because PHP and PHP extension have a memory leak. Each request leaves
 * the memory a bit more fragmented and with a bit less available space than
 * before. Eventually, new allocations start failing.
 *
 * Rotating the PHP instance may seem like a workaround, but it's actually
 * what PHP-FPM does natively:
 *
 * https://www.php.net/manual/en/install.fpm.configuration.php#pm.max-tasks
 *
 * @return cleanup function to restore
 */
export function rotatePHPRuntime({
	php,
	cwd,
	recreateRuntime,
	/*
	 * 400 is an arbitrary number that should trigger a rotation
	 * way before the memory gets too fragmented. If it doesn't,
	 * let's explore:
	 * * Rotating based on an actual memory usage and
	 *   fragmentation.
	 * * Resetting HEAP to its initial value.
	 */
	maxRequests = 400,
}: RotateOptions) {
	let handledCalls = 0;
	async function rotateRuntime() {
		if (++handledCalls < maxRequests) {
			return;
		}
		handledCalls = 0;

		const release = await php.semaphore.acquire();
		try {
			php.hotSwapPHPRuntime(await recreateRuntime(), cwd);
		} finally {
			release();
		}
	}
	php.addEventListener('request.end', rotateRuntime);
	return function () {
		php.removeEventListener('request.end', rotateRuntime);
	};
}
