import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../..'
);

function collectGeneratedPhpLoaders(directory: string): string[] {
	return readdirSync(directory)
		.flatMap((entry) => {
			const fullPath = join(directory, entry);
			if (statSync(fullPath).isDirectory()) {
				return collectGeneratedPhpLoaders(fullPath);
			}
			return /php_\d+_\d+\.js$/.test(entry) ? [fullPath] : [];
		})
		.sort();
}

describe('socket timeout support', () => {
	it('is present in the Emscripten library source', () => {
		const source = readFileSync(
			join(
				repoRoot,
				'packages/php-wasm/compile/php/phpwasm-emscripten-library.js'
			),
			'utf8'
		);

		expect(source).toContain('socketTimeouts: new Map()');
		expect(source).toContain('parseSocketTimeout');
		expect(source).toContain('SO_RCVTIMEO');
		expect(source).toContain('SO_SNDTIMEO');
		expect(source).toContain(
			'PHPWASM.socketTimeouts.set(socketd, timeouts)'
		);
		expect(source).toContain('const receiveTimeout =');
		expect(source).toContain('PHPWASM.socketTimeouts.get(sockfd)?.receive');
		expect(source).toContain('wakeUp(-ERRNO_CODES.EAGAIN)');
		expect(source).toContain(
			'const sendTimeout = PHPWASM.socketTimeouts.get(sockfd)?.send'
		);
		expect(source).toContain('const timeout = sendTimeout ?? 30000');
		expect(source).toContain('const cleanupConnectListeners = () =>');
		expect(source).toContain('const cleanupFailedConnect = (errno) =>');
		expect(source).toContain('sock.connecting = false');
		expect(source).toContain('sock.error = errno');
		expect(source).not.toContain('?.send || 30000');
		expect(source).not.toContain('const isIgnorable');
	});

	it('is present in all checked-in generated PHP loaders', () => {
		const loaderFiles = [
			...collectGeneratedPhpLoaders(
				join(repoRoot, 'packages/php-wasm/node-builds')
			),
			...collectGeneratedPhpLoaders(
				join(repoRoot, 'packages/php-wasm/web-builds')
			),
		];

		expect(loaderFiles).toHaveLength(32);

		for (const loaderFile of loaderFiles) {
			const loader = readFileSync(loaderFile, 'utf8');
			expect(loader, loaderFile).toContain('socketTimeouts: new Map');
			expect(loader, loaderFile).toContain('parseSocketTimeout');
			expect(loader, loaderFile).toContain('SO_RCVTIMEO');
			expect(loader, loaderFile).toContain('SO_SNDTIMEO');
			expect(loader, loaderFile).toContain(
				'PHPWASM.socketTimeouts.set(socketd, timeouts)'
			);
			expect(loader, loaderFile).toContain(
				'parseSocketTimeout: function'
			);
			if (loader.includes('___syscall_recvfrom(sockfd')) {
				expect(loader, loaderFile).toContain(
					'PHPWASM.socketTimeouts.get(sockfd)?.receive'
				);
				expect(loader, loaderFile).toContain(
					'wakeUp(-ERRNO_CODES.EAGAIN)'
				);
			}
			expect(loader, loaderFile).toContain(
				'PHPWASM.socketTimeouts.get(sockfd)?.send'
			);
			expect(loader, loaderFile).toContain(
				'const timeout = sendTimeout ?? 3e4'
			);
			expect(loader, loaderFile).toContain('cleanupConnectListeners');
			expect(loader, loaderFile).toContain('cleanupFailedConnect');
			expect(loader, loaderFile).toContain('sock.connecting = false');
			expect(loader, loaderFile).toContain('sock.error = errno');
			expect(loader, loaderFile).not.toContain('?.send || 3e4');
			expect(loader, loaderFile).not.toContain('isIgnorable');
		}
	});
});
