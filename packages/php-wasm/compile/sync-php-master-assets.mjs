import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const projectRoot = path.resolve(import.meta.dirname, '../../..');
const args = new Set(process.argv.slice(2));
const optional = args.has('--optional');
const ifMissing = args.has('--if-missing');
const remote = process.env.PHP_MASTER_ASSETS_REMOTE || 'origin';
const branch = process.env.PHP_MASTER_ASSETS_BRANCH || 'php-master-builds';
const targetDir = path.resolve(
	projectRoot,
	process.env.PHP_MASTER_ASSETS_DIR ||
		'packages/playground/website/public/php-master'
);
const remoteRef = `refs/remotes/${remote}/${branch}`;

if (ifMissing && fs.existsSync(path.join(targetDir, 'index.js'))) {
	console.log(`PHP master assets already exist in ${targetDir}`);
	process.exit(0);
}

try {
	run('git', [
		'fetch',
		remote,
		`+refs/heads/${branch}:${remoteRef}`,
		'--depth=1',
	]);
	fs.rmSync(targetDir, { recursive: true, force: true });
	fs.mkdirSync(targetDir, { recursive: true });
	run('sh', [
		'-c',
		`git archive ${remoteRef} | tar -x -C ${shellQuote(targetDir)}`,
	]);
	console.log(`Synced PHP master assets into ${targetDir}`);
} catch (error) {
	if (optional) {
		console.warn(`Skipping PHP master assets sync: ${error.message}`);
		process.exit(0);
	}
	throw error;
}

function run(command, commandArgs) {
	console.log('Running', command, commandArgs.join(' '), '...');
	const result = spawnSync(command, commandArgs, {
		cwd: projectRoot,
		stdio: 'inherit',
	});
	if (result.status !== 0) {
		throw new Error(`${command} exited with code ${result.status}`);
	}
}

function shellQuote(value) {
	return `'${value.replaceAll("'", `'"'"'`)}'`;
}
