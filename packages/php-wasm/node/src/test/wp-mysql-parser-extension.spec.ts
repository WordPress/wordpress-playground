import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';

const parserExtensionManifestUrl = new URL(
	'../../../../playground/wordpress-builds/src/sqlite-database-integration/wp-mysql-parser/manifest.json',
	import.meta.url
);

describe('WP MySQL parser PHP.wasm extension', () => {
	let php: PHP | undefined;

	afterEach(() => {
		php?.exit();
		php = undefined;
	});

	it('loads the bundled native parser extension and exposes lexer/parser APIs', async () => {
		expect(existsSync(fileURLToPath(parserExtensionManifestUrl))).toBe(
			true
		);

		php = new PHP(
			await loadNodeRuntime('8.4', {
				phpExtensionManifests: [
					{
						manifestUrl: parserExtensionManifestUrl,
						extensionName: 'wp_mysql_parser',
					},
				],
			})
		);

		const result = await php.run({
			code: `<?php
			$sql = "SELECT 1; INSERT INTO wp_posts (ID, post_title) VALUES (1, 'hello'), (2, 'world')";
			$lexer = new WP_MySQL_Native_Lexer($sql);
			$token_stream = $lexer->native_token_stream();

			echo json_encode(array(
				'extensionLoaded' => extension_loaded('wp_mysql_parser'),
				'lexerClassExists' => class_exists('WP_MySQL_Native_Lexer', false),
				'parserClassExists' => class_exists('WP_MySQL_Native_Parser', false),
				'astClassExists' => class_exists('WP_MySQL_Native_Ast', false),
				'grammarClassExists' => class_exists('WP_MySQL_Native_Grammar', false),
				'tokenStreamClassExists' => class_exists('WP_MySQL_Native_Token_Stream', false),
				'lexerHasNativeTokenStream' => method_exists('WP_MySQL_Native_Lexer', 'native_token_stream'),
				'parserHasParse' => method_exists('WP_MySQL_Native_Parser', 'parse'),
				'selectTokenId' => WP_MySQL_Native_Lexer::get_token_id('SELECT_SYMBOL'),
				'tokenCount' => $token_stream->count(),
			));
			`,
		});

		expect(result.errors).toBeFalsy();
		const parsedResult = JSON.parse(result.text);

		expect(parsedResult).toMatchObject({
			extensionLoaded: true,
			lexerClassExists: true,
			parserClassExists: true,
			astClassExists: true,
			grammarClassExists: true,
			tokenStreamClassExists: true,
			lexerHasNativeTokenStream: true,
			parserHasParse: true,
			selectTokenId: expect.any(Number),
			tokenCount: expect.any(Number),
		});
		expect(parsedResult.selectTokenId).toBeGreaterThan(0);
		expect(parsedResult.tokenCount).toBeGreaterThan(10);
	});
});
