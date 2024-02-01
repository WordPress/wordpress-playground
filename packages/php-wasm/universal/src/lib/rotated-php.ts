import { Semaphore, joinPaths } from '@php-wasm/util';
import { BasePHP, __private__dont__use } from './base-php';

export interface RotateOptions<T extends BasePHP> {
	createPhp: () => Promise<T>;
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
export async function rotatedPHP<T extends BasePHP>({
	createPhp,
	maxRequests,
}: RotateOptions<T>): Promise<T> {
	let php = (await createPhp()) as T;
	let handledCalls = 0;
	const semaphore = new Semaphore({ concurrency: 1 });

	async function rotate() {
		const oldPhp = php;
		const oldFS = await oldPhp[__private__dont__use].FS;
		const oldCookies = oldPhp.requestHandler!.serializeCookies();
		const docroot = await oldPhp.documentRoot;
		try {
			await oldPhp.exit();
		} catch (e) {
			// Ignore the exit-related exception
		}

		const newPhp = await createPhp();
		recreateMemFS(newPhp[__private__dont__use].FS, oldFS, docroot);
		newPhp.requestHandler!.setCookies(oldCookies?.split(';') || []);

		php = newPhp;
	}

	return new Proxy(
		{},
		{
			get(target, prop: string) {
				if (prop === 'run' || prop === 'request') {
					return async (...args: any[]) =>
						semaphore.run(async () => {
							if (++handledCalls > maxRequests) {
								handledCalls = 0;
								await rotate();
							}
							return (php[prop as keyof T] as any)(...args);
						});
				}

				return php[prop as keyof T];
			},
		}
	) as T;
}

type EmscriptenFS = any;
/**
 * Copies the MEMFS directory structure from one FS in another FS.
 * Non-MEMFS nodes are ignored.
 */
function recreateMemFS(newFS: EmscriptenFS, oldFS: EmscriptenFS, path: string) {
	let oldNode;
	try {
		oldNode = oldFS.lookupPath(path);
	} catch (e) {
		return;
	}
	// MEMFS nodes have a `contents` property. NODEFS nodes don't.
	// We only want to copy MEMFS nodes here.
	if (!('contents' in oldNode.node)) {
		return;
	}

	// Let's be extra careful and only proceed if newFs doesn't
	// already have a node at the given path.
	try {
		newFS = newFS.lookupPath(path);
		return;
	} catch (e) {
		// There's no such node in the new FS. Good,
		// we may proceed.
	}

	if (!oldFS.isDir(oldNode.node.mode)) {
		newFS.writeFile(path, oldFS.readFile(path));
		return;
	}

	newFS.mkdirTree(path);
	const filenames = oldFS
		.readdir(path)
		.filter((name: string) => name !== '.' && name !== '..');
	for (const filename of filenames) {
		recreateMemFS(newFS, oldFS, joinPaths(path, filename));
	}
}
