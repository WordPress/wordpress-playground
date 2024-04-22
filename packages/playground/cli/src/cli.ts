import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { startServer } from './server';
import {
	PHPRequest,
	PHPRequestHandler,
	PHPResponse,
	SupportedPHPVersion,
	SupportedPHPVersions,
} from '@php-wasm/universal';
import { createPhp, setupWordPress } from './setup-php';
import {
	Blueprint,
	compileBlueprint,
	defineSiteUrl,
	login,
	runBlueprintSteps,
} from '@wp-playground/blueprints';
import { RecommendedPHPVersion } from '@wp-playground/wordpress';
import { NodePHP } from '@php-wasm/node';
import { isValidWordPressSlug } from './is-valid-wordpress-slug';
import { EmscriptenDownloadMonitor, ProgressTracker } from '@php-wasm/progress';

const args = await yargs(process.argv)
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
	.option('port', {
		describe: 'Port to listen on.',
		type: 'number',
		default: 9400,
	})
	.option('mount', {
		describe: 'Mount a directory to the PHP runtime.',
		type: 'array',
		string: true,
	})
	.option('login', {
		describe: 'Should log the user in',
		type: 'boolean',
		default: false,
	})
	.option('blueprint', {
		describe: 'Blueprint to execute',
		type: 'string',
	})
	.check((args) => {
		if (args.wp !== undefined && !isValidWordPressSlug(args.wp)) {
			throw new Error(
				'Unrecognized WordPress version. Please use "latest" or numeric versions such as "6.2", "6.0.1", "6.2-beta1", or "6.2-RC1"'
			);
		}
		if (args.blueprint !== undefined) {
			const blueprintPath = path.resolve(process.cwd(), args.blueprint);
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
	}).argv;

const blueprint = args.blueprint as Blueprint | undefined;
const phpVersion = ((blueprint ? blueprint.preferredVersions?.php : args.php) ||
	RecommendedPHPVersion) as SupportedPHPVersion;
const wpVersion = ((blueprint ? blueprint.preferredVersions?.wp : args.wp) ||
	'latest') as string;

export interface Mount {
	hostPath: string;
	vfsPath: string;
}
const mounts: Mount[] = (args.mount || []).map((mount) => {
	const [source, vfsPath] = mount.split(':');
	return {
		hostPath: path.resolve(process.cwd(), source),
		vfsPath,
	};
});

console.log('Starting PHP server...');

let requestHandler: PHPRequestHandler<NodePHP>;
let wordPressReady = false;
const monitor = new EmscriptenDownloadMonitor();
monitor.addEventListener('progress', ((
	e: CustomEvent<ProgressEvent & { finished: boolean }>
) => {
	const percentProgress = Math.round(
		Math.min(100, (100 * e.detail.loaded) / e.detail.total)
	);
	process.stdout.write(`\rDownloading WordPress ${percentProgress}%...    `);
}) as any);

startServer({
	port: args.port,
	onBind: async (port: number) => {
		const absoluteUrl = `http://127.0.0.1:${port}`;
		requestHandler = new PHPRequestHandler({
			phpFactory: async ({ isPrimary }) =>
				createPhp(requestHandler, phpVersion, isPrimary),
			documentRoot: '/wordpress',
			absoluteUrl,
		});
		// Warm up and setup the PHP runtime
		const php = await requestHandler.getPrimaryPhp();

		// Put pre-configured WordPress in the /wordpress directory
		const mountingAtSlashWordPress = mounts.some(
			(mount) => mount.vfsPath === '/wordpress'
		);

		// No need to unzip WordPress if it's already mounted at /wordpress
		if (!mountingAtSlashWordPress) {
			console.log(`Setting up WordPress`);
			await setupWordPress(php, wpVersion, monitor);
			process.stdout.write('\n');
		}

		for (const mount of mounts) {
			php.mount(mount.hostPath, mount.vfsPath);
		}

		await defineSiteUrl(php, {
			siteUrl: absoluteUrl,
		});

		if (blueprint) {
			console.log(`Running a blueprint`);
			const tracker = new ProgressTracker();
			let lastCaption = '';
			tracker.addEventListener('progress', (e: any) => {
				lastCaption = e.detail.caption || lastCaption;
				process.stdout.write(
					'\r\x1b[K' + `${lastCaption} – ${e.detail.progress}%`
				);
			});
			tracker.addEventListener('done', () => {
				process.stdout.write('\n');
			});

			const compiled = compileBlueprint(blueprint, {
				progress: tracker,
			});
			await runBlueprintSteps(compiled, php);
			console.log(`Finished running the blueprint`);
		} else {
			if (args.login) {
				await login(php, {});
			}
		}
		wordPressReady = true;
		console.log(`Server is running on ${absoluteUrl}`);
	},
	async handleRequest(request: PHPRequest) {
		if (!wordPressReady) {
			return PHPResponse.forHttpCode(502, 'Server not ready yet');
		}
		return await requestHandler.request(request);
	},
});
