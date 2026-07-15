import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const submoduleDir = resolve(here, '../../../../../kandelo');
const submoduleHostEntry = resolve(submoduleDir, 'host', 'dist', 'index.js');

if (!process.env['KANDELO_DIR'] && existsSync(submoduleHostEntry)) {
	process.env['KANDELO_DIR'] = submoduleDir;
}
