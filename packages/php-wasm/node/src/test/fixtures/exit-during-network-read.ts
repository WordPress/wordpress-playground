import net from 'node:net';
import {
	PHP,
	popLoadedRuntime,
	type SupportedPHPVersion,
} from '@php-wasm/universal';
import { loadNodeRuntime } from '../../lib';

const connections: net.Socket[] = [];
let notifyWaiting: () => void;
const waiting = new Promise<void>((resolve) => (notifyWaiting = resolve));
const server = net.createServer((socket) => {
	connections.push(socket);
	socket.once('data', () => notifyWaiting());
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address() as net.AddressInfo;
const weak = await runAndExit();
connections.forEach((socket) => socket.destroy());
await new Promise((resolve) => server.close(resolve));
if (process.getActiveResourcesInfo().includes('Timeout')) {
	throw new Error('A pending network wait still has a referenced timer');
}
// Use a file rather than --eval: Node's eval scope itself retains the runtime.
for (let i = 0; i < 10; i++) {
	await new Promise((resolve) => setTimeout(resolve, 10));
	global.gc!();
}
if (weak.deref()) {
	throw new Error('The cancelled network wait still retains the runtime');
}

async function runAndExit() {
	const id = await loadNodeRuntime(
		process.env['PHP_VERSION'] as SupportedPHPVersion,
		{
			emscriptenOptions: { processId: 1 },
		}
	);
	const runtime = popLoadedRuntime(id, {
		dangerouslyKeepTheRuntimeInTheMap: true,
	});
	const weak = new WeakRef(runtime);
	const php = new PHP(id);
	php.run({
		code: `<?php
		$s = fsockopen('127.0.0.1', ${port});
		stream_set_timeout($s, 30);
		fwrite($s, 'waiting');
		fread($s, 1);
		`,
	}).catch(() => {});
	await waiting;
	php.exit();
	return weak;
}
