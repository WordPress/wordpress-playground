import { runCLI } from '@wp-playground/cli';

const cliServer = await runCLI({
	php: '8.4',
	command: 'server',
	mount: [{ hostPath: './src', vfsPath: '/wordpress' }],
	xdebug: true,
	experimentalDevtools: true,
});

const response = await cliServer.playground.run({
	scriptPath: `/wordpress/test.php`,
});

console.log(new TextDecoder().decode(response.bytes));
