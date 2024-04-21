import path from 'path';
import yargs from 'yargs';
import { startServer } from './server';

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
	}).argv;

const mounts = (args.mount || []).map((mount) => {
	const [source, vfsPath] = mount.split(':');
	return {
		hostPath: path.resolve(process.cwd(), source),
		vfsPath,
	};
});

console.log('Starting PHP server...');
console.log({ mounts });

startServer({
	mounts,
});
