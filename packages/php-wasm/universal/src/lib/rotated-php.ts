import { Semaphore } from '@php-wasm/util';
import { BasePHP } from './base-php';

export interface RotateOptions<T extends BasePHP> {
	php: T;
	recreateRuntime: () => Promise<number> | number;
	maxRequests: number;
}

/**
 * Returns a PHP interface-compliant object that maintains a PHP instance
 * internally. After X run() and request() calls, that internal instance
 * is discarded and a new one is created.
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
	return new Proxy(
		{},
		{
			get(target, prop: string) {
				if (prop === 'run' || prop === 'request') {
					return async (...args: any[]) =>
						semaphore.run(async () => {
							if (++handledCalls > maxRequests) {
								handledCalls = 0;
								php.hotSwapPHPRuntime(await recreateRuntime());
							}
							return (php[prop as keyof T] as any)(...args);
						});
				}

				const value = php[prop as keyof T];
				if (typeof value === 'function') {
					/**
					 * Binding solves the following problem:
					 * TypeError: Cannot read private member #messageListeners from an object whose class did not declare it
					 */
					return (...args: any[]) =>
						(php[prop as keyof T] as any)(...args);
				}

				return php[prop as keyof T];
			},
		}
	) as any;
}
