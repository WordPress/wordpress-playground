import { vi } from 'vitest';
import {
	SupportedPHPVersions,
	setPhpIniEntries,
	__private__dont__use,
	PHP,
} from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';

// @TODO Prevent crash on PHP versions 5.6, 7.2, 8.2
describe.each(['7.0', '7.1', '7.3', '7.4', '8.0', '8.1'])(
	'PHP %s – process crash',
	(phpVersion) => {
		let php: PHP;
		beforeEach(async () => {
			php = new PHP(await loadNodeRuntime(phpVersion as any));
			await setPhpIniEntries(php, { allow_url_fopen: 1 });
			vi.restoreAllMocks();
		});

		it('Does not crash due to an unhandled Asyncify error ', async () => {
			let caughtError;
			try {
				/**
				 * PHP is intentionally built without network support for __clone()
				 * because it's an extremely unlikely place for any network activity
				 * and not supporting it allows us to test the error handling here.
				 *
				 * `clone $x` will throw an asynchronous error out when attempting
				 * to do a network call ("unreachable" WASM instruction executed).
				 * This test should gracefully catch and handle that error.
				 *
				 * A failure to do so will crash the entire process
				 */
				await php.run({
					code: `<?php
				class Top {
					function __clone() {
						file_get_contents("http://127.0.0.1");
					}
				}
				$x = new Top();
				clone $x;
				`,
				});
			} catch (error: unknown) {
				caughtError = error;
				if (error instanceof Error) {
					expect(error.message).toMatch(
						/Aborted|Program terminated with exit\(1\)|unreachable|null function or function signature|out of bounds/
					);
				}
			}
			if (!caughtError) {
				expect.fail('php.run should have thrown an error');
			}
		});

		it('Does not crash due to an unhandled non promise error ', async () => {
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
					expect(error.stack).toContain('#handleRequest');
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
	}
);

describe.each(SupportedPHPVersions)('PHP %s', (phpVersion) => {
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
