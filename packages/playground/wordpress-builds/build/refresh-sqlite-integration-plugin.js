import yargs from 'yargs';
import { promises as fs } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import path from 'path';
import {
	getSqliteIntegrationZipPath,
	registerSqliteIntegrationVersion,
} from './sqlite-integration-registry.js';

const SQLITE_REPOSITORY_URL =
	'https://github.com/WordPress/sqlite-database-integration';

// The latest version of the SQLite plugin is the develop branch.
const latestVersion = 'trunk';

const parser = yargs(process.argv.slice(2))
	.usage('Usage: $0 [options]')
	.options({
		['output-dir']: {
			type: 'string',
			description: 'output directory',
			required: true,
		},
		['plugin-version']: {
			type: 'string',
			description: 'version',
			required: false,
			default: latestVersion,
		},
	});

const args = parser.argv;
const version = args.pluginVersion;
const outputZipPath = getSqliteIntegrationZipPath(args.outputDir, version);

await buildPluginZip(version, outputZipPath);
registerSqliteIntegrationVersion(args.outputDir, version);

/**
 * Fetch the SQLite repository and build the SQLite integration plugin ZIP.
 */
async function buildPluginZip(version, outputZipPath) {
	const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'sqlite-plugin-'));
	try {
		const repoDir = path.join(tempDir, 'repo');
		execFileSync(
			'git',
			[
				'clone',
				'--depth',
				'1',
				'--branch',
				version,
				'--single-branch',
				`${SQLITE_REPOSITORY_URL}.git`,
				repoDir,
			],
			{ stdio: 'inherit' }
		);

		const buildScript = path.join(
			repoDir,
			'bin',
			'build-sqlite-plugin-zip.sh'
		);
		const hasBuildScript = await fs.access(buildScript).then(
			() => true,
			() => false
		);

		if (hasBuildScript) {
			// Monorepo structure: Run the repository's build script.
			execFileSync('bash', [buildScript], {
				cwd: repoDir,
				stdio: 'inherit',
			});
			await fs.copyFile(
				path.join(
					repoDir,
					'build',
					'plugin-sqlite-database-integration.zip'
				),
				outputZipPath
			);
		} else {
			// Old flat structure: Download the GitHub archive.
			const url = `${SQLITE_REPOSITORY_URL}/archive/refs/tags/${version}.zip`;
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(
					`Failed to download SQLite integration plugin ${version}: ${response.statusText}`
				);
			}
			await fs.writeFile(
				outputZipPath,
				Buffer.from(await response.arrayBuffer())
			);
		}
	} finally {
		await fs.rm(tempDir, { recursive: true, force: true });
	}
}
