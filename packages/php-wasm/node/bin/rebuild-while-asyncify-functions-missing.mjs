import { execSync } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs';
import { hash } from 'ts-json-schema-generator';
import { phpVersions } from '../../supported-php-versions.mjs';

const PHP_VERSIONS = process.env.PHP
	? [process.env.PHP]
	: phpVersions.map(({ version }) => version);

let hash1 = '';
let hash2 = '';
for (const PHP_VERSION of PHP_VERSIONS) {
	while (true) {
		hash1 = getHash();
		execSync(
			`PHP=${PHP_VERSION} FIX_DOCKERFILE=true node --stack-trace-limit=100 ./node_modules/.bin/nx test php-wasm-node --test-name-pattern='asyncify'`,
			{
				stdio: 'inherit',
			}
		);
		hash2 = getHash();
		if (hash1 === hash2) {
			break;
		}
		execSync(`npm run recompile:php:node:${PHP_VERSION}`, {
			stdio: 'inherit',
		});
	}
}

function getHash() {
	return createHash('sha1')
		.update(fs.readFileSync('./packages/php-wasm/compile/Dockerfile'))
		.digest('hex');
}
