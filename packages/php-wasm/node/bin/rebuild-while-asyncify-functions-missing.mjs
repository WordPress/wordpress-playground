import { execSync, spawnSync } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { hash } from 'ts-json-schema-generator';
import { phpVersions } from '../../supported-php-versions.mjs';

const PHP_VERSIONS = process.env.PHP
	? [process.env.PHP]
	: phpVersions.map(({ version }) => version);
let hash1 = '';
let hash2 = '';
for (const PHP_VERSION of PHP_VERSIONS) {
	while (true) {
		console.log(`Running asyncify tests for PHP ${PHP_VERSION}...`);
		hash1 = getHash();
		// Need to reset nx server/cache or otherwise
		// all the test runs will come from cache.
		spawnSync('node', ['./node_modules/.bin/nx', 'reset']);
		spawnSync(
			'node',
			[
				'--stack-trace-limit=100',
				'./node_modules/.bin/nx',
				'test',
				'php-wasm-node',
				'--test-name-pattern=asyncify',
			],
			{
				env: {
					...process.env,
					PHP: PHP_VERSION,
					FIX_DOCKERFILE: 'true',
				},
			}
		);

		hash2 = getHash();
		if (hash1 === hash2) {
			console.log(`Dockerfile did not change!`);
			break;
		}

		console.log(`Dockerfile changed, recompiling PHP...`);
		spawnSync('npm', ['run', `recompile:php:node:${PHP_VERSION}`]);
	}
}

function getHash() {
	return createHash('sha1')
		.update(
			fs.readFileSync(
				new URL('../../compile/php/Dockerfile', import.meta.url)
					.pathname
			)
		)
		.digest('hex');
}
