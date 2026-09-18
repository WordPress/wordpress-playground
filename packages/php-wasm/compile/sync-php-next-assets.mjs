import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';

const projectRoot = path.resolve(import.meta.dirname, '../../..');
const args = new Set(process.argv.slice(2));
const optional = args.has('--optional');
const ifMissing = args.has('--if-missing');
const remote = process.env.PHP_NEXT_ASSETS_REMOTE || 'origin';
const branch = process.env.PHP_NEXT_ASSETS_BRANCH || 'php-next-builds';
const targetDir = path.resolve(
	projectRoot,
	process.env.PHP_NEXT_ASSETS_DIR ||
		'packages/playground/website/public/php-next'
);
const remoteRef = `refs/remotes/${remote}/${branch}`;

if (ifMissing && fs.existsSync(path.join(targetDir, 'index.js'))) {
	console.log(`PHP next assets already exist in ${targetDir}`);
	process.exit(0);
}

try {
	verifyRemoteBranchExists();
	run(
		'git',
		['fetch', remote, `+refs/heads/${branch}:${remoteRef}`, '--depth=1'],
		{
			inheritStdio: !optional,
		}
	);
	fs.rmSync(targetDir, { recursive: true, force: true });
	fs.mkdirSync(targetDir, { recursive: true });
	await extractGitArchive(remoteRef, targetDir);
	console.log(`Synced PHP next assets into ${targetDir}`);
} catch (error) {
	if (optional) {
		console.warn(`Skipping PHP next assets sync: ${error.message}`);
		process.exit(0);
	}
	throw error;
}

function extractGitArchive(ref, outputDir) {
	console.log(`Running git archive ${ref} | tar -x -C ${outputDir} ...`);
	return new Promise((resolve, reject) => {
		const git = spawn('git', ['archive', ref], {
			cwd: projectRoot,
			stdio: ['ignore', 'pipe', 'inherit'],
		});
		const tar = spawn('tar', ['-x', '-C', outputDir], {
			cwd: projectRoot,
			stdio: ['pipe', 'inherit', 'inherit'],
		});
		let gitClosed = false;
		let tarClosed = false;

		const maybeResolve = () => {
			if (gitClosed && tarClosed) {
				resolve();
			}
		};

		git.stdout.pipe(tar.stdin);
		git.on('error', reject);
		tar.on('error', reject);
		git.on('close', (code) => {
			gitClosed = true;
			if (code !== 0) {
				reject(new Error(`git archive exited with code ${code}`));
			} else {
				maybeResolve();
			}
		});
		tar.on('close', (code) => {
			tarClosed = true;
			if (code !== 0) {
				reject(new Error(`tar exited with code ${code}`));
			} else {
				maybeResolve();
			}
		});
	});
}

/**
 * Check the publishing branch before git fetch so optional local dev sync can
 * explain a missing PHP-next branch without dumping git's fatal stderr.
 */
function verifyRemoteBranchExists() {
	const result = spawnSync(
		'git',
		['ls-remote', '--exit-code', '--heads', remote, branch],
		{
			cwd: projectRoot,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		}
	);
	if (result.error) {
		throw new Error(`git failed to start: ${result.error.message}`, {
			cause: result.error,
		});
	}
	if (result.status === 0) {
		return;
	}
	if (result.status === 2) {
		throw new Error(
			`PHP next assets branch ${branch} does not exist on ${remote}. ` +
				'Run the Refresh PHP Next workflow to publish it.'
		);
	}
	const output = formatCommandOutput(result);
	throw new Error(
		output
			? `Could not query PHP next assets branch ${branch} ` +
					`on ${remote}: ${output}`
			: `Could not query PHP next assets branch ${branch} on ${remote}: ` +
					`git ls-remote exited with code ${result.status}`
	);
}

function run(command, commandArgs, options = {}) {
	console.log('Running', command, commandArgs.join(' '), '...');
	const result = spawnSync(command, commandArgs, {
		cwd: projectRoot,
		encoding: 'utf8',
		stdio:
			options.inheritStdio === false
				? ['ignore', 'pipe', 'pipe']
				: 'inherit',
	});
	if (result.error) {
		throw new Error(`${command} failed to start: ${result.error.message}`, {
			cause: result.error,
		});
	}
	if (result.status !== 0) {
		const output = formatCommandOutput(result);
		throw new Error(
			output
				? `${command} exited with code ${result.status}: ${output}`
				: `${command} exited with code ${result.status}`
		);
	}
}

function formatCommandOutput(result) {
	return [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
}
