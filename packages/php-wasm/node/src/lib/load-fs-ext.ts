import { createRequire } from 'node:module';
import type * as FsExt from 'fs-ext-extra-prebuilt';

const require = createRequire(
	typeof __filename === 'string' ? __filename : import.meta.url
);
let binding: typeof FsExt | undefined;

// Keep this synchronous for the exported native lock managers, but do not load
// the addon merely because a caller imports @php-wasm/node (including --help).
export function loadFsExt(): typeof FsExt {
	return (binding ??= require('fs-ext-extra-prebuilt'));
}
