import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { cliExtensionArgsToExtensionsArray } from '../src/php-extensions';
import {
	createWasmWordPressPluginBootstrap,
	expandWasmWordPressPluginArgs,
	readWasmWordPressPluginConfig,
} from '../src/wasm-wordpress-plugins';

describe('WASM WordPress plugins', () => {
	test('reads the bundled Hello Dolly WASM example descriptor', () => {
		const exampleConfigPath = path.resolve(
			import.meta.dirname,
			'../../../php-wasm/compile-extension/examples/hello-dolly-wasm/wasm-wordpress-plugin.json'
		);

		const config = readWasmWordPressPluginConfig(exampleConfigPath);

		expect(config.slug).toBe('hello-dolly-wasm');
		expect(config.extension).toEqual({
			name: 'hello_dolly_wasm',
			source: {
				format: 'manifest',
				manifestUrl: path.resolve(
					path.dirname(exampleConfigPath),
					'./dist/manifest.json'
				),
			},
		});
		expect(config.hooks).toEqual([
			{
				type: 'action',
				hook: 'admin_notices',
				callback: 'hello_dolly_wasm_render',
				priority: undefined,
				acceptedArgs: undefined,
			},
			{
				type: 'action',
				hook: 'admin_head',
				callback: 'hello_dolly_wasm_css',
				priority: undefined,
				acceptedArgs: undefined,
			},
		]);
		expect(config.bootstrapCode).toContain(
			'function hello_dolly_wasm_render'
		);
	});

	test('expands a plugin descriptor into runtime extension and mu-plugin bootstrap', async () => {
		const tempDir = await mkdtemp(path.join(tmpdir(), 'wasm-wp-plugin-'));
		const bootstrapPath = path.join(tempDir, 'bootstrap.php');
		const configPath = path.join(tempDir, 'plugin.json');
		await writeFile(
			bootstrapPath,
			`<?php
function hello_wasm_php_wrapper( $content ) {
	return hello_wasm_filter( $content );
}
`
		);
		await writeFile(
			configPath,
			JSON.stringify({
				slug: 'hello-wasm',
				name: 'Hello WASM',
				description: 'A WordPress plugin backed by a PHP.wasm module.',
				version: '0.1.0',
				extension: {
					name: 'hello_wasm',
					source: {
						format: 'manifest',
						manifestUrl: './dist/manifest.json',
					},
				},
				bootstrap: './bootstrap.php',
				hooks: [
					{
						type: 'filter',
						hook: 'the_content',
						callback: 'hello_wasm_php_wrapper',
						priority: 12,
						acceptedArgs: 1,
					},
				],
			})
		);

		try {
			const expanded = expandWasmWordPressPluginArgs({
				command: 'server',
				wasmWordPressPlugin: [configPath],
			});
			expect(expanded.runtimePHPExtensions).toEqual([
				{
					name: 'hello_wasm',
					source: {
						format: 'manifest',
						manifestUrl: path.join(tempDir, 'dist/manifest.json'),
					},
				},
			]);
			expect(cliExtensionArgsToExtensionsArray(expanded)).toContainEqual(
				expanded.runtimePHPExtensions![0]
			);
			expect(expanded['additional-blueprint-steps']).toEqual([
				{
					step: 'writeFile',
					path: '/wordpress/wp-content/mu-plugins/hello-wasm.php',
					data: expect.stringContaining(
						"add_filter( 'the_content', 'hello_wasm_php_wrapper', 12, 1 );"
					),
				},
			]);
			expect(expanded['additional-blueprint-steps']![0].data).toContain(
				'function hello_wasm_php_wrapper'
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test('supports inline bootstrap code and action hooks', () => {
		const bootstrap = createWasmWordPressPluginBootstrap({
			slug: 'cache-warmer',
			name: 'Cache Warmer',
			extension: {
				name: 'cache_warmer',
				source: {
					format: 'manifest',
					manifestUrl: '/tmp/cache-warmer/manifest.json',
				},
			},
			bootstrapCode: 'function cache_warmer_boot() {}',
			hooks: [
				{
					type: 'action',
					hook: 'init',
					callback: 'cache_warmer_boot',
				},
			],
		});

		expect(bootstrap).toContain("extension_loaded( 'cache_warmer' )");
		expect(bootstrap).toContain('function cache_warmer_boot() {}');
		expect(bootstrap).toContain(
			"add_action( 'init', 'cache_warmer_boot', 10, 1 );"
		);
	});

	test('rejects descriptors without a valid slug', async () => {
		const tempDir = await mkdtemp(path.join(tmpdir(), 'wasm-wp-plugin-'));
		const configPath = path.join(tempDir, 'plugin.json');
		await writeFile(
			configPath,
			JSON.stringify({
				slug: 'Not Valid',
				extension: {
					source: {
						format: 'manifest',
						manifestUrl: './manifest.json',
					},
				},
			})
		);

		try {
			expect(() => readWasmWordPressPluginConfig(configPath)).toThrow(
				'slug must contain lowercase letters, numbers, and hyphens'
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
