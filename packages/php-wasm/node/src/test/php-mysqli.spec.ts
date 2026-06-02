import fs from 'fs';
import path from 'path';
import {
	PHP,
	SupportedPHPVersions,
	setPhpIniEntries,
} from '@php-wasm/universal';
// eslint-disable-next-line @nx/enforce-module-boundaries
import InitialDockerfile from '../../../compile/php/Dockerfile?raw';
import { loadNodeRuntime } from '../lib';
import { jspi } from 'wasm-feature-detect';

const runtimeMode = (await jspi()) ? 'jspi' : 'asyncify';

const phpVersions =
	'PHP' in process.env ? [process.env['PHP']] : SupportedPHPVersions;

// Run MySQL functions if credentials are provided
const mysqlCredentials = {
	host: process.env['MYSQL_HOST'] ?? '127.0.0.1',
	user: process.env['MYSQL_USER'],
	password: process.env['MYSQL_PASSWORD'],
	database: process.env['MYSQL_DATABASE'],
	port: process.env['MYSQL_PORT'] ?? '3306',
};

describe('MySQL network functions', () => {
	if (
		!mysqlCredentials.host ||
		!mysqlCredentials.user ||
		!mysqlCredentials.password ||
		!mysqlCredentials.database
	) {
		test.skip(
			'Skipping MySQL network functions because no credentials were provided.'
		);
		console.log(`
			Skipping MySQL network functions because no credentials were provided.

			To run MySQL network function tests, set the following environment variables:
			- MYSQL_HOST
			- MYSQL_USER
			- MYSQL_PASSWORD
			- MYSQL_DATABASE

			Use 127.0.0.1 instead of localhost to ensure MySQL uses
			TCP instead of socket, because MySQL in Playground
			still doesn't support sockets.
		`);
		return;
	}
	describe.each(phpVersions)(`PHP %s – ${runtimeMode}`, (phpVersion) => {
		let php: PHP;
		beforeEach(async () => {
			php = new PHP(await loadNodeRuntime(phpVersion as any));
			await setPhpIniEntries(php, { allow_url_fopen: 1 });
		});

		afterEach(async () => {
			php.exit();
		});

		test('MySQL network functions', () => {
			assertNoCrash(`
				$mysqli = new mysqli(
					"${mysqlCredentials.host}",
					"${mysqlCredentials.user}",
					"${mysqlCredentials.password}",
					"${mysqlCredentials.database}",
					${mysqlCredentials.port}
				);
				if (mysqli_connect_errno()) {
					// This should crash the process I hope
					klfhjkljfkdjfd();
				}
				mysqli_ping($mysqli);
				mysqli_query($mysqli, "SELECT 1");
				mysqli_multi_query($mysqli, "SELECT 1; SELECT 2;");
				mysqli_get_server_info($mysqli);
				mysqli_get_server_version($mysqli);
				mysqli_get_proto_info($mysqli);
				mysqli_close($mysqli);
			`);
		});

		test('Can connect to "localhost"', () => {
			assertNoCrash(`
				$mysqli = new mysqli(
					"localhost",
					"${mysqlCredentials.user}",
					"${mysqlCredentials.password}",
					"${mysqlCredentials.database}",
					${mysqlCredentials.port}
				);
				if (mysqli_connect_errno()) {
					// This should crash the process I hope
					klfhjkljfkdjfd();
				}
				mysqli_ping($mysqli);
				mysqli_query($mysqli, "SELECT 1");
				mysqli_multi_query($mysqli, "SELECT 1; SELECT 2;");
				mysqli_get_server_info($mysqli);
				mysqli_get_server_version($mysqli);
				mysqli_get_proto_info($mysqli);
				mysqli_close($mysqli);
			`);
		});

		async function assertNoCrash(code: string) {
			try {
				const result = await php.run({
					code: `<?php ${code}`,
				});
				expect(result).toBeTruthy();
				expect(result.text).toBe('');
				expect(result.errors).toBeFalsy();
			} catch (e) {
				if (
					'FIX_DOCKERFILE' in process.env &&
					process.env['FIX_DOCKERFILE'] === 'true' &&
					runtimeMode == 'asyncify' &&
					'functionsMaybeMissingFromAsyncify' in php
				) {
					const missingCandidates = (
						php.functionsMaybeMissingFromAsyncify as string[]
					)
						.map((candidate) =>
							candidate.replace('byn$fpcast-emu$', '')
						)
						.filter(
							(candidate) =>
								!Dockerfile.includes(`"${candidate}"`)
						);
					if (missingCandidates.length) {
						addAsyncifyFunctionsToDockerfile(missingCandidates);
						throw new Error(
							`Asyncify crash! The following missing functions were just auto-added to the ASYNCIFY_ONLY list in the Dockerfile: \n ` +
								missingCandidates.join(', ') +
								`\nYou now need to rebuild PHP and re-run this test: \n` +
								`  npm run recompile:php:node:asyncify:8.0\n` +
								`  node --stack-trace-limit=100 ./node_modules/.bin/nx test php-wasm-node --test-name-pattern='asyncify'\n`
						);
					}

					const err = new Error(
						`Asyncify crash! No C functions present in the stack trace were missing ` +
							`from the Dockerfile. This could mean the stack trace is too short – try increasing the stack trace limit ` +
							`with --stack-trace-limit=100. If you already did that, fixing this problem will likely take more digging.`
					);
					err.cause = e;
					throw err;
				}
			}
		}
	});
});

let Dockerfile = InitialDockerfile;
const DockerfilePath = path.resolve(
	__dirname,
	'../../../compile/php/Dockerfile'
);
function addAsyncifyFunctionsToDockerfile(functions: string[]) {
	const currentDockerfile = fs.readFileSync(DockerfilePath, 'utf8') + '';
	const lookup = `export ASYNCIFY_ONLY=$'`;
	const idx = currentDockerfile.indexOf(lookup) + lookup.length;
	const updatedDockerfile =
		currentDockerfile.substring(0, idx) +
		functions.map((f) => `"${f}",\\\n`).join('') +
		currentDockerfile.substring(idx);
	fs.writeFileSync(DockerfilePath, updatedDockerfile);
	Dockerfile = updatedDockerfile;
}
