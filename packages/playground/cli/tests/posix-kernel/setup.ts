/**
 * Vitest setup for kernel-mode specs. Resolves the wasm-posix-kernel
 * checkout once per test file and exposes it via WASM_POSIX_KERNEL_DIR
 * so the CLI's host-bridge picks it up when --experimental-posix-kernel
 * is enabled.
 *
 * Resolution order:
 *   1. Existing WASM_POSIX_KERNEL_DIR env var (developer override —
 *      typically a sibling working copy with rebuilt binaries).
 *   2. The `wasm-posix-kernel` git submodule at the repo root, which
 *      tracks an artifacts branch on mho22/wasm-posix-kernel that
 *      ships a built host/dist/ + the four required wasm binaries.
 *
 * If neither is available the env var stays unset and the specs that
 * depend on it skip via `describe.skipIf(...)`.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const submoduleDir = resolve(here, '../../../../../wasm-posix-kernel');
const submoduleHostEntry = resolve(submoduleDir, 'host', 'dist', 'index.js');

if (!process.env['WASM_POSIX_KERNEL_DIR'] && existsSync(submoduleHostEntry)) {
	process.env['WASM_POSIX_KERNEL_DIR'] = submoduleDir;
}
