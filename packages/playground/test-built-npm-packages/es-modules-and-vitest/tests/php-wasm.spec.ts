import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
	type SupportedPHPVersion,
	SupportedPHPVersions,
} from '@php-wasm/universal';

const phpVersion = process.env.PHP_VERSION as SupportedPHPVersion;
if (!phpVersion) {
	throw new Error('PHP_VERSION is not set');
}
if (!SupportedPHPVersions.includes(phpVersion)) {
	throw new Error(`PHP_VERSION '${phpVersion}' is not supported`);
}

describe(`PHP ${phpVersion}`, () => {
	it('Should not include PHP.wasm Node in PHP.wasm FS Journal package', async () => {
		const baseUrl = import.meta.resolve(`@php-wasm/fs-journal`);
		const url = new URL('package.json', baseUrl);
		const path = fileURLToPath(url);
		const content = await readFile(path);
		assert.ok(
			!content.includes('@php-wasm/node'),
			`PHP.wasm FS Journal package includes '@php-wasm/node' dev dependency`
		);
	});
});
