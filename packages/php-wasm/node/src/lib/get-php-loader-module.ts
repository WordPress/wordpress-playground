import { LatestSupportedPHPVersion } from '@php-wasm/universal';
import type { PHPLoaderModule, SupportedPHPVersion } from '@php-wasm/universal';

/**
 * Loads the PHP loader module for the given PHP version.
 *
 * Each PHP version is packaged separately to reduce bundle size:
 * - @php-wasm/node-8-5
 * - @php-wasm/node-8-4
 * - @php-wasm/node-8-3
 * - etc.
 *
 * @param version The PHP version to load.
 * @returns The PHP loader module.
 */
export async function getPHPLoaderModule(
	version: SupportedPHPVersion | string = LatestSupportedPHPVersion
): Promise<PHPLoaderModule> {
	try {
		switch (version) {
			case '8.5':
				// @ts-ignore
				return (
					await import('@php-wasm/node-8-5')
				).getPHPLoaderModule();
			case '8.4':
				// @ts-ignore
				return (
					await import('@php-wasm/node-8-4')
				).getPHPLoaderModule();
			case '8.3':
				// @ts-ignore
				return (
					await import('@php-wasm/node-8-3')
				).getPHPLoaderModule();
			case '8.2':
				// @ts-ignore
				return (
					await import('@php-wasm/node-8-2')
				).getPHPLoaderModule();
			case '8.1':
				// @ts-ignore
				return (
					await import('@php-wasm/node-8-1')
				).getPHPLoaderModule();
			case '8.0':
				// @ts-ignore
				return (
					await import('@php-wasm/node-8-0')
				).getPHPLoaderModule();
			case '7.4':
				// @ts-ignore
				return (
					await import('@php-wasm/node-7-4')
				).getPHPLoaderModule();
		}

		throw new Error(`Unsupported PHP version ${version}`);
	} catch (errorCandidate) {
		if (!errorCandidate || typeof errorCandidate !== 'object') {
			throw errorCandidate;
		}
		const error = errorCandidate as { message?: string; code?: string };
		if (
			error.message?.includes(
				`SyntaxError: Cannot use 'import.meta' outside a module`
			)
		) {
			throw new Error(
				`Node.js crashed on a 'import.meta' statement. This happens when running ` +
					`in a node:vm context. Some testing libraries like Jest use heavily customized ` +
					`runtime contexts, involving node:vm, jest-runtime, and custom require() implementations. ` +
					`These contexts do not support 'import.meta' statements and, by extension, cannot ` +
					`run the @php-wasm/node package. ` +
					`Consider using the --experimental-vm-modules flag or switching to a different test runner such as vitest.`,
				{
					cause: error,
				}
			);
		} else if (
			error?.code === `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING` ||
			error?.code === `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG` ||
			error?.message?.includes(
				`A dynamic import callback was invoked without --experimental-vm-modules`
			) ||
			error?.message?.includes(
				`A dynamic import callback was not specified`
			) ||
			error?.message?.includes(`Must use import to load ES Module`)
		) {
			throw new Error(
				`Node.js crashed on a 'import()' statement. This happens when running ` +
					`in a node:vm context. Some testing libraries like Jest use runtime contexts, ` +
					`involving node:vm, jest-runtime, or other custom require() implementations. These contexts do not support ` +
					'import() statements and, by extension, cannot run the @php-wasm/node package. ' +
					`Consider using the --experimental-vm-modules flag or switching to a different test runner such as vitest.`,
				{
					cause: error,
				}
			);
		}
		throw error;
	}
}
