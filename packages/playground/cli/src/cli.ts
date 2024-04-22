import path from 'path';
import yargs from 'yargs';
import { startServer } from './server';
import {
	PHPRequest,
	PHPRequestHandler,
	PHPResponse,
} from '@php-wasm/universal';
import { createPhp } from './setup-php';
import { defineSiteUrl, login } from '@wp-playground/blueprints';
import { NodePHP } from '@php-wasm/node';

const args = await yargs(process.argv)
	.option('php', {
		describe: 'PHP version to use.',
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
	}).argv;

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
console.log({ mounts });

let requestHandler: PHPRequestHandler<NodePHP>;
startServer({
	port: args.port,
	onBind: async (port: number) => {
		const absoluteUrl = `http://127.0.0.1:${port}`;
		console.log({ port });
		console.log(`Server is running on ${absoluteUrl}`);
		// open(absoluteUrl); // Open the URL in the default browser

		requestHandler = new PHPRequestHandler({
			phpFactory: async () => createPhp(mounts || []),
			documentRoot: '/wordpress',
			absoluteUrl,
		});
		// Warm up and setup the PHP runtime
		const php = await requestHandler.getPrimaryPhp();
		await defineSiteUrl(php, {
			siteUrl: absoluteUrl,
		});
		if (args.login) {
			await login(php, {});
		}
	},
	async handleRequest(request: PHPRequest) {
		if (!requestHandler) {
			return PHPResponse.forHttpCode(502, 'Server not ready yet');
		}
		return await requestHandler.request(request);
	},
});
