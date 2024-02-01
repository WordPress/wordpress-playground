import { Semaphore } from '@php-wasm/util';
import { BasePHP } from './base-php';

export interface RotateOptions<T extends BasePHP> {
	php: T;
	recreateRuntime: () => Promise<number> | number;
	maxRequests: number;
}

/**
 * Patches PHP to discard and replace the internal PHP Runtime after a certain
 * number of run() calls (which are responsible for handling HTTP requests).
 *
 * Why? Because PHP and PHP extension have a memory leak. Each request leaves
 * the memory a bit more fragmented and with a bit less available space than
 * before. Eventually, new allocations start failing.
 *
 * Rotating the PHP instance may seem like a workaround, but it's actually
 * what PHP-FPM does natively:
 *
 * https://www.php.net/manual/en/install.fpm.configuration.php#pm.max-tasks
 */
export function rotatedPHP<T extends BasePHP>({
	php,
	recreateRuntime,
	maxRequests,
}: RotateOptions<T>): T {
	let handledCalls = 0;
	const semaphore = new Semaphore({ concurrency: 1 });
	const originalRun = php.run;
	php.run = async (...args: any) =>
		semaphore.run(async () => {
			if (++handledCalls > maxRequests) {
				handledCalls = 0;
				php.hotSwapPHPRuntime(await recreateRuntime());
			}
			return await originalRun.apply(php, args);
		});
	return php;
}
