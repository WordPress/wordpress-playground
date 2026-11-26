import { loadNodeRuntime } from '@php-wasm/node';
import type { PHPRequestHandler } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { bootRequestHandler } from '../boot';

describe('bootRequestHandler boot constants', () => {
	let internalDir: string;
	let handlers: PHPRequestHandler[];

	const createPhpRuntime = async () =>
		await loadNodeRuntime(RecommendedPHPVersion, {
			emscriptenOptions: { nativeInternalDirPath: internalDir },
		});
	const constsPath = () => join(internalDir, 'shared', 'consts.json');
	const boot = async (constants?: Record<string, string>) => {
		const handler = await bootRequestHandler({
			siteUrl: 'http://playground-domain/',
			createPhpRuntime,
			maxPhpInstances: 1,
			constants,
		});
		handlers.push(handler);
		await handler.getPrimaryPhp();
	};

	beforeEach(() => {
		handlers = [];
		internalDir = mkdtempSync(join(tmpdir(), 'boot-constants-'));
	});

	afterEach(async () => {
		await Promise.all(
			handlers.map((handler) => handler[Symbol.asyncDispose]())
		);
		rmSync(internalDir, { recursive: true, force: true });
	});

	it('writes the boot constants on the first boot', async () => {
		await boot({ CUSTOM_CONST: 'first' });

		expect(JSON.parse(readFileSync(constsPath(), 'utf8'))).toMatchObject({
			WP_SQLITE_AST_DRIVER: true,
			SQLITE_JOURNAL_MODE: 'DELETE',
			CUSTOM_CONST: 'first',
		});
	});

	it('does not rewrite the boot constants when another PHP boots on the same /internal', async () => {
		await boot({ CUSTOM_CONST: 'first' });
		writeFileSync(constsPath(), '{"SENTINEL":1}');

		await boot({ CUSTOM_CONST: 'second' });

		expect(readFileSync(constsPath(), 'utf8')).toBe('{"SENTINEL":1}');
	});
});
