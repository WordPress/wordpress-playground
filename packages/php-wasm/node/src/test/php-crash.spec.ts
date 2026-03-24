import { vi } from 'vitest';
import {
	SupportedPHPVersions,
	setPhpIniEntries,
	__private__dont__use,
	PHP,
} from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';
import { jspi } from 'wasm-feature-detect';

const phpVersions =
	'PHP' in process.env ? [process.env['PHP']!] : SupportedPHPVersions;

describe.each(phpVersions)('PHP %s – ', async (phpVersion) => {
	describe('process crash', async () => {
		let php: PHP;

		beforeEach(async () => {
			php = new PHP(
				await loadNodeRuntime(phpVersion as any, { withXdebug: true })
			);
			await setPhpIniEntries(php, { allow_url_fopen: 1 });
			vi.restoreAllMocks();
		});

		afterEach(async () => {
			php.exit();
		});

		if (!(await jspi())) {
			it('Does not crash due to an unhandled Asyncify error', async () => {
				let caughtError: unknown;
				const uncaughtErrors: unknown[] = [];

				function errorHandler(error: unknown) {
					uncaughtErrors.push(error);
				}

				process.on('unhandledRejection', errorHandler);
				process.on('uncaughtException', errorHandler);

				/**
				 * var_dump() with __debugInfo() crashes with Xdebug
				 * because Xdebug's develop mode overrides var_dump
				 * with code paths that use indirect function calls,
				 * which can't be instrumented by asyncify.
				 *
				 * `var_dump($x)` will throw an asynchronous error
				 * when __debugInfo() attempts a network call
				 * ("unreachable" WASM instruction executed).
				 * This test should gracefully catch and handle
				 * that error.
				 *
				 * A failure to do so will crash the entire process.
				 */
				try {
					php.run({
						code: `<?php
						class Top {
							function __debugInfo() { file_get_contents("http://127.0.0.1"); }
						}
						$x = new Top();
						var_dump($x);
						`,
					}).catch((error) => (caughtError = error));
				} catch (error) {
					caughtError = error;
				}

				// Make sure the process exits and give any unhandled rejections a chance to be caught
				await new Promise((resolve) => setTimeout(resolve, 1000));

				// Accept either a caught error or an uncaught error
				if (!caughtError && uncaughtErrors.length === 0) {
					expect.fail(
						'php.run should have thrown an error or caused an unhandled rejection'
					);
				}

				const errorPattern =
					/Aborted|Program terminated with exit\(1\)|unreachable|null function or function signature|out of bounds/;

				if (caughtError instanceof Error) {
					expect(
						(caughtError as any).cause?.message ||
							caughtError.message
					).toMatch(errorPattern);
				}

				for (const error of uncaughtErrors) {
					if (error instanceof Error) {
						expect(
							(error as any).cause?.message || error.message
						).toMatch(errorPattern);
					}
				}

				process.off('unhandledRejection', errorHandler);
				process.off('uncaughtException', errorHandler);
			});
		}

		it('Does not crash due to an unhandled non promise error ', async () => {
			// Tolerate an unhandled rejections

			let caughtError;
			try {
				const spy = vi.spyOn(php[__private__dont__use], 'ccall');
				expect(spy.getMockName()).toEqual('ccall');
				spy.mockImplementation((c_func) => {
					if (c_func === 'wasm_sapi_handle_request') {
						throw new Error('test');
					}
				});

				await php.run({
					code: `<?php
				function top() {
								file_get_contents("http://127.0.0.1");
				}
				top();
					`,
				});
			} catch (error: unknown) {
				caughtError = error;
				if (error instanceof Error) {
					expect(error.message).toMatch('test');
				}
			}
			if (!caughtError) {
				expect.fail('php.run should have thrown an error');
			}
		});

		it('Does not leak memory when creating and destroying instances', async () => {
			if (!global.gc) {
				console.error(
					`\u001b[33mAlert! node must be run with --expose-gc to test properly!\u001b[0m\n` +
						`\u001b[33mnx can pass the switch with:\u001b[0m\n` +
						`\u001b[33m\tnode --expose-gc  node_modules/nx/bin/nx\u001b[0m`
				);
			}

			expect(global).toHaveProperty('gc');
			expect(global.gc).toBeDefined();

			let refCount = 0;

			const registry = new FinalizationRegistry(() => --refCount);

			const concurrent = 25;
			const steps = 5;

			const delay = (ms: number) =>
				new Promise((accept) => setTimeout(accept, ms));

			for (let i = 0; i < steps; i++) {
				const instances = new Set<PHP>();

				for (let j = 0; j < concurrent; j++) {
					instances.add(
						new PHP(await loadNodeRuntime(phpVersion as any))
					);
				}

				refCount += instances.size;

				for (const instance of instances) {
					registry.register(instance, null);
					await instance
						.run({ code: `<?php 2+2;` })
						.then(() => instance.exit())
						.catch(() => {});
				}

				instances.clear();

				await delay(10);
				if (global.gc) {
					global.gc();
				}
			}

			await delay(100);
			if (global.gc) {
				global.gc();
			}

			expect(refCount).lessThanOrEqual(10);
		}, 500_000);
	});

	describe('emscripten options', () => {
		it('calls quit callback', async () => {
			let result = '';
			const php: PHP = new PHP(
				await loadNodeRuntime(phpVersion as any, {
					emscriptenOptions: { quit: () => (result = 'WordPress') },
				})
			);
			php.exit(0);
			expect(result).toEqual('WordPress');
		});
	});
});
