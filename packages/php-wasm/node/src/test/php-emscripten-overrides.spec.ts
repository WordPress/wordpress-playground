import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'../../../../..'
);

function collectFiles(directory: string, pattern: RegExp): string[] {
	return readdirSync(directory)
		.flatMap((entry) => {
			const fullPath = join(directory, entry);
			if (statSync(fullPath).isDirectory()) {
				return collectFiles(fullPath, pattern);
			}
			return pattern.test(entry) ? [fullPath] : [];
		})
		.sort();
}

function collectBuildFiles(pattern: RegExp): string[] {
	return [
		...collectFiles(
			join(repoRoot, 'packages/php-wasm/node-builds'),
			pattern
		),
		...collectFiles(
			join(repoRoot, 'packages/php-wasm/web-builds'),
			pattern
		),
	];
}

/**
 * Emscripten ≥ 6 rewrote fd_sync and __syscall_poll to Promise-based
 * implementations that suspend the WASM runtime. php-wasm overrides both
 * with the synchronous Emscripten 4.0.19 implementations — see the
 * rationale in compile/php/phpwasm-emscripten-library.js. These tests
 * assert the overrides made it into every checked-in loader, because a
 * regression only surfaces as hangs in slow, network-dependent suites.
 */
describe('synchronous fd_sync and __syscall_poll overrides', () => {
	const librarySource = readFileSync(
		join(
			repoRoot,
			'packages/php-wasm/compile/php/phpwasm-emscripten-library.js'
		),
		'utf8'
	);

	it('are present in the Emscripten library source', () => {
		expect(librarySource).toContain('fd_sync: function');
		expect(librarySource).toContain('if (!mount.type.syncfs)');
		expect(librarySource).toContain('__syscall_poll: function');
		// Without the explicit false, the override inherits 'auto' from the
		// upstream declaration and gets wrapped in Asyncify.handleAsync,
		// which makes every poll() suspend and starves the event loop.
		expect(librarySource).toContain('__syscall_poll__async: false');
	});

	it('are present in all checked-in generated PHP loaders', () => {
		const loaderFiles = collectBuildFiles(/^php_\d+_\d+\.js$/);
		expect(loaderFiles).toHaveLength(32);

		let loadersWithPoll = 0;
		for (const loaderFile of loaderFiles) {
			const loader = readFileSync(loaderFile, 'utf8');

			const fdSyncStart = loader.indexOf('var _fd_sync = function');
			expect(fdSyncStart, loaderFile).toBeGreaterThan(-1);
			const fdSync = loader.slice(fdSyncStart, fdSyncStart + 700);
			expect(fdSync, loaderFile).toContain('if (!mount.type.syncfs)');
			expect(fdSync, loaderFile).toContain('wakeUp(0)');

			// PHP 5.2 does not use poll() at all.
			const pollStart = loader.indexOf(
				'function ___syscall_poll(fds, nfds, timeout) {'
			);
			if (pollStart === -1) {
				continue;
			}
			loadersWithPoll++;
			const poll = loader.slice(pollStart, pollStart + 1200);
			expect(poll, loaderFile).toContain('var nonzero = 0');
			expect(poll, loaderFile).toContain('return nonzero');
			expect(poll, loaderFile).not.toContain('handleAsync');
			expect(poll, loaderFile).not.toContain('handleSleep');
			expect(poll, loaderFile).not.toContain('Suspending');
			expect(loader, loaderFile).not.toContain('___syscall_poll.isAsync');
		}
		expect(loadersWithPoll).toBe(28);
	});
});

/**
 * Emscripten ≥ 6 (emscripten-core/emscripten#26095) runs the Asyncify
 * rewind continuation under callUserCallback(), which exits the Emscripten
 * runtime when the rewound PHP call returns. php-wasm manages the runtime
 * lifecycle itself, so the compile pipeline reverts that — see the
 * doRewind patch in compile/php/Dockerfile.
 */
describe('Asyncify rewind runtime-exit revert', () => {
	it('is applied to all checked-in generated PHP loaders', () => {
		const loaderFiles = collectBuildFiles(/^php_\d+_\d+\.js$/);
		expect(loaderFiles).toHaveLength(32);

		for (const loaderFile of loaderFiles) {
			const loader = readFileSync(loaderFile, 'utf8');
			expect(loader, loaderFile).not.toContain(
				'return callUserCallback(func)'
			);
		}
	});
});

function parseWasmImportAndExportNames(wasmFile: string) {
	const buf = readFileSync(wasmFile);
	let offset = 8; // Skip the magic number and version.
	const readVarUint = () => {
		let result = 0;
		let shift = 0;
		let byte: number;
		do {
			byte = buf[offset++];
			result |= (byte & 0x7f) << shift;
			shift += 7;
		} while (byte & 0x80);
		return result >>> 0;
	};
	const readName = () => {
		const length = readVarUint();
		const name = buf.toString('utf8', offset, offset + length);
		offset += length;
		return name;
	};
	const skipLimits = () => {
		const flags = readVarUint();
		readVarUint();
		if (flags & 1) {
			readVarUint();
		}
	};
	const imports: string[] = [];
	const exports: string[] = [];
	while (offset < buf.length) {
		const sectionId = buf[offset++];
		const sectionEnd = readVarUint() + offset;
		if (sectionId === 2) {
			const count = readVarUint();
			for (let i = 0; i < count; i++) {
				readName(); // Module name.
				imports.push(readName());
				const kind = buf[offset++];
				if (kind === 0) {
					readVarUint(); // Function type index.
				} else if (kind === 1) {
					offset++; // Reference type.
					skipLimits();
				} else if (kind === 2) {
					skipLimits();
				} else if (kind === 3) {
					offset += 2; // Value type and mutability.
				} else if (kind === 4) {
					offset++; // Tag attribute.
					readVarUint(); // Tag type index.
				} else {
					throw new Error(
						`Unknown import kind ${kind} in ${wasmFile}`
					);
				}
			}
		} else if (sectionId === 7) {
			const count = readVarUint();
			for (let i = 0; i < count; i++) {
				exports.push(readName());
				offset++; // Export kind.
				readVarUint(); // Export index.
			}
			break; // Nothing needed past the export section.
		}
		offset = sectionEnd;
	}
	return { imports, exports };
}

/**
 * An Asyncify main module shares its suspension state with dynamically
 * loaded extensions. Emscripten < 4.0.22 imported __asyncify_state and
 * __asyncify_data from JS; since 4.0.22 the main module must export them.
 * At -O3, however, wasm-metadce strips those exports unless they are
 * rooted — the base image patches Emscripten for that (see
 * compile/base-image/Dockerfile). Without either the import or the export,
 * every extension fails to dlopen with a LinkError.
 */
describe('Asyncify shared globals in main modules', () => {
	it('are importable by extensions in all checked-in asyncify builds', () => {
		const wasmFiles = collectBuildFiles(/^php_\d+_\d+\.wasm$/).filter(
			(file) => file.includes('/asyncify/')
		);
		expect(wasmFiles).toHaveLength(16);

		for (const wasmFile of wasmFiles) {
			const { imports, exports } =
				parseWasmImportAndExportNames(wasmFile);
			const visible = (name: string) =>
				imports.includes(name) || exports.includes(name);
			expect(visible('__asyncify_state'), wasmFile).toBe(true);
			expect(visible('__asyncify_data'), wasmFile).toBe(true);
		}
	});
});
