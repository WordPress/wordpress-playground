import { execFile } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import {
	PHP,
	SupportedPHPVersions,
	popLoadedRuntime,
	type SupportedPHPVersion,
} from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';

const phpVersions = process.env['PHP']
	? [process.env['PHP'] as SupportedPHPVersion]
	: SupportedPHPVersions;

describe.each(phpVersions)('PHP %s socket timeouts', (phpVersion) => {
	it('ignores a queued socket completion after exit', async () => {
		const connections: net.Socket[] = [];
		const server = net.createServer((socket) => connections.push(socket));
		await new Promise<void>((resolve) =>
			server.listen(0, '127.0.0.1', resolve)
		);
		const { port } = server.address() as net.AddressInfo;
		let php: PHP | undefined;
		try {
			const id = await loadNodeRuntime(phpVersion);
			const runtime = popLoadedRuntime(id, {
				dangerouslyKeepTheRuntimeInTheMap: true,
			});
			php = new PHP(id);
			const exited = new Promise<void>((resolve) => {
				// SOCKFS handles open before the connect wait's listener. Exit
				// inside that event, while EventEmitter still has the latter queued.
				runtime.websocket.on('open', () => {
					php!.exit();
					resolve();
				});
			});
			let output: string | undefined;
			let failure: unknown;
			php.run({
				code: `<?php
				$s = fsockopen('127.0.0.1', ${port});
				fread($s, 1);
				echo 'continued after exit';
				`,
			}).then(
				(result) => (output = result.text),
				(error) => (failure = error)
			);
			await exited;
			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(output ?? '').toBe('');
			expect(failure).toBeUndefined();
		} finally {
			php?.exit();
			connections.forEach((socket) => socket.destroy());
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('returns a read timeout while the runtime remains active', async () => {
		const connections: net.Socket[] = [];
		const server = net.createServer((socket) => connections.push(socket));
		await new Promise<void>((resolve) =>
			server.listen(0, '127.0.0.1', resolve)
		);
		const { port } = server.address() as net.AddressInfo;
		let php: PHP | undefined;
		try {
			php = new PHP(await loadNodeRuntime(phpVersion));
			const result = await php.run({
				code: `<?php
				$socket = fsockopen('127.0.0.1', ${port});
				stream_set_timeout($socket, 0, 100000);
				$data = fread($socket, 1);
				$metadata = stream_get_meta_data($socket);
				echo json_encode([$data, $metadata['timed_out']]);
				`,
			});
			const [data, timedOut] = JSON.parse(result.text);
			// PHP versions differ on whether a timed-out read returns false or ''.
			expect([false, '']).toContain(data);
			expect(timedOut).toBe(true);
		} finally {
			php?.exit();
			connections.forEach((socket) => socket.destroy());
			await new Promise((resolve) => server.close(resolve));
		}
	});

	it('releases read timers and runtime memory on exit', async () => {
		const repoRoot = path.resolve(__dirname, '../../../../..');
		const loader = path.join(
			repoRoot,
			'packages/meta/src/node-es-module-loader/loader.mts'
		);
		// A child isolates the event loop from Vitest's own timers and servers.
		// Its 30-second read must not keep it alive after every TCP handle closes.
		const fixture = path.join(
			__dirname,
			'fixtures/exit-during-network-read.ts'
		);
		await new Promise<void>((resolve, reject) => {
			execFile(
				process.execPath,
				['--no-warnings', '--expose-gc', `--loader=${loader}`, fixture],
				{
					timeout: 10000,
					env: { ...process.env, TEST: '1', PHP_VERSION: phpVersion },
				},
				(error, _stdout, stderr) => {
					if (error) {
						reject(new Error(stderr || error.message));
					} else {
						resolve();
					}
				}
			);
		});
	}, 15000);

	it("keeps another runtime's pending read active when one runtime exits", async () => {
		const connections: net.Socket[] = [];
		const ready = new Map<string, net.Socket>();
		let bothWaiting: () => void;
		const waiting = new Promise<void>((resolve) => (bothWaiting = resolve));
		const server = net.createServer((socket) => {
			connections.push(socket);
			socket.once('data', (data) => {
				ready.set(data.toString(), socket);
				if (ready.size === 2) {
					bothWaiting();
				}
			});
		});
		await new Promise<void>((resolve) =>
			server.listen(0, '127.0.0.1', resolve)
		);
		const { port } = server.address() as net.AddressInfo;
		const runtimes: PHP[] = [];
		try {
			for (let i = 0; i < 2; i++) {
				runtimes.push(new PHP(await loadNodeRuntime(phpVersion)));
			}
			let exitedOutput: string | undefined;
			let exitedFailure: unknown;
			const run = (php: PHP, id: string) =>
				php.run({
					code: `<?php
				$s = fsockopen('127.0.0.1', ${port});
				stream_set_timeout($s, 0, 100000);
				fwrite($s, '${id}');
				echo fread($s, 5);
					echo ':finished';
				`,
				});
			run(runtimes[0], 'first').then(
				(result) => (exitedOutput = result.text),
				(error) => (exitedFailure = error)
			);
			const secondRun = run(runtimes[1], 'second');
			await waiting;
			runtimes[0].exit();
			ready.get('second')!.write('hello');
			expect((await secondRun).text).toBe('hello:finished');
			await new Promise((resolve) => setTimeout(resolve, 150));
			expect(exitedOutput ?? '').toBe('');
			expect(exitedFailure).toBeUndefined();
		} finally {
			runtimes.forEach((php) => php.exit());
			connections.forEach((socket) => socket.destroy());
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
