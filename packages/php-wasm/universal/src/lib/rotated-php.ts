import { Semaphore, joinPaths } from '@php-wasm/util';
import { BasePHP, __private__dont__use } from './base-php';

export interface RotateOptions<T extends BasePHP> {
	createPhp: () => Promise<T>;
	maxRequests?: number;
}
export async function rotatedPHP<T extends BasePHP>({
	createPhp,
	maxRequests = 50,
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
		copyPath(newPhp[__private__dont__use].FS, oldFS, docroot);
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
function copyPath(newFS: EmscriptenFS, oldFS: EmscriptenFS, path: string) {
	let oldNode;
	try {
		oldNode = oldFS.lookupPath(path);
	} catch (e) {
		return;
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
		copyPath(newFS, oldFS, joinPaths(path, filename));
	}
}
