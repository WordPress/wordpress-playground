import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { SupportedPHPVersions } from '@php-wasm/universal';
import { isValidWordPressSlug } from './is-valid-wordpress-slug';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { runCLI, RunCLIArgs } from './run-cli';

async function run() {
	/**
	 * @TODO This looks similar to Query API args https://wordpress.github.io/wordpress-playground/developers/apis/query-api/
	 *       Perhaps the two could be handled by the same code?
	 */
	const yargsObject = await yargs(process.argv.slice(2))
		.usage('Usage: wp-playground <command> [options]')
		.positional('command', {
			describe: 'Command to run',
			type: 'string',
			choices: ['server', 'run-blueprint', 'build-snapshot'],
		})
		.option('outfile', {
			describe: 'When building, write to this output file.',
			type: 'string',
			default: 'wordpress.zip',
		})
		.option('port', {
			describe: 'Port to listen on when serving.',
			type: 'number',
			default: 9400,
		})
		.option('php', {
			describe: 'PHP version to use.',
			type: 'string',
			default: RecommendedPHPVersion,
			choices: SupportedPHPVersions,
		})
		.option('wp', {
			describe: 'WordPress version to use.',
			type: 'string',
			default: 'latest',
		})
		// @TODO: Support read-only mounts, e.g. via WORKERFS, a custom
		// ReadOnlyNODEFS, or by copying the files into MEMFS
		.option('mount', {
			describe:
				'Mount a directory to the PHP runtime. You can provide --mount multiple times. Format: /host/path:/vfs/path',
			type: 'array',
			string: true,
		})
		.option('mountBeforeInstall', {
			describe:
				'Mount a directory to the PHP runtime before installing WordPress. You can provide --mount-before-install multiple times. Format: /host/path:/vfs/path',
			type: 'array',
			string: true,
		})
		.option('login', {
			describe: 'Should log the user in',
			type: 'boolean',
			default: false,
		})
		.option('blueprint', {
			describe: 'Blueprint to execute.',
			type: 'string',
		})
		.option('skipWordPressSetup', {
			describe:
				'Do not download, unzip, and install WordPress. Useful for mounting a pre-configured WordPress directory at /wordpress.',
			type: 'boolean',
			default: false,
		})
		.option('quiet', {
			describe: 'Do not output logs and progress messages.',
			type: 'boolean',
			default: false,
		})
		.option('debug', {
			describe:
				'Print PHP error log content if an error occurs during Playground boot.',
			type: 'boolean',
			default: false,
		})
		.showHelpOnFail(false)
		.check((args) => {
			if (args.wp !== undefined && !isValidWordPressSlug(args.wp)) {
				try {
					// Check if is valid URL
					new URL(args.wp);
				} catch (e) {
					throw new Error(
						'Unrecognized WordPress version. Please use "latest", a URL, or a numeric version such as "6.2", "6.0.1", "6.2-beta1", or "6.2-RC1"'
					);
				}
			}
			if (args.blueprint !== undefined) {
				const blueprintPath = path.resolve(
					process.cwd(),
					args.blueprint
				);
				if (!fs.existsSync(blueprintPath)) {
					throw new Error('Blueprint file does not exist');
				}

				const content = fs.readFileSync(blueprintPath, 'utf-8');
				try {
					args.blueprint = JSON.parse(content);
				} catch (e) {
					throw new Error('Blueprint file is not a valid JSON file');
				}
			}
			return true;
		});

	yargsObject.wrap(yargsObject.terminalWidth());
	const args = await yargsObject.argv;

	const command = args._[0] as string;

	if (!['run-blueprint', 'server', 'build-snapshot'].includes(command)) {
		yargsObject.showHelp();
		process.exit(1);
	}

	const cliArgs = {
		...args,
		command,
	} as RunCLIArgs;

	return await runCLI(cliArgs);
}

run();
