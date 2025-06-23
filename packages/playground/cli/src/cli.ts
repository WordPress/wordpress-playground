/* eslint-disable no-console */
import { SupportedPHPVersions } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import yargs from 'yargs';
import { cpus } from 'os';
import { isValidWordPressSlug } from './is-valid-wordpress-slug';
import type { RunCLIArgs } from './run-cli';
import { runCLI } from './run-cli';
import { resolveBlueprint } from './resolve-blueprint';
import { ReportableError } from './reportable-error';
import {
	parseMountDirArguments,
	parseMountWithDelimiterArguments,
} from './mount';
import type { Mount } from './mount';
import { jspi } from 'wasm-feature-detect';

async function run() {
	/**
	 * @TODO This looks similar to Query API args https://wordpress.github.io/wordpress-playground/developers/apis/query-api/
	 *       Perhaps the two could be handled by the same code?
	 */
	const yargsObject = yargs(process.argv.slice(2))
		.usage('Usage: wp-playground <command> [options]')
		.positional('command', {
			describe: 'Command to run',
			choices: ['server', 'run-blueprint', 'build-snapshot'] as const,
			demandOption: true,
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
				'Mount a directory to the PHP runtime (can be used multiple times). Format: /host/path:/vfs/path',
			type: 'array',
			string: true,
			coerce: parseMountWithDelimiterArguments,
		})
		.option('mount-before-install', {
			describe:
				'Mount a directory to the PHP runtime before WordPress installation (can be used multiple times). Format: /host/path:/vfs/path',
			type: 'array',
			string: true,
			coerce: parseMountWithDelimiterArguments,
		})
		.option('mount-dir', {
			describe:
				'Mount a directory to the PHP runtime (can be used multiple times). Format: "/host/path" "/vfs/path"',
			type: 'array',
			nargs: 2,
			array: true,
			// coerce: parseMountDirArguments,
		})
		.option('mount-dir-before-install', {
			describe:
				'Mount a directory before WordPress installation (can be used multiple times). Format: "/host/path" "/vfs/path"',
			type: 'string',
			nargs: 2,
			array: true,
			coerce: parseMountDirArguments,
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
		.option('blueprint-may-read-adjacent-files', {
			describe:
				'Consent flag: Allow "bundled" resources in a local blueprint to read files in the same directory as the blueprint file.',
			type: 'boolean',
			default: false,
		})
		.option('skip-wordpress-setup', {
			describe:
				'Do not download, unzip, and install WordPress. Useful for mounting a pre-configured WordPress directory at /wordpress.',
			type: 'boolean',
			default: false,
		})
		.option('skip-sqlite-setup', {
			describe:
				'Skip the SQLite integration plugin setup to allow the WordPress site to use MySQL.',
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
		.option('auto-mount', {
			describe: `Automatically mount the current working directory. You can mount a WordPress directory, a plugin directory, a theme directory, a wp-content directory, or any directory containing PHP and HTML files.`,
			type: 'boolean',
			default: false,
		})
		.option('follow-symlinks', {
			describe:
				'Allow Playground to follow symlinks by automatically mounting symlinked directories and files encountered in mounted directories. \nWarning: Following symlinks will expose files outside mounted directories to Playground and could be a security risk.',
			type: 'boolean',
			default: false,
		})
		.option('experimentalTrace', {
			describe:
				'Print detailed messages about system behavior to the console. Useful for troubleshooting.',
			type: 'boolean',
			default: false,
			// Hide this option because we want to replace with a more general log-level flag.
			hidden: true,
		})
		// TODO: Should we make this a hidden flag?
		.option('experimentalMultiWorker', {
			describe:
				'Enable experimental multi-worker support which requires JSPI ' +
				'and a /wordpress directory backed by a real filesystem. ' +
				'Pass a positive number to specify the number of workers to use. ' +
				'Otherwise, default to the number of CPUs minus 1.',
			type: 'number',
			coerce: (value?: number) => value ?? cpus().length - 1,
		})
		.showHelpOnFail(false)
		.check(async (args) => {
			if (args.wp !== undefined && !isValidWordPressSlug(args.wp)) {
				try {
					// Check if is valid URL
					new URL(args.wp);
				} catch {
					throw new Error(
						'Unrecognized WordPress version. Please use "latest", a URL, or a numeric version such as "6.2", "6.0.1", "6.2-beta1", or "6.2-RC1"'
					);
				}
			}

			if (args.experimentalMultiWorker !== undefined) {
				if (args.experimentalMultiWorker <= 1) {
					throw new Error(
						'The --experimentalMultiWorker flag must be a positive integer greater than 1.'
					);
				}

				if (!(await jspi())) {
					throw new Error(
						'JavaScript Promise Integration (JSPI) is not enabled. Please enable JSPI in your JavaScript runtime before using the --experimentalMultiWorker flag.'
					);
				}

				const isMountingWordPressDir = (mount: Mount) =>
					mount.vfsPath === '/wordpress';
				if (
					!args.mount?.some(isMountingWordPressDir) &&
					!(args['mountBeforeInstall'] as any)?.some(
						isMountingWordPressDir
					)
				) {
					throw new Error(
						'Please mount a real filesystem directory as the /wordpress directory before using the --experimentalMultiWorker flag.'
					);
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
		blueprint: await resolveBlueprint({
			sourceString: args.blueprint,
			blueprintMayReadAdjacentFiles: args.blueprintMayReadAdjacentFiles,
		}),
		mount: [...(args.mount || []), ...(args.mountDir || [])],
		mountBeforeInstall: [
			...(args.mountBeforeInstall || []),
			...(args.mountDirBeforeInstall || []),
		],
	} as RunCLIArgs;

	try {
		return runCLI(cliArgs);
	} catch (e) {
		const reportableCause = ReportableError.getReportableCause(e);
		if (reportableCause) {
			console.log('');
			console.log(reportableCause.message);
			process.exit(1);
		} else {
			throw e;
		}
	}
}

run();
